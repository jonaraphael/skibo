import { useRef, useState } from "react";
import { TaskPeriod } from "../app/types";
import { canEdit, useApp } from "../app/store";
import { scheduleLabel } from "../lib/schedule/calendar";
import { Dotted, EffortPips } from "./Shared";
import { useWorkspace } from "./Workspace";
import { Icon } from "./Icon";
import { completions } from "../lib/rewards/engine";
import { taskType } from "../lib/tasks/taxonomy";
import { TaskHistory } from "./TaskHistory";

export const TaskRow = ({
  period,
  management = false,
}: {
  period: TaskPeriod;
  management?: boolean;
}) => {
  const { task, bucket } = period;
  const { openTask } = useWorkspace();
  const complete = useApp((s) => s.complete);
  const undo = useApp((s) => s.undo);
  const events = useApp((s) => s.data.events);
  const skip = useApp((s) => s.skip);
  const snooze = useApp((s) => s.snooze);
  const status = useApp((s) => s.setTaskStatus);
  const storageError = useApp((s) => !canEdit(s));
  const menu = useRef<HTMLDetailsElement>(null);
  const [menuAbove, setMenuAbove] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const lastCompletion = completions(events)
    .filter((e) => e.taskId === task.id)
    .at(-1);
  const actionable =
    !management &&
    task.status === "active" &&
    bucket !== "done" &&
    bucket !== "later";
  const meta = management
    ? `${taskType(task.schedule, task.behavior)} · ${scheduleLabel(task.schedule)}${task.status !== "active" ? ` · ${task.status}` : ""}`
    : period.detail;
  const act = (fn: () => void) => {
    menu.current?.querySelector("summary")?.focus();
    fn();
    if (menu.current) menu.current.open = false;
  };
  return (
    <article
      className={`task-row ${bucket === "done" && !management ? "done" : ""} ${task.status !== "active" ? "inactive" : ""}`}
      onTouchStart={(e) => {
        touch.current = null;
        swiped.current = false;
        if ((e.target as HTMLElement).closest(".complete-button, a, .row-menu"))
          return;
        touch.current = {
          x: e.changedTouches[0].clientX,
          y: e.changedTouches[0].clientY,
        };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start || !actionable || storageError) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 90 && Math.abs(dy) < 35) {
          e.preventDefault();
          swiped.current = true;
          if (dx < 0 && !period.hold) snooze(period);
          else if (dx > 0) skip(period);
        }
      }}
      onTouchCancel={() => {
        touch.current = null;
      }}
    >
      {!management && (
        <button
          className={`complete-button ${bucket === "done" ? "checked" : ""}`}
          aria-label={`${bucket === "done" ? "Undo" : "Complete"} ${task.title}`}
          disabled={
            !!storageError ||
            (bucket === "done" ? !lastCompletion : !actionable)
          }
          onClick={() =>
            bucket === "done" && lastCompletion
              ? undo(lastCompletion.id)
              : complete(period)
          }
        >
          {bucket === "done" && <Icon name="check" size={17} />}
        </button>
      )}
      {management && (
        <span className="task-kind">
          <Icon
            name={task.schedule.kind === "once" ? "today" : "plan"}
            size={19}
          />
        </span>
      )}
      <button
        className="task-copy"
        onClick={(e) => {
          if (swiped.current) {
            swiped.current = false;
            e.preventDefault();
            return;
          }
          openTask(task);
        }}
      >
        <span className="task-title">{task.title}</span>
        <span
          className={`task-meta ${bucket === "late" && !management ? "late-text" : ""}`}
        >
          {bucket === "done" && !management && lastCompletion ? (
            <Dotted
              items={[
                new Date(lastCompletion.at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                lastCompletion.reward ? (
                  <span className="task-outcome">
                    <i className="reward-dot" />
                    {lastCompletion.reward.title}
                  </span>
                ) : lastCompletion.roll === null ? (
                  "early reset · no draw"
                ) : (
                  "no reward"
                ),
              ]}
            />
          ) : (
            <Dotted items={[meta]} />
          )}
        </span>
        {period.hold && (
          <span className="task-hold">Tray on hold · {period.hold}</span>
        )}
        {task.notes && <span className="task-note">{task.notes}</span>}
        <TaskHistory task={task} />
      </button>
      <EffortPips effort={task.effort} />
      <details
        className="row-menu"
        ref={menu}
        onToggle={(e) => {
          const details = e.currentTarget;
          if (!details.open) return;
          const trigger = details
            .querySelector("summary")!
            .getBoundingClientRect();
          const height =
            details.querySelector<HTMLElement>(".popover")!.offsetHeight;
          const bottom = Math.min(
            window.innerHeight,
            ...[...document.querySelectorAll(".mobile-nav, .mobile-fab")]
              .map((el) => el.getBoundingClientRect())
              .filter((r) => r.height > 0)
              .map((r) => r.top),
          );
          setMenuAbove(
            trigger.bottom + height > bottom && trigger.top > height,
          );
        }}
      >
        <summary
          className="icon-button"
          aria-label={`Actions for ${task.title}`}
        >
          <Icon name="more" size={19} />
        </summary>
        <div className={`popover ${menuAbove ? "above" : ""}`}>
          <button onClick={() => act(() => openTask(task))}>
            Edit task & history
          </button>
          {lastCompletion && bucket !== "done" && (
            <button
              disabled={!!storageError}
              onClick={() => act(() => undo(lastCompletion.id))}
            >
              Undo last completion
            </button>
          )}
          {actionable && (
            <>
              <button
                disabled={!!storageError || !!period.hold}
                onClick={() => act(() => snooze(period))}
              >
                Move to tomorrow
              </button>
              <button
                disabled={!!storageError}
                onClick={() => act(() => skip(period))}
              >
                Declare a miss
              </button>
            </>
          )}
          <button
            disabled={!!storageError}
            onClick={() =>
              act(() =>
                status(task.id, task.status === "active" ? "paused" : "active"),
              )
            }
          >
            {task.status === "active" ? "Pause task" : "Resume task"}
          </button>
          {task.status !== "archived" && (
            <button
              disabled={!!storageError}
              onClick={() => act(() => status(task.id, "archived"))}
            >
              Archive task
            </button>
          )}
        </div>
      </details>
    </article>
  );
};
