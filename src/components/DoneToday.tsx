import { canEdit, useApp } from "../app/store";
import { Completion } from "../app/types";
import { Mark } from "./Marks";

export const DoneToday = ({ entries }: { entries: Completion[] }) => {
  const undo = useApp((s) => s.undo);
  const editable = useApp(canEdit);
  const latest = entries.at(-1);
  return (
    <>
      <div className="panel-heading">
        <h2>Done today</h2>
        {latest && (
          <button
            className="text-link"
            disabled={!editable}
            onClick={() => undo(latest.id)}
          >
            Undo last completion
          </button>
        )}
      </div>
      {entries.length ? (
        <div className="activity-list">
          {[...entries].reverse().map((entry) => (
            <article key={entry.id}>
              <Mark kind={entry.reward ? "flower" : "leaf"} />
              <div>
                <strong>{entry.taskTitle}</strong>
                {entry.reward && <p>{entry.reward.title}</p>}
              </div>
              <time dateTime={entry.at}>
                {new Date(entry.at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="quiet-note">No completions yet today.</p>
      )}
    </>
  );
};
