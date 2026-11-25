import { DateKey, JournalEvent, Schedule } from "../../app/types";

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
export const isWeekday = (key: DateKey): boolean => {
  const day = localDate(key).getDay();
  return day !== 0 && day !== 6;
};
export const nextWeekday = (key: DateKey): DateKey => {
  const day = localDate(key).getDay();
  return day === 6 ? addDays(key, 2) : day === 0 ? addDays(key, 1) : key;
};
export const isTaskDay = (s: Schedule, key: DateKey): boolean =>
  !s.weekdaysOnly || isWeekday(key);
export const fallsOnlyOnWeekends = (s: Schedule): boolean => {
  if (!s.weekdaysOnly) return false;
  if (s.kind === "weekly") return !s.weekdays.some((d) => d > 0 && d < 6);
  if (s.kind === "monthly" && s.nthWeekday) return [0, 6].includes(s.nthWeekday.weekday);
  return s.kind === "daily" && s.every % 7 === 0 && !isWeekday(s.start);
};
// Count days in [from, to), excluding weekends when the task takes them off.
export const taskDaysBetween = (s: Schedule, from: DateKey, to: DateKey): number => {
  const days = daysBetween(from, to);
  if (!s.weekdaysOnly || days <= 0) return days;
  const start = localDate(from).getDay();
  let count = Math.floor(days / 7) * 5;
  for (let i = 0; i < days % 7; i++) {
    const weekday = (start + i) % 7;
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
};
export const liveEvents = (events: JournalEvent[]): JournalEvent[] => {
  const undone = new Set(
    events.filter((e) => e.type === "undone").map((e) => e.target),
  );
  return events.filter(
    (e) =>
      e.type !== "undone" &&
      !undone.has(e.id) &&
      ((e.type !== "enjoyed" && e.type !== "redrawn") || !undone.has(e.target)),
  );
};
const monthlyDate = (s: Schedule, year: number, month: number): Date => {
  const last = new Date(year, month + 1, 0, 12);
  if (!s.nthWeekday) {
    last.setDate(Math.min(s.monthDay, last.getDate()));
    return last;
  }
  const { nth, weekday } = s.nthWeekday;
  if (nth === -1) {
    last.setDate(last.getDate() - (last.getDay() - weekday + 7) % 7);
    return last;
  }
  const first = new Date(year, month, 1, 12);
  first.setDate(1 + (weekday - first.getDay() + 7) % 7 + (nth - 1) * 7);
  return first;
};
export const matchesDay = (schedule: Schedule, key: DateKey): boolean => {
  const start = schedule.start;
  if (key < start || !isTaskDay(schedule, key)) return false;
  if (schedule.kind === "once")
    return key === (schedule.weekdaysOnly ? nextWeekday(start) : start);
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
    return months % schedule.every === 0 &&
      date.getDate() === monthlyDate(schedule, date.getFullYear(), date.getMonth()).getDate();
  }
  return key === start;
};
export const nextCalendarDay = (schedule: Schedule, from: DateKey): DateKey | null => {
  let key = from < schedule.start ? schedule.start : from;
  if (schedule.kind === "once") {
    const date = schedule.weekdaysOnly ? nextWeekday(schedule.start) : schedule.start;
    return date >= key ? date : null;
  }
  // Sparse intervals can fall entirely on weekends. Do not scan forever
  // when a valid calendar rule has no eligible occurrence.
  if (fallsOnlyOnWeekends(schedule)) return null;
  if (schedule.kind === "monthly") {
    const start = localDate(schedule.start);
    const date = localDate(key);
    const elapsed = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
    let month = start.getMonth() + Math.floor(elapsed / schedule.every) * schedule.every;
    // The Gregorian weekday pattern repeats every 400 years.
    for (let i = 0; i < 4800; i++, month += schedule.every) {
      const candidate = monthlyDate(schedule, start.getFullYear(), month);
      if (candidate.getFullYear() > 9999) return null;
      const day = dateKey(candidate);
      if (day >= key && isTaskDay(schedule, day)) return day;
    }
    return null;
  }
  for (let i = 0; i < 134_000; i++, key = addDays(key, 1))
    if (matchesDay(schedule, key)) return key;
  throw new Error("This schedule has no next date.");
};
export const scheduleLabel = (s: Schedule): string => {
  if (s.kind === "once") return prettyDate(s.start);
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
