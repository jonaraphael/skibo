import {
  Completion,
  JournalEvent,
  Notebook,
  TaskPeriod,
} from "../../app/types";
import { liveEvents } from "../schedule/calendar";
import { periodFor } from "./taxonomy";
import { drawReward } from "../rewards/engine";
import { RandomSource } from "../rewards/rng";

export const completePeriod = (
  data: Notebook,
  period: TaskPeriod,
  now: Date,
  rng: RandomSource,
  id: string,
): Completion | null => {
  const task = data.tasks.find((t) => t.id === period.task.id);
  if (!task || task.status !== "active") return null;
  const current = periodFor(task, data.events, now, data.preferences);
  if (
    current.key !== period.key ||
    current.bucket === "done" ||
    current.bucket === "later"
  )
    return null;
  // Re-completing an undone period reuses the original result, even after a reload.
  const previous = data.events.find(
    (e): e is Completion =>
      e.type === "completed" &&
      e.taskId === task.id &&
      e.period === current.key,
  );
  const result =
    previous ??
    (current.drawEligible
      ? drawReward(task.effort, data, now, rng)
      : { roll: null, reward: null });
  return {
    id,
    type: "completed",
    taskId: task.id,
    taskTitle: task.title,
    period: current.key,
    at: now.toISOString(),
    roll: result.roll,
    reward: result.reward,
    ...(result.noDrawReason && { noDrawReason: result.noDrawReason }),
  };
};
export const undoEvent = (
  data: Notebook,
  target: string,
  now: Date,
  id: string,
): JournalEvent | null => {
  const event = liveEvents(data.events).find((e) => e.id === target);
  if (!event || event.type === "undone" || event.type === "missed" || event.type === "redrawn") return null;
  return { id, type: "undone", target, at: now.toISOString() };
};
