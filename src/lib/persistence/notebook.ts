import {
  Completion,
  JournalEvent,
  Notebook,
  Preferences,
  Reward,
  Schedule,
  Task,
} from "../../app/types";
import { dateKey, validDate } from "../schedule/calendar";
import { REWARD_SUGGESTIONS, starterRewards } from "../rewards/rewardPools";

export const defaultPreferences = (): Preferences => ({
  theme: "system",
  reduceMotion: false,
  sound: false,
  dayStart: 0,
  bigRewardCap: null,
});
export const emptyNotebook = (): Notebook => ({
  version: 2,
  revision: 0,
  tasks: [],
  rewards: starterRewards(),
  events: [],
  preferences: defaultPreferences(),
  onboarded: false,
});
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const id = (v: unknown): v is string =>
  text(v) && v.length > 0 && v.length <= 200;
const title = (v: unknown): v is string => text(v) && v.trim().length > 0;
const oneOf = (v: unknown, values: unknown[]) => values.includes(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const iso = (v: unknown): v is string =>
  text(v) && Number.isFinite(new Date(v).getTime());
const time = (v: unknown) =>
  v === "" || (text(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
const isReward = (v: unknown): v is Reward =>
  object(v) &&
  id(v.id) &&
  title(v.title) &&
  oneOf(v.size, ["small", "medium", "big"]) &&
  typeof v.active === "boolean";
const isSchedule = (s: unknown): s is Schedule =>
  object(s) &&
  oneOf(s.kind, ["once", "daily", "weekly", "monthly", "after"]) &&
  (s.start === null
    ? s.kind === "once"
    : validDate(s.start) && s.start <= "9900-12-31") &&
  time(s.time) &&
  integer(s.every, 1, 365) &&
  Array.isArray(s.weekdays) &&
  s.weekdays.every((d) => integer(d, 0, 6)) &&
  (s.kind !== "weekly" || s.weekdays.length > 0) &&
  integer(s.monthDay, 1, 31) &&
  oneOf(s.unit, ["hours", "days", "weeks"]) &&
  (s.nthWeekday === undefined ||
    (object(s.nthWeekday) &&
      oneOf(s.nthWeekday.nth, [-1, 1, 2, 3, 4]) &&
      integer(s.nthWeekday.weekday, 0, 6)));
const isTask = (t: unknown): t is Task =>
  object(t) &&
  id(t.id) &&
  title(t.title) &&
  text(t.notes) &&
  oneOf(t.effort, ["light", "solid", "heavy"]) &&
  oneOf(t.status, ["active", "paused", "archived"]) &&
  iso(t.createdAt) &&
  isSchedule(t.schedule);
const isEvent = (e: unknown): e is JournalEvent => {
  if (!object(e) || !id(e.id) || !iso(e.at)) return false;
  if (e.type === "undone" || e.type === "enjoyed") return id(e.target);
  if (!id(e.taskId) || !text(e.period) || !e.period) return false;
  if (e.type === "snoozed") return validDate(e.until);
  if (!title(e.taskTitle)) return false;
  if (e.type === "skipped") return true;
  return (
    e.type === "completed" &&
    typeof e.roll === "number" &&
    e.roll >= 0 &&
    e.roll < 1 &&
    (e.reward === null || isReward(e.reward))
  );
};
const unique = (entries: { id: string }[]) =>
  new Set(entries.map((e) => e.id)).size === entries.length;
export const parseNotebook = (value: unknown): Notebook => {
  if (
    !object(value) ||
    value.version !== 2 ||
    !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(isTask) ||
    !Array.isArray(value.rewards) ||
    !value.rewards.every(isReward) ||
    !Array.isArray(value.events) ||
    !value.events.every(isEvent) ||
    !unique(value.tasks) ||
    !unique(value.rewards) ||
    !unique(value.events) ||
    typeof value.onboarded !== "boolean"
  )
    throw new Error(
      "This isn't a valid Skibo backup. Your notebook has not been replaced.",
    );
  const prefs = value.preferences;
  if (
    !object(prefs) ||
    !oneOf(prefs.theme, ["system", "light", "dark"]) ||
    typeof prefs.reduceMotion !== "boolean" ||
    typeof prefs.sound !== "boolean" ||
    !integer(prefs.dayStart, 0, 12) ||
    !(prefs.bigRewardCap === null || integer(prefs.bigRewardCap, 0, 100))
  )
    throw new Error("The backup contains invalid preferences.");
  const seen = new Map<string, JournalEvent>();
  const taskIds = new Set(value.tasks.map((t) => t.id));
  for (const event of value.events) {
    if ("taskId" in event && !taskIds.has(event.taskId))
      throw new Error("The backup contains history for an unknown task.");
    if (event.type === "undone" || event.type === "enjoyed") {
      const target = seen.get(event.target);
      if (
        !target ||
        target.type === "undone" ||
        (event.type === "enjoyed" &&
          (target.type !== "completed" || !target.reward))
      )
        throw new Error("The backup contains an invalid history reference.");
    }
    seen.set(event.id, event);
  }
  return value as unknown as Notebook;
};

// The old key is left intact, including on any import failure.
export const importLegacy = (value: unknown): Notebook => {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.rewardEvents) ||
    !Array.isArray(value.occurrences)
  )
    throw new Error(
      "The old notebook could not be read. Export or recover the original sb:root before continuing.",
    );
  const data = emptyNotebook();
  const effort = { easy: "light", medium: "solid", hard: "heavy" } as const;
  data.tasks = value.tasks.map((input): Task => {
    if (
      !object(input) ||
      !id(input.id) ||
      !title(input.title) ||
      !iso(input.createdAtIso) ||
      !oneOf(input.difficulty, Object.keys(effort))
    )
      throw new Error("An old task could not be imported.");
    const r = object(input.recurrence) ? input.recurrence : null;
    const anchor =
      r && iso(r.anchorIso)
        ? new Date(r.anchorIso)
        : new Date(input.createdAtIso);
    const due = iso(input.dueAtIso) ? new Date(input.dueAtIso) : null;
    const schedule: Schedule = {
      kind:
        input.kind === "deadline"
          ? "once"
          : r?.kind === "interval"
            ? "after"
            : oneOf(r?.kind, ["daily", "weekly", "monthly"])
              ? (r!.kind as Schedule["kind"])
              : "daily",
      start:
        input.kind === "deadline"
          ? due
            ? dateKey(due)
            : null
          : dateKey(anchor),
      time: due
        ? `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`
        : "",
      every: integer(r?.interval, 1, 365) ? r.interval : 1,
      weekdays:
        Array.isArray(r?.daysOfWeek) && r.daysOfWeek.length
          ? (r.daysOfWeek as number[])
          : [anchor.getDay()],
      monthDay: integer(r?.dayOfMonth, 1, 31) ? r.dayOfMonth : anchor.getDate(),
      unit: oneOf(r?.intervalUnit, ["hours", "days", "weeks"])
        ? (r!.intervalUnit as Schedule["unit"])
        : "days",
      ...(object(r?.nthWeekday)
        ? { nthWeekday: r.nthWeekday as unknown as Schedule["nthWeekday"] }
        : {}),
    };
    return {
      id: input.id,
      title: input.title,
      notes: text(input.notes) ? input.notes : "",
      effort: effort[input.difficulty as keyof typeof effort],
      status: input.archivedAtIso
        ? "archived"
        : input.active === false
          ? "paused"
          : "active",
      schedule,
      createdAt: input.createdAtIso,
    };
  });
  data.rewards = REWARD_SUGGESTIONS.map((r) => ({ ...r }));
  const taskMap = new Map(data.tasks.map((t) => [t.id, t]));
  const importedPeriods = new Set<string>();
  const events: Completion[] = value.rewardEvents.map((input): Completion => {
    if (
      !object(input) ||
      !id(input.id) ||
      !id(input.taskId) ||
      !iso(input.createdAtIso) ||
      !taskMap.has(input.taskId) ||
      typeof input.roll !== "number" ||
      typeof input.triggered !== "boolean"
    )
      throw new Error("Old completion history could not be imported.");
    const task = taskMap.get(input.taskId)!;
    const period = text(input.occurrenceId)
      ? input.occurrenceId
      : `${task.id}:legacy:${input.id}`;
    importedPeriods.add(period);
    const reward = data.rewards.find((r) => r.id === input.rewardId);
    return {
      id: input.id,
      type: "completed",
      taskId: task.id,
      taskTitle: task.title,
      period: task.schedule.kind === "once" ? `${task.id}:once` : period,
      at: input.createdAtIso,
      roll: input.roll,
      reward: input.triggered
        ? (reward ?? {
            id: `legacy-${input.id}`,
            title: "Reward from your previous notebook",
            size: "small",
            active: true,
          })
        : null,
    };
  });
  for (const input of value.occurrences) {
    if (!object(input) || !iso(input.completedAtIso)) continue;
    if (
      !id(input.taskId) ||
      !taskMap.has(input.taskId) ||
      !text(input.occurrenceId)
    )
      throw new Error("An old completed task could not be imported.");
    if (importedPeriods.has(input.occurrenceId)) continue;
    const task = taskMap.get(input.taskId)!;
    events.push({
      id: `legacy-occ-${input.occurrenceId}`,
      type: "completed",
      taskId: task.id,
      taskTitle: task.title,
      period:
        task.schedule.kind === "once" ? `${task.id}:once` : input.occurrenceId,
      at: input.completedAtIso,
      roll: 0.999,
      reward: null,
    });
  }
  data.events = events.sort((a, b) => a.at.localeCompare(b.at));
  data.onboarded = data.tasks.length > 0;
  if (object(value.prefs) && typeof value.prefs.reduceMotion === "boolean")
    data.preferences.reduceMotion = value.prefs.reduceMotion;
  return parseNotebook(data);
};
export const readBackup = (json: string): Notebook => {
  const value: unknown = JSON.parse(json);
  return object(value) && value.version === 1
    ? importLegacy(value)
    : parseNotebook(value);
};
