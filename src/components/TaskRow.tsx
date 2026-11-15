import { useRef, useState } from "react";
import { TaskPeriod } from "../app/types";
import { useApp } from "../app/store";
import { prettyDate, scheduleLabel } from "../lib/schedule/calendar";
import { EffortPips } from "./Shared";
import { useWorkspace } from "./Workspace";
import { Icon } from "./Icon";
import { completions } from "../lib/rewards/engine";

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
  const storageError = useApp((s) => s.storageError);
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
    ? `${scheduleLabel(task.schedule)}${task.status !== "active" ? ` · ${task.status}` : ""}`
    : bucket === "late" && period.date
      ? `Was due ${prettyDate(period.date, { weekday: "short", month: "short", day: "numeric" })}`
      : period.time
        ? `By ${period.time} · ${scheduleLabel(task.schedule)}`
        : scheduleLabel(task.schedule);
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
          dx < 0 ? snooze(period) : skip(period);
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
          {meta}
        </span>
        {task.notes && <span className="task-note">{task.notes}</span>}
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
          {actionable && (
            <>
              <button
                disabled={!!storageError}
                onClick={() => act(() => snooze(period))}
              >
                Move to tomorrow
              </button>
              <button
                disabled={!!storageError}
                onClick={() => act(() => skip(period))}
              >
                Skip this time
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
