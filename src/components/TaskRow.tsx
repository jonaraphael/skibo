import { useRef, useState } from "react";
import { TaskPeriod } from "../app/types";
import { canEdit, useApp } from "../app/store";
import { dayKey, scheduleLabel } from "../lib/schedule/calendar";
import { Dotted, EffortPips } from "./Shared";
import { useWorkspace } from "./Workspace";
import { Icon } from "./Icon";
import { completions } from "../lib/rewards/engine";
import { isRepeatable, taskType } from "../lib/tasks/taxonomy";
import { TaskHistory } from "./TaskHistory";

export const TaskRow = ({
  period,
  management = false,
  finishing = false,
  message,
  onComplete,
}: {
  period: TaskPeriod;
  management?: boolean;
  finishing?: boolean;
  message?: string;
  onComplete?: (p: TaskPeriod) => void;
}) => {
  const { task, bucket } = period;
  const { openTask, now } = useWorkspace();
  const complete = useApp((s) => s.complete);
  const undo = useApp((s) => s.undo);
  const events = useApp((s) => s.data.events);
  const dayStart = useApp((s) => s.data.preferences.dayStart);
  const skip = useApp((s) => s.skip);
  const snooze = useApp((s) => s.snooze);
  const status = useApp((s) => s.setTaskStatus);
  const storageError = useApp((s) => !canEdit(s));
  const menu = useRef<HTMLDetailsElement>(null);
  const [menuAbove, setMenuAbove] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const history = completions(events).filter((e) => e.taskId === task.id);
  const lastCompletion = history.at(-1);
  const today = dayKey(now, dayStart);
  const count =
    !management && isRepeatable(task)
      ? history.filter((e) => dayKey(new Date(e.at), dayStart) === today).length
      : 0;
  const actionable =
    !management &&
    !finishing &&
    task.status === "active" &&
    bucket !== "done" &&
    bucket !== "later";
  const meta = management
    ? [
        taskType(task.schedule, task.behavior),
        scheduleLabel(task.schedule),
        ...(task.status === "active" ? [] : [task.status]),
      ]
    : [
        message,
        count > 0 && `Completed ${count} ${count === 1 ? "time" : "times"} today`,
        period.detail,
      ].filter(Boolean);
  const act = (fn: () => void) => {
    menu.current?.querySelector("summary")?.focus();
    fn();
    if (menu.current) menu.current.open = false;
  };
  return (
    <article
      className={`task-row ${finishing ? "finishing" : ""} ${task.status !== "active" ? "inactive" : ""}`}
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
          className={`complete-button ${finishing ? "checked" : ""}`}
          aria-label={`${finishing ? "Completed" : "Complete"} ${task.title}`}
          disabled={storageError || !actionable}
          onClick={() => (onComplete ?? complete)(period)}
        >
          {finishing && <Icon name="check" size={17} />}
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
        {meta.length > 0 && (
          <span className="task-meta">
            <Dotted items={meta} />
          </span>
        )}
        {period.hold && !management && (
          <span className="task-hold">Holding the reward tray</span>
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
          {lastCompletion && (
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
