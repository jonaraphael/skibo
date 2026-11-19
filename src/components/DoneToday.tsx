import { Completion } from "../app/types";
import { Mark } from "./Marks";
import { UndoCompletion } from "./UndoCompletion";

export const DoneToday = ({ entries }: { entries: Completion[] }) => {
  return (
    <>
      <div className="panel-heading">
        <h2>Done today</h2>
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
              <UndoCompletion entry={entry} />
            </article>
          ))}
        </div>
      ) : (
        <p className="quiet-note">No completions yet today.</p>
      )}
    </>
  );
};
