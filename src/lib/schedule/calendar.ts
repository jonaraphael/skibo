import {
  DateKey,
  JournalEvent,
  Preferences,
  Schedule,
  Task,
  TaskPeriod,
} from "../../app/types";

export const dateKey = (date: Date): DateKey =>
  `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const localDate = (key: DateKey): Date => new Date(`${key}T12:00:00`);
export const addDays = (key: DateKey, days: number): DateKey => {
  const date = localDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};
export const dayKey = (date: Date, start = 0): DateKey => {
  const key = dateKey(date);
  return date.getHours() < start ? addDays(key, -1) : key;
};
export const daysBetween = (a: DateKey, b: DateKey): number => {
  const utc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(0);
    date.setUTCFullYear(y, m - 1, d);
    return date.getTime();
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
};
export const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(localDate(value).getTime()) &&
  dateKey(localDate(value)) === value;
export const prettyDate = (
  key: DateKey,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string => localDate(key).toLocaleDateString(undefined, options);
export const weekStart = (key: DateKey): DateKey =>
  addDays(key, -((localDate(key).getDay() + 6) % 7));
export const liveEvents = (events: JournalEvent[]): JournalEvent[] => {
  const undone = new Set(
    events.filter((e) => e.type === "undone").map((e) => e.target),
  );
  return events.filter((e) => e.type !== "undone" && !undone.has(e.id));
};
export const matchesDay = (schedule: Schedule, key: DateKey): boolean => {
  const start = schedule.start ?? key;
  if (key < start) return false;
  const date = localDate(key);
  const anchor = localDate(start);
  const elapsed = daysBetween(start, key);
  if (schedule.kind === "daily") return elapsed % schedule.every === 0;
  if (schedule.kind === "weekly")
    return (
      Math.floor(daysBetween(weekStart(start), weekStart(key)) / 7) %
        schedule.every ===
        0 && schedule.weekdays.includes(date.getDay())
    );
  if (schedule.kind === "monthly") {
    const months =
      (date.getFullYear() - anchor.getFullYear()) * 12 +
      date.getMonth() -
      anchor.getMonth();
    if (months % schedule.every !== 0) return false;
    const lastDay = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    if (schedule.nthWeekday) {
      const { nth, weekday } = schedule.nthWeekday;
      return (
        date.getDay() === weekday &&
        (nth === -1
          ? date.getDate() + 7 > lastDay
          : Math.ceil(date.getDate() / 7) === nth)
      );
    }
    return date.getDate() === Math.min(schedule.monthDay, lastDay);
  }
  return key === start;
};
export const nextCalendarDay = (schedule: Schedule, from: DateKey): DateKey => {
  let key = from < (schedule.start ?? from) ? schedule.start! : from;
  for (let i = 0; i < 134_000; i++, key = addDays(key, 1))
    if (matchesDay(schedule, key)) return key;
  throw new Error("This schedule has no next date.");
};
export const periodFor = (
  task: Task,
  events: JournalEvent[],
  now: Date,
  prefs: Preferences,
): TaskPeriod => {
  const today = dayKey(now, prefs.dayStart);
  const history = liveEvents(events).filter(
    (e) => "taskId" in e && e.taskId === task.id,
  );
  const resolved = history
    .filter((e) => e.type === "completed" || e.type === "skipped")
    .sort((a, b) => a.at.localeCompare(b.at));
  const s = task.schedule;
  const last = (
    s.kind === "once"
      ? resolved.filter((e) => e.period === `${task.id}:once`)
      : resolved
  ).at(-1);
  let date = s.start;
  let time = s.time;
  let afterDue: Date | null = null;
  if (s.kind === "once" && last)
    return { task, key: last.period, date, time, bucket: "done" };
  if (s.kind === "after" && last) {
    const completed = new Date(last.at);
    if (s.unit === "hours") {
      const next = new Date(completed.getTime() + s.every * 3_600_000);
      date = dayKey(next, prefs.dayStart);
      afterDue = next;
      time = `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
    } else
      date = addDays(
        dayKey(completed, prefs.dayStart),
        s.every * (s.unit === "weeks" ? 7 : 1),
      );
  } else if (s.kind !== "once" && s.kind !== "after") {
    const from = last
      ? addDays(dayKey(new Date(last.at), prefs.dayStart), 1)
      : (s.start ?? today);
    date = nextCalendarDay(s, from);
  }
  const key = `${task.id}:${s.kind === "once" ? "once" : afterDue ? afterDue.toISOString() : `${date}:${time}`}`;
  const snooze = history
    .filter((e) => e.type === "snoozed" && e.period === key)
    .at(-1);
  if (snooze?.type === "snoozed" && (!date || snooze.until > date))
    date = snooze.until;
  const doneToday =
    last &&
    last.type === "completed" &&
    dayKey(new Date(last.at), prefs.dayStart) === today;
  let bucket: TaskPeriod["bucket"] = !date
    ? "anytime"
    : date < today
      ? "late"
      : date === today
        ? "today"
        : "later";
  if (afterDue && afterDue > now) bucket = "later";
  if (doneToday && bucket === "later") bucket = "done";
  return { task, key, date, time, bucket };
};
export const scheduleLabel = (s: Schedule): string => {
  if (s.kind === "once")
    return s.start ? prettyDate(s.start) : "Anytime";
  if (s.kind === "daily")
    return s.every === 1 ? "Every day" : `Every ${s.every} days`;
  if (s.kind === "weekly")
    return `${s.every > 1 ? `Every ${s.every} weeks · ` : ""}${s.weekdays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`;
  if (s.kind === "monthly")
    return s.nthWeekday
      ? `Monthly · ${s.nthWeekday.nth === -1 ? "last" : s.nthWeekday.nth} ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.nthWeekday.weekday]}`
      : `Monthly · day ${s.monthDay}`;
  return `${s.every} ${s.unit} after done`;
};
