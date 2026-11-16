import {
  JournalEvent,
  Notebook,
  Preferences,
  Reward,
  Schedule,
  Task,
} from "../../app/types";
import { validDate } from "../schedule/calendar";
import { defaultRewards } from "../rewards/rewardPools";

export const defaultPreferences = (): Preferences => ({
  theme: "system",
  reduceMotion: false,
  sound: false,
  dayStart: 0,
  bigRewardCap: 1,
});
export const emptyNotebook = (): Notebook => ({
  version: 2,
  revision: 0,
  tasks: [],
  rewards: defaultRewards(),
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

export const readBackup = (json: string): Notebook =>
  parseNotebook(JSON.parse(json));
