import { useApp } from "../app/store";
import { Task } from "../app/types";
import { prettyDate } from "../lib/schedule/calendar";
import { HistoryState, taskHistory } from "../lib/tasks/history";
import { useWorkspace } from "./Workspace";

const labels: Record<HistoryState, string> = {
  done: "Completed",
  reward: "Completed with a reward",
  skipped: "Declared miss",
  open: "Open",
  missed: "No completion",
};

export const TaskHistory = ({ task }: { task: Task }) => {
  const events = useApp((s) => s.data.events);
  const preferences = useApp((s) => s.data.preferences);
  const { now } = useWorkspace();
  const days = taskHistory(task, events, now, preferences);
  if (!days.length) return null;
  const done = days.filter(
    (d) => d.state === "done" || d.state === "reward",
  ).length;
  const summary = `${done} of the last ${days.length} scheduled days completed`;
  return (
    <span
      className="task-history-strip"
      role="img"
      aria-label={`${summary}. Oldest to newest. ${days.map((d) => `${prettyDate(d.date)}: ${labels[d.state]}`).join(". ")}`}
      title={`${summary}. Oldest to newest. Leaf: completed. Flower: reward. Outline: open. Bare stem: no completion.`}
    >
      <span className="history-cells" aria-hidden="true">
        {days.map((d) => (
          <i
            key={d.date}
            className={`history-cell ${d.state}`}
            title={`${prettyDate(d.date)}: ${labels[d.state]}`}
          />
        ))}
      </span>
      <span className="history-count" aria-hidden="true">
        {done}/{days.length}
      </span>
    </span>
  );
};
