import { canEdit, useApp } from "../app/store";
import { activeHolds } from "../lib/tasks/taxonomy";
import { useWorkspace } from "./Workspace";

export const HoldNotice = () => {
  const { data, complete, skip } = useApp();
  const disabled = useApp((s) => !canEdit(s));
  const { now } = useWorkspace();
  const holds = activeHolds(data, now);
  if (!holds.length) return null;
  return (
    <section className="hold-notice" aria-label="Reward tray holds">
      <h2>Tray on hold</h2>
      <p>
        Your rewards are still yours. Resolve each task below to enjoy them.
      </p>
      <ul>
        {holds.map((p) => (
          <li key={p.task.id}>
            <strong>{p.task.title}</strong>
            <span>{p.hold}</span>
            <div className="hold-actions">
              <button
                className="button secondary"
                disabled={disabled}
                onClick={() => complete(p)}
              >
                Complete {p.task.title}
              </button>
              <button
                className="text-link"
                disabled={disabled}
                onClick={() => skip(p)}
              >
                Declare a miss for {p.task.title}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="field-hint">
        A declared miss forfeits this round’s draw and stays in your record.
      </p>
    </section>
  );
};
