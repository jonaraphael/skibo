import { useRef, useState } from "react";
import { TaskPeriod } from "../app/types";
import { canEdit, useApp } from "../app/store";
import { dayKey, daysBetween, scheduleLabel } from "../lib/schedule/calendar";
import { Dotted, EffortPips } from "./Shared";
import { useWorkspace } from "./Workspace";
import { Icon } from "./Icon";
import { completedRepeat, taskType } from "../lib/tasks/taxonomy";
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
  const { task, bucket, lastCompletion } = period;
  const { openTask, now } = useWorkspace();
  const complete = useApp((s) => s.complete);
  const completeTask = onComplete ?? (management ? undefined : complete);
  const undo = useApp((s) => s.undo);
  const dayStart = useApp((s) => s.data.preferences.dayStart);
  const skip = useApp((s) => s.skip);
  const snooze = useApp((s) => s.snooze);
  const status = useApp((s) => s.setTaskStatus);
  const storageError = useApp((s) => !canEdit(s));
  const menu = useRef<HTMLDetailsElement>(null);
  const [menuAbove, setMenuAbove] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const checkedToday = !management && completedRepeat(period);
  const days = lastCompletion && Math.max(
    0,
    daysBetween(dayKey(new Date(lastCompletion.at), dayStart), dayKey(now, dayStart)),
  );
  const elapsed = days !== undefined && (
    <>
      <span className={period.pastDue ? "elapsed-highlight" : undefined}>{days}</span>
      {days === 1 ? " day" : " days"} since last completed
    </>
  );
  const available =
    !!completeTask &&
    task.status === "active" &&
    bucket !== "done" &&
    bucket !== "later";
  const actionable = available && !finishing;
  const meta = management
    ? [
        taskType(task.schedule, task.behavior),
        task.schedule.kind === "once" ? "Once" : scheduleLabel(task.schedule),
        ...(task.status === "active" ? [] : [task.status]),
      ]
    : [
        !checkedToday && message,
        checkedToday && `Completed ${period.completedToday} ${period.completedToday === 1 ? "time" : "times"} today`,
        (!checkedToday || period.pastDue) && elapsed,
        period.detail,
      ].filter(Boolean);
  const act = (fn: () => void) => {
    menu.current?.querySelector("summary")?.focus();
    fn();
    if (menu.current) menu.current.open = false;
  };
  const content = (
    <>
      {available ? (
        <span className={`complete-button ${finishing ? "checked" : ""}`} aria-hidden="true">
          {finishing && <Icon name="check" size={17} />}
        </span>
      ) : (
        <span className="task-kind">
          <Icon name={task.schedule.kind === "once" ? "today" : "plan"} size={19} />
        </span>
      )}
      <span className="task-copy">
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
      </span>
      <EffortPips effort={task.effort} />
    </>
  );
  return (
    <article
      data-task-id={task.id}
      className={`task-row ${finishing ? "finishing" : ""} ${checkedToday ? "completed-repeat" : ""} ${task.status !== "active" ? "inactive" : ""}`}
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
      {available ? (
        <button
          type="button"
          className="task-primary"
          aria-label={`${finishing ? "Completed" : "Complete"} ${task.title}`}
          disabled={storageError || finishing}
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") swiped.current = false;
          }}
          onKeyDown={() => { swiped.current = false; }}
          onClick={() => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            if (menu.current) menu.current.open = false;
            completeTask(period);
          }}
        >
          {content}
        </button>
      ) : (
        <div className="task-primary">{content}</div>
      )}
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
          {lastCompletion && !finishing && (
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
