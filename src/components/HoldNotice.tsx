import { canEdit, useApp } from "../app/store";
import { activeHolds } from "../lib/tasks/taxonomy";
import { useWorkspace } from "./Workspace";
import { TaskPeriod } from "../app/types";

export const HoldNotice = ({
  onComplete,
}: {
  onComplete?: (p: TaskPeriod) => void;
}) => {
  const { data, complete, skip } = useApp();
  const disabled = useApp((s) => !canEdit(s));
  const { now } = useWorkspace();
  const holds = activeHolds(data, now);
  if (!holds.length) return null;
  return (
    <section className="hold-notice" aria-label="Reward tray holds">
      <h2>Reward tray on hold</h2>
      <p>
        Earned rewards stay in the tray but can't be used until{" "}
        {holds.length === 1
          ? "this task is"
          : `these ${holds.length} tasks are`}{" "}
        completed or declared missed. A declared miss forfeits that round's draw
        and stays in your record.
      </p>
      <ul>
        {holds.map((p) => (
          <li key={p.task.id}>
            <div>
              <strong>{p.task.title}</strong>
              <span>{p.hold}</span>
            </div>
            <div className="hold-actions">
              <button
                className="button secondary"
                disabled={disabled}
                aria-label={`Complete ${p.task.title}`}
                onClick={() => (onComplete ?? complete)(p)}
              >
                Complete
              </button>
              <button
                className="text-link"
                disabled={disabled}
                aria-label={`Declare a miss for ${p.task.title}`}
                onClick={() => skip(p)}
              >
                Declare a miss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
