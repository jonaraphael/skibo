import { JournalEvent, Preferences, Task } from "../../app/types";
import { addDays, dayKey, liveEvents, matchesDay } from "../schedule/calendar";
import { periodFor } from "../tasks/taxonomy";

export type HistoryState =
  "done" | "reward" | "skipped" | "open" | "missed";
export interface HistoryDay {
  date: string;
  state: HistoryState;
}

// Calendar completions retain their original due date even when finished late
// or snoozed. The rhythm and unit suffixes do not change that calendar date.
const periodDate = (task: Task, key: string) =>
  key.slice(task.id.length + 1, task.id.length + 11);

export const taskHistory = (
  task: Task,
  events: JournalEvent[],
  now: Date,
  preferences: Preferences,
): HistoryDay[] => {
  const schedule = task.schedule;
  if (
    schedule.kind === "once" ||
    schedule.kind === "after" ||
    task.behavior.payoff === "more"
  )
    return [];
  const today = dayKey(now, preferences.dayStart);
  const start = schedule.start ?? today;
  const resolved = new Map(
    liveEvents(events)
      .filter(
        (e): e is Extract<JournalEvent, { type: "completed" | "skipped" }> =>
          (e.type === "completed" || e.type === "skipped") &&
          e.taskId === task.id,
      )
      .map((e) => [periodDate(task, e.period), e] as const),
  );
  const current = periodFor(task, events, now, preferences);
  if (!current.date) return [];
  const currentDate = periodDate(task, current.key);
  const days: HistoryDay[] = [];
  for (
    let date = today;
    date >= start && days.length < 14;
    date = addDays(date, -1)
  ) {
    if (!matchesDay(schedule, date)) continue;
    const event = resolved.get(date);
    const state: HistoryState =
      event?.type === "completed"
        ? event.reward
          ? "reward"
          : "done"
        : event?.type === "skipped"
          ? "skipped"
          : task.status === "active" &&
              date === currentDate &&
              current.bucket !== "done"
            ? "open"
            : "missed";
    days.push({ date, state });
  }
  return days.reverse();
};
