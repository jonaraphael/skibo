import { useState } from "react";
import { useApp } from "../app/store";
import { TaskPeriod } from "../app/types";
import { completions } from "../lib/rewards/engine";

export const useTaskListCompletion = () => {
  const { complete, data } = useApp();
  const [submitted, setSubmitted] = useState<TaskPeriod[]>([]);
  // Keep the completed occurrence in its original position during its exit.
  // Checking the live journal also makes Undo cancel the exit immediately.
  const finishedUnits = new Set(
    submitted.length ? completions(data.events).map((e) => e.period) : [],
  );
  const finishing = new Map(
    submitted.filter((p) => finishedUnits.has(p.key)).map((p) => [p.task.id, p]),
  );
  const completeRow = async (period: TaskPeriod) => {
    if (
      data.preferences.reduceMotion ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return complete(period);

    setSubmitted((rows) => [...rows, period]);
    try {
      await complete(period);
      await new Promise((resolve) => window.setTimeout(resolve, 450));
    } finally {
      setSubmitted((rows) => rows.filter((p) => p !== period));
    }
  };
  return { finishing, completeRow };
};
