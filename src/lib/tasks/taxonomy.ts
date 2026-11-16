import {
  JournalEvent,
  Notebook,
  Preferences,
  Schedule,
  Task,
  TaskBehavior,
  TaskPeriod,
} from "../../app/types";
import {
  addDays,
  dayKey,
  daysBetween,
  liveEvents,
  nextCalendarDay,
  prettyDate,
} from "../schedule/calendar";

export type TaskType =
  | "Target"
  | "Backlog"
  | "Lapse"
  | "Practice"
  | "Deadline"
  | "Start date"
  | "Tank"
  | "Upkeep";
export const taskType = (
  schedule: Schedule,
  behavior: TaskBehavior,
): TaskType => {
  if (schedule.kind === "after")
    return behavior.payoff === "more"
      ? behavior.cost === "cliff"
        ? "Lapse"
        : "Practice"
      : behavior.cost === "cliff"
        ? "Tank"
        : "Upkeep";
  return behavior.payoff === "more"
    ? behavior.cost === "cliff"
      ? "Target"
      : "Backlog"
    : behavior.cost === "cliff"
      ? "Deadline"
      : "Start date";
};
export const defaultBehavior = (today: string): TaskBehavior => ({
  payoff: "accrues",
  cost: "ramp",
  windowStart: today,
  goal: 1,
  unitLabel: "session",
  lead: 1,
  opening: 0.5,
});
export const defaultSchedule = (today: string): Schedule => ({
  kind: "after",
  start: today,
  time: "",
  every: 7,
  weekdays: [new Date(`${today}T12:00:00`).getDay()],
  monthDay: new Date(`${today}T12:00:00`).getDate(),
  unit: "days",
});
export const clockDate = (
  key: string,
  time: string,
  prefs: Preferences,
): Date => {
  const result = new Date(
    `${key}T${time || `${String(prefs.dayStart).padStart(2, "0")}:00`}:00`,
  );
  if (time && result.getHours() < prefs.dayStart)
    result.setDate(result.getDate() + 1);
  return result;
};
const shift = (date: Date, amount: number, unit: Schedule["unit"]): Date => {
  if (unit === "hours") return new Date(date.getTime() + amount * 3_600_000);
  const days = amount * (unit === "weeks" ? 7 : 1);
  const result = new Date(date);
  result.setDate(result.getDate() + Math.floor(days));
  result.setTime(result.getTime() + (days - Math.floor(days)) * 86_400_000);
  return result;
};
const resolutions = (task: Task, events: JournalEvent[]) =>
  liveEvents(events).filter(
    (e): e is Extract<JournalEvent, { taskId: string }> =>
      "taskId" in e &&
      e.taskId === task.id &&
      e.period.includes(`:r${task.rhythmRevision}:`) &&
      (e.type === "completed" || e.type === "skipped"),
  );
const inRound = (period: string, round: string) =>
  period.startsWith(`${round}:unit:`);
const roundEvents = (history: ReturnType<typeof resolutions>, round: string) =>
  history.filter((e) => inRound(e.period, round));
const boundary = (task: Task, date: string, prefs: Preferences) =>
  clockDate(date, task.schedule.time, prefs);
const closes = (task: Task, date: string, prefs: Preferences) =>
  task.schedule.time
    ? boundary(task, date, prefs)
    : clockDate(addDays(date, 1), "", prefs);
const next = (task: Task, date: string) =>
  task.schedule.kind === "once"
    ? null
    : nextCalendarDay(task.schedule, addDays(date, 1));
const first = (task: Task) =>
  task.schedule.kind === "once"
    ? task.schedule.start
    : nextCalendarDay(task.schedule, task.schedule.start);

export const periodFor = (
  task: Task,
  events: JournalEvent[],
  now: Date,
  prefs: Preferences,
): TaskPeriod => {
  const s = task.schedule,
    b = task.behavior,
    type = taskType(s, b);
  const today = dayKey(now, prefs.dayStart);
  const history = resolutions(task, events);
  const completed = history.filter((e) => e.type === "completed");
  const last = history.at(-1);
  const lastDone = completed.at(-1);
  let round = `${task.id}:after:${history.length}:r${task.rhythmRevision}`;
  let date: string | null = s.start;
  let opens = boundary(task, s.start, prefs);
  let due: Date | null = null;
  let done = false;
  let count = 0;
  let goal: number | undefined;
  let hold: string | null = null;
  let drawEligible = true;
  let detail = "";

  if (s.kind === "after") {
    const anchor = last ? new Date(last.at) : opens;
    opens = anchor;
    due = shift(anchor, s.every - (b.cost === "cliff" ? b.lead : 0), s.unit);
    date = dayKey(due, prefs.dayStart);
    const idle = lastDone
      ? dayKey(new Date(lastDone.at), prefs.dayStart)
      : s.start;
    const idleDays = Math.max(0, daysBetween(idle, today));
    if (type === "Practice") {
      due = null;
      detail = `${idleDays} idle day${idleDays === 1 ? "" : "s"} · draw every ${b.unitLabel}`;
    } else {
      if (b.payoff === "accrues") {
        const rewardOpens = new Date(
          anchor.getTime() + (due.getTime() - anchor.getTime()) * b.opening,
        );
        drawEligible = now >= rewardOpens;
        detail = drawEligible
          ? "Draw available · doing it restarts the clock"
          : `Early reset · no draw until ${prettyDate(dayKey(rewardOpens, prefs.dayStart))} ${rewardOpens.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      } else
        detail = `Draw every ${b.unitLabel} · next due ${prettyDate(date)}`;
      if (type === "Upkeep") {
        const overdue = Math.max(0, daysBetween(date, today));
        detail = `${overdue} day${overdue === 1 ? "" : "s"} past due · ${detail}`;
      }
      if (b.cost === "cliff" && now >= due)
        hold = `Due ${prettyDate(date)} · complete one ${b.unitLabel} or declare a miss`;
    }
  } else if (type === "Backlog") {
    let deliveries = 0;
    for (
      let day: string | null = first(task);
      day && boundary(task, day, prefs) <= now;
      day = next(task, day)
    )
      deliveries++;
    const owed = Math.max(0, deliveries * b.goal - history.length);
    round = `${task.id}:backlog:r${task.rhythmRevision}`;
    count = history.length;
    goal = deliveries * b.goal;
    done = owed === 0 && deliveries > 0;
    date = s.start;
    detail = `${owed} ${b.unitLabel}${owed === 1 ? "" : "s"} owed · draw for every unit`;
  } else if (type === "Start date") {
    let day: string | null = first(task);
    if (
      last &&
      (s.kind !== "once" ||
        inRound(
          last.period,
          `${task.id}:${s.start}:start:r${task.rhythmRevision}`,
        ))
    ) {
      const lastRound = last.period.slice(
        task.id.length + 1,
        task.id.length + 11,
      );
      const from =
        lastRound > dayKey(new Date(last.at), prefs.dayStart)
          ? lastRound
          : dayKey(new Date(last.at), prefs.dayStart);
      day = s.kind === "once" ? null : nextCalendarDay(s, addDays(from, 1));
    }
    done = day === null;
    date = day ?? s.start;
    round = `${task.id}:${date}:start:r${task.rhythmRevision}`;
    opens = boundary(task, date!, prefs);
    due = opens;
    const lost = Math.max(0, daysBetween(date!, today));
    detail = `${lost} day${lost === 1 ? "" : "s"} lost · one draw from ${prettyDate(date!)}`;
  } else {
    let day = first(task);
    let opening = b.windowStart;
    // Targets close at their real deadline. Deadlines remain available late.
    for (;;) {
      round = `${task.id}:${day}:window:r${task.rhythmRevision}`;
      const entries = roundEvents(history, round);
      const resolved =
        type === "Target"
          ? now >= closes(task, day, prefs)
          : entries.length > 0;
      if (!resolved) break;
      const lastEntry = entries.at(-1);
      const from =
        type === "Deadline" && lastEntry
          ? [day, dayKey(new Date(lastEntry.at), prefs.dayStart)].sort().at(-1)!
          : day;
      const following =
        s.kind === "once" ? null : nextCalendarDay(s, addDays(from, 1));
      if (!following) {
        done = true;
        break;
      }
      opening = addDays(from, 1);
      day = following;
    }
    round = `${task.id}:${day}:window:r${task.rhythmRevision}`;
    const entries = roundEvents(history, round);
    count = entries.filter((e) => e.type === "completed").length;
    goal = type === "Target" ? b.goal : undefined;
    done ||= type === "Target" && entries.some((e) => e.type === "skipped");
    date = day;
    opens = boundary(task, opening, prefs);
    due = shift(boundary(task, day, prefs), -b.lead, "days");
    if (due < opens) due = opens;
    const actedToday = entries.some(
      (e) => dayKey(new Date(e.at), prefs.dayStart) === today,
    );
    if (type === "Target") {
      const totalDays = Math.max(1, daysBetween(opening, day) + 1);
      const elapsed = Math.max(
        0,
        Math.min(totalDays, daysBetween(opening, today)),
      );
      const pace = Math.ceil((b.goal * elapsed) / totalDays);
      if (!done && now >= opens && count < pace && !actedToday)
        hold = `Behind pace (${count}/${b.goal}) · do one ${b.unitLabel} today or declare a miss`;
      detail = `${count}/${b.goal} ${b.unitLabel}s · by ${prettyDate(day)} · draw for every unit`;
    } else {
      if (!done && now >= due)
        hold = `Due ${prettyDate(dayKey(due, prefs.dayStart))} · complete or declare a miss`;
      detail = `One draw in this window · deadline ${prettyDate(day)}`;
    }
  }
  const snooze = liveEvents(events)
    .filter(
      (e) =>
        e.type === "snoozed" &&
        e.taskId === task.id &&
        inRound(e.period, round),
    )
    .at(-1);
  let bucket: TaskPeriod["bucket"] = done
    ? "done"
    : now < opens
      ? "later"
      : snooze?.type === "snoozed" && snooze.until > today && !hold
        ? "later"
        : due && now >= due
          ? dayKey(due, prefs.dayStart) < today
            ? "late"
            : "today"
          : "anytime";
  if (
    bucket === "later" &&
    lastDone &&
    dayKey(new Date(lastDone.at), prefs.dayStart) === today
  )
    bucket = "done";
  if (done || now < opens) drawEligible = false;
  return {
    task,
    round,
    key: `${round}:unit:${count}`,
    date: due ? dayKey(due, prefs.dayStart) : date,
    time: due
      ? due.toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        })
      : s.time,
    bucket,
    drawEligible,
    hold: done || task.status !== "active" ? null : hold,
    detail,
    ...(goal === undefined
      ? {}
      : {
          progress: { done: type === "Backlog" ? history.length : count, goal },
        }),
  };
};

export const activeHolds = (data: Notebook, now: Date): TaskPeriod[] =>
  data.tasks
    .filter((t) => t.status === "active")
    .map((t) => periodFor(t, data.events, now, data.preferences))
    .filter((p) => p.hold);

// Materialize closed, unmet Target rounds exactly once, including time away.
export const targetMisses = (data: Notebook, now: Date): JournalEvent[] => {
  const misses: JournalEvent[] = [];
  for (const task of data.tasks) {
    if (
      task.status !== "active" ||
      taskType(task.schedule, task.behavior) !== "Target"
    )
      continue;
    const history = resolutions(task, data.events);
    for (
      let day: string | null = first(task);
      day && closes(task, day, data.preferences) <= now;
      day = next(task, day)
    ) {
      const round = `${task.id}:${day}:window:r${task.rhythmRevision}`;
      const entries = roundEvents(history, round);
      const id = `miss:${round}`;
      if (
        entries.some((e) => e.type === "skipped") ||
        entries.filter((e) => e.type === "completed").length >=
          task.behavior.goal ||
        data.events.some((e) => e.id === id)
      )
        continue;
      misses.push({
        id,
        type: "missed",
        taskId: task.id,
        taskTitle: task.title,
        period: `${round}:unit:miss`,
        at: closes(task, day, data.preferences).toISOString(),
      });
    }
  }
  return misses;
};

export const ruleSummary = (s: Schedule, b: TaskBehavior): string => {
  const type = taskType(s, b);
  const draws =
    b.payoff === "more"
      ? `A 30% draw for every ${b.unitLabel}.`
      : s.kind === "after"
        ? `A 30% draw from ${Math.round(b.opening * 100)}% of the way to due. Earlier completions reset the clock without a draw.`
        : "One 30% draw per round, including late completions.";
  const hold =
    type === "Target"
      ? "If behind the daily pace, the tray is held until today's first unit or a declared miss. Unmet rounds close as misses at the deadline."
      : b.cost === "cliff"
        ? `The tray is held ${b.lead} ${s.kind === "after" ? s.unit : "days"} before the real limit, until a completion or declared miss.`
        : "No tray hold. Your waiting count stays visible.";
  const clock =
    s.kind === "after"
      ? `The clock restarts when you finish; the real interval is ${s.every} ${s.unit}.`
      : b.cost === "cliff"
        ? `The first window opens ${prettyDate(b.windowStart)} and ends ${prettyDate(s.start)}.`
        : `The first round starts ${prettyDate(s.start)}.`;
  return `${clock} ${draws} ${hold} Effort changes reward size; odds stay the same.`;
};
