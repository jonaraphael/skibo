import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { canEdit, useApp } from "../app/store";
import { Effort, Task } from "../app/types";
import { Dialog } from "../components/Dialog";
import { UndoCompletion } from "../components/UndoCompletion";
import { EffortPips } from "../components/Shared";
import { Answered, RhythmFields } from "../components/RhythmFields";
import { useWorkspace } from "../components/Workspace";
import { dayKey, liveEvents, prettyDate } from "../lib/schedule/calendar";
import {
  defaultBehavior,
  defaultSchedule,
  targetMisses,
} from "../lib/tasks/taxonomy";

export const TaskEditor = ({
  task,
  close,
}: {
  task: Task | null;
  close: () => void;
}) => {
  const { now } = useWorkspace();
  const { data, saveTask } = useApp();
  const disabled = useApp((s) => !canEdit(s));
  const today = dayKey(now, data.preferences.dayStart);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [effort, setEffort] = useState<Effort>(task?.effort ?? "solid");
  const [schedule, setSchedule] = useState(
    task?.schedule ?? defaultSchedule(today),
  );
  const [behavior, setBehavior] = useState(
    task?.behavior ?? defaultBehavior(today),
  );
  const [answered, setAnswered] = useState<Answered>({
    payoff: !!task,
    clock: !!task,
    cost: !!task,
  });
  const [error, setError] = useState("");
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give your task a name.");
      return;
    }
    if (!Object.values(answered).every(Boolean)) {
      setError("Answer all three questions.");
      return;
    }
    if (disabled) return;
    const saved = await saveTask(
      {
        title: title.trim(),
        notes: notes.trim(),
        effort,
        schedule,
        behavior: { ...behavior, unitLabel: behavior.unitLabel.trim() },
        status: task?.status ?? "active",
      },
      task?.id,
    );
    if (saved) close();
    else
      setError(
        "Couldn’t save. Check the dates, interval, and safety margin, then try again. Your draft is here.",
      );
  };
  const history = task
    ? [...liveEvents(data.events), ...targetMisses(data, now)]
        .filter(
          (e) =>
            "taskId" in e &&
            e.taskId === task.id &&
            ["completed", "skipped", "missed"].includes(e.type),
        )
        .slice(-12)
        .reverse()
    : [];
  return (
    <Dialog title={task ? "Edit task" : "New task"} close={close}>
      <h2>{task ? task.title : "New task"}</h2>
      {task && (
        <p className="field-hint">
          Changing the rhythm starts fresh rounds. Your earlier activity stays
          in the record.
        </p>
      )}
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
        <RhythmFields
          schedule={schedule}
          behavior={behavior}
          today={today}
          answered={answered}
          onAnswer={(question) =>
            setAnswered((previous) => ({ ...previous, [question]: true }))
          }
          change={(s, b) => {
            setSchedule(s);
            setBehavior(b);
          }}
        />
        <fieldset>
          <legend>How much effort per completion?</legend>
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
        <label className="field">
          <span>Notes</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that makes starting easier"
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary full-width"
          disabled={disabled}
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
              <span>
                {e.type === "completed"
                  ? "Completed"
                  : e.type === "missed"
                    ? "Missed deadline"
                    : "Declared miss"}
              </span>
              <time>
                {prettyDate(dayKey(new Date(e.at), data.preferences.dayStart))}
              </time>
              {e.type === "completed" && <UndoCompletion entry={e} />}
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
