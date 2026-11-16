import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app/store";
import { Effort, Schedule, Task } from "../app/types";
import { Dialog } from "../components/Dialog";
import { EffortPips } from "../components/Shared";
import { useWorkspace } from "../components/Workspace";
import {
  addDays,
  dayKey,
  liveEvents,
  localDate,
  prettyDate,
  scheduleLabel,
} from "../lib/schedule/calendar";

export const TaskEditor = ({
  task,
  close,
}: {
  task: Task | null;
  close: () => void;
}) => {
  const { now } = useWorkspace();
  const { data, saveTask, storageError } = useApp();
  const today = dayKey(now, data.preferences.dayStart);
  const [title, setTitle] = useState(task?.title ?? "");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [effort, setEffort] = useState<Effort>(task?.effort ?? "solid");
  const [schedule, setSchedule] = useState<Schedule>(
    task?.schedule ?? {
      kind: "daily",
      start: today,
      time: "",
      every: 1,
      weekdays: [localDate(today).getDay()],
      monthDay: localDate(today).getDate(),
      unit: "days",
    },
  );
  const [pickDate, setPickDate] = useState(
    !!schedule.start && ![today, addDays(today, 1)].includes(schedule.start),
  );
  const patch = (next: Partial<Schedule>) =>
    setSchedule((s) => ({ ...s, ...next }));
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give your task a name.");
      return;
    }
    if (storageError) return;
    const saved = saveTask(
      {
        title: title.trim(),
        notes: notes.trim(),
        effort,
        schedule: {
          ...schedule,
          every:
            Number.isInteger(schedule.every) &&
            schedule.every >= 1 &&
            schedule.every <= 365
              ? schedule.every
              : 1,
          monthDay: Number.isInteger(schedule.monthDay)
            ? Math.min(31, Math.max(1, schedule.monthDay))
            : 1,
        },
        status: task?.status ?? "active",
      },
      task?.id,
    );
    if (saved) close();
    else setError("Check the task name and schedule before saving.");
  };
  const history = task
    ? liveEvents(data.events)
        .filter(
          (e) =>
            "taskId" in e &&
            e.taskId === task.id &&
            (e.type === "completed" || e.type === "skipped"),
        )
        .slice(-8)
        .reverse()
    : [];
  return (
    <Dialog title={task ? "Edit task" : "New task"} close={close}>
      <h2>{task ? task.title : "New task"}</h2>
      <form onSubmit={onSubmit} className="editor-form">
        <label className="field title-field">
          <span>Task name</span>
          <input
            autoFocus
            required
            maxLength={300}
            placeholder="e.g. Make time for a walk"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Starts</legend>
          <div className="chips">
            {[
              [today, "Today"],
              [addDays(today, 1), "Tomorrow"],
            ].map(([date, label]) => (
              <button
                type="button"
                key={label}
                className={`chip ${schedule.start === date && !pickDate ? "selected" : ""}`}
                aria-pressed={schedule.start === date && !pickDate}
                onClick={() => {
                  patch({ start: date });
                  setPickDate(false);
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`chip ${pickDate ? "selected" : ""}`}
              aria-pressed={pickDate}
              onClick={() => {
                setPickDate(true);
                if (!schedule.start) patch({ start: today });
              }}
            >
              Pick a day
            </button>
            {schedule.kind === "once" && (
              <button
                type="button"
                className={`chip ${!schedule.start ? "selected" : ""}`}
                aria-pressed={!schedule.start}
                onClick={() => {
                  patch({ start: null, time: "" });
                  setPickDate(false);
                }}
              >
                No date
              </button>
            )}
          </div>
          {pickDate && (
            <label className="field">
              <span>Start date</span>
              <input
                type="date"
                min="1900-01-01"
                max="9900-12-31"
                required
                value={schedule.start ?? today}
                onChange={(e) => patch({ start: e.target.value })}
              />
            </label>
          )}
        </fieldset>
        <fieldset>
          <legend>Repeats</legend>
          <div className="chips">
            {(
              [
                ["once", "Once"],
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
                ["after", "After done"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={`chip ${schedule.kind === kind ? "selected" : ""}`}
                aria-pressed={schedule.kind === kind}
                onClick={() => patch({ kind, start: schedule.start ?? today })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {schedule.kind !== "once" && (
          <div className="inline-fields">
            <label className="field">
              <span>Every</span>
              <input
                type="number"
                min={1}
                max={365}
                required
                value={schedule.every}
                onChange={(e) => patch({ every: Number(e.target.value) })}
              />
            </label>
            {schedule.kind === "after" ? (
              <label className="field">
                <span>After completing</span>
                <select
                  value={schedule.unit}
                  onChange={(e) =>
                    patch({ unit: e.target.value as Schedule["unit"] })
                  }
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="hours">hours</option>
                </select>
              </label>
            ) : (
              <span className="unit-label">
                {schedule.kind === "daily"
                  ? "day(s)"
                  : schedule.kind === "weekly"
                    ? "week(s)"
                    : "month(s)"}
              </span>
            )}
          </div>
        )}
        {schedule.kind === "weekly" && (
          <fieldset>
            <legend>On these days</legend>
            <div className="weekday-picker">
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day, i) => (
                <button
                  key={day}
                  type="button"
                  className={`chip ${schedule.weekdays.includes(i) ? "selected" : ""}`}
                  aria-label={day}
                  aria-pressed={schedule.weekdays.includes(i)}
                  onClick={() =>
                    patch({
                      weekdays: schedule.weekdays.includes(i)
                        ? schedule.weekdays.length > 1
                          ? schedule.weekdays.filter((d) => d !== i)
                          : schedule.weekdays
                        : [...schedule.weekdays, i].sort(),
                    })
                  }
                >
                  {day.slice(0, 2)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {schedule.kind === "monthly" && (
          <>
            <label className="field">
              <span>Monthly pattern</span>
              <select
                value={schedule.nthWeekday ? "weekday" : "date"}
                onChange={(e) =>
                  patch({
                    nthWeekday:
                      e.target.value === "weekday"
                        ? { nth: 1, weekday: 1 }
                        : undefined,
                  })
                }
              >
                <option value="date">Day of the month</option>
                <option value="weekday">Nth weekday</option>
              </select>
            </label>
            {schedule.nthWeekday ? (
              <div className="two-col">
                <label className="field">
                  <span>Which week</span>
                  <select
                    value={schedule.nthWeekday.nth}
                    onChange={(e) =>
                      patch({
                        nthWeekday: {
                          ...schedule.nthWeekday!,
                          nth: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[1, 2, 3, 4, -1].map((n) => (
                      <option key={n} value={n}>
                        {n === -1
                          ? "Last"
                          : ["", "First", "Second", "Third", "Fourth"][n]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Weekday</span>
                  <select
                    value={schedule.nthWeekday.weekday}
                    onChange={(e) =>
                      patch({
                        nthWeekday: {
                          ...schedule.nthWeekday!,
                          weekday: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="field">
                <span>Day of month (short months use their last day)</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={schedule.monthDay}
                  onChange={(e) => patch({ monthDay: Number(e.target.value) })}
                />
              </label>
            )}
          </>
        )}
        <fieldset>
          <legend>How much effort?</legend>
          <div className="effort-picker">
            {(["light", "solid", "heavy"] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-label={value}
                className={effort === value ? "selected" : ""}
                aria-pressed={effort === value}
                onClick={() => setEffort(value)}
              >
                <EffortPips effort={value} />
                <span>{value}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <details className="additional">
          <summary>
            Time & notes <span>optional</span>
          </summary>
          <div className="form-stack">
            {schedule.start &&
              !(schedule.kind === "after" && schedule.unit === "hours") && (
                <label className="field">
                  <span>Due time</span>
                  <input
                    type="time"
                    value={schedule.time}
                    onChange={(e) => patch({ time: e.target.value })}
                  />
                </label>
              )}
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything that makes starting easier"
              />
            </label>
          </div>
        </details>
        <p className="schedule-echo">
          <strong>{scheduleLabel(schedule)}.</strong>{" "}
          {schedule.kind === "after"
            ? "The next date starts from when you actually finish."
            : schedule.kind !== "once"
              ? "One open task at a time. Missed days won't pile up."
              : "Each completion has a 30% reward chance."}{" "}
          All times are local.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary full-width"
          disabled={!!storageError}
          type="submit"
        >
          {task ? "Save changes" : "Add task"}
        </button>
      </form>
      {task && (
        <details className="task-history">
          <summary>
            Task history ·{" "}
            {history.length ? "recent activity" : "no activity yet"}
          </summary>
          {history.map((e) => (
            <div className="history-line" key={e.id}>
              <span>{e.type === "completed" ? "Completed" : "Skipped"}</span>
              <time>
                {prettyDate(dayKey(new Date(e.at), data.preferences.dayStart))}
              </time>
            </div>
          ))}
          <Link to="/rewards/record" onClick={close}>
            See your full record →
          </Link>
        </details>
      )}
    </Dialog>
  );
};
