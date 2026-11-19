import {
  Completion,
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
  scheduleLabel,
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
export const isRepeatable = (task: Task) =>
  task.behavior.payoff === "more";
export const completedRepeat = (period: TaskPeriod) =>
  isRepeatable(period.task) && period.completedToday > 0;
export const completedRepeatsLast = (a: TaskPeriod, b: TaskPeriod) =>
  Number(completedRepeat(a)) - Number(completedRepeat(b));

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
const resolutions = (task: Task, live: JournalEvent[]) =>
  live.filter(
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
// Undo can leave a hole before another live unit. Reuse that unit's own
// period (and saved draw) without colliding with the later completion.
const nextUnit = (
  history: ReturnType<typeof resolutions>,
  keyFor: (index: number) => string,
) => {
  const used = new Set(history.map((e) => e.period));
  let index = 0;
  while (used.has(keyFor(index))) index++;
  return index;
};
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
  const live = liveEvents(events);
  const history = resolutions(task, live);
  const completed = live.filter(
    (e): e is Completion => e.type === "completed" && e.taskId === task.id,
  );
  const last = history.at(-1);
  const lastDone = history.filter((e) => e.type === "completed").at(-1);
  let round: string;
  let unit = 0;
  let date = s.start;
  let opens = boundary(task, s.start, prefs);
  let due: Date | null = null;
  let done = false;
  let count = 0;
  let goal: number | undefined;
  let hold: string | null = null;
  let drawEligible = true;
  let detail = "";

  if (s.kind === "after") {
    const afterRound = (i: number) =>
      `${task.id}:after:${i}:r${task.rhythmRevision}`;
    round = afterRound(nextUnit(history, (i) => `${afterRound(i)}:unit:0`));
    const anchor = last ? new Date(last.at) : opens;
    opens = anchor;
    due = shift(anchor, s.every - (b.cost === "cliff" ? b.lead : 0), s.unit);
    date = dayKey(due, prefs.dayStart);
    if (type === "Practice") {
      due = null;
    } else {
      if (b.payoff === "accrues") {
        const rewardOpens = new Date(
          anchor.getTime() + (due.getTime() - anchor.getTime()) * b.opening,
        );
        drawEligible = now >= rewardOpens;
        if (!drawEligible) detail = "No reward draw yet";
      }
      if (b.cost === "cliff" && now >= due)
        hold = `Complete one ${b.unitLabel} or declare a miss`;
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
    unit = nextUnit(history, (i) => `${round}:unit:${i}`);
    count = history.length;
    goal = deliveries * b.goal;
    done = owed === 0 && deliveries > 0;
    date = s.start;
    detail = `${owed} ${b.unitLabel}${owed === 1 ? "" : "s"} owed`;
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
    opens = boundary(task, date, prefs);
    due = opens;
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
      unit = nextUnit(entries, (i) => `${round}:unit:${i}`);
      const totalDays = Math.max(1, daysBetween(opening, day) + 1);
      const elapsed = Math.max(
        0,
        Math.min(totalDays, daysBetween(opening, today)),
      );
      const pace = Math.ceil((b.goal * elapsed) / totalDays);
      if (!done && now >= opens && count < pace && !actedToday)
        hold = `Behind pace (${count}/${b.goal}) · do one ${b.unitLabel} today or declare a miss`;
      detail = `${count} of ${b.goal} ${b.unitLabel}${b.goal === 1 ? "" : "s"}`;
    } else if (!done && now >= due) {
      hold = "Complete or declare a miss";
    }
  }
  const snooze = live
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
          ? "today"
          : "anytime";
  // A task finished today reads as done while its next round is in the
  // future or has reopened with no draw yet.
  if (
    (bucket === "later" || (bucket === "anytime" && !drawEligible)) &&
    lastDone &&
    dayKey(new Date(lastDone.at), prefs.dayStart) === today
  )
    bucket = "done";
  if (done || now < opens) drawEligible = false;
  // Calendar dates without a time run through the end of the notebook day.
  const pastDue = !done && due !== null && (
    s.kind === "after"
      ? now > due
      : s.time
        ? now > boundary(task, date, prefs)
        : today > date
  );
  return {
    task,
    lastCompletion: completed.at(-1),
    completedToday: completed.filter(
      (e) => dayKey(new Date(e.at), prefs.dayStart) === today,
    ).length,
    pastDue,
    round,
    key: `${round}:unit:${unit}`,
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
  const live = liveEvents(data.events);
  for (const task of data.tasks) {
    if (
      task.status !== "active" ||
      taskType(task.schedule, task.behavior) !== "Target"
    )
      continue;
    const history = resolutions(task, live);
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

export const typeGloss: Record<TaskType, string> = {
  Target: "A total owed by a date.",
  Backlog: "A total that grows daily.",
  Lapse: "A pile forfeited when idle.",
  Practice: "A pile that fades when idle.",
  Deadline: "A state owed by a date.",
  "Start date": "A state owed from a date.",
  Tank: "A reserve that runs dry.",
  Upkeep: "A state that slips daily.",
};

// The rules a task's answers produce, one line per consequence.
export const ruleLines = (
  s: Schedule,
  b: TaskBehavior,
): { label: string; text: string }[] => {
  const type = taskType(s, b);
  const units = s.kind === "after" ? s.unit : "days";
  const lead = `${b.lead} ${b.lead === 1 ? units.replace(/s$/, "") : units}`;
  const once = s.kind === "once";
  const due =
    s.kind === "after"
      ? `${s.every} ${s.unit} after each completion. Finishing restarts the clock.`
      : b.cost === "cliff"
        ? `${once ? "Once, by" : `${scheduleLabel(s)}. First deadline`} ${prettyDate(s.start)}. The window opens ${prettyDate(b.windowStart)}.`
        : `${once ? "Once" : scheduleLabel(s)}, starting ${prettyDate(s.start)}.`;
  const draw =
    b.payoff === "more"
      ? `One draw for every ${b.unitLabel}.`
      : s.kind === "after"
        ? `One draw per round, from ${Math.round(b.opening * 100)}% of the interval on. Earlier completions restart the clock with no draw.`
        : "One draw per round, even after the scheduled date.";
  const hold =
    type === "Target"
      ? `Any day you fall behind pace, until you do one ${b.unitLabel} or declare a miss. An unmet total closes as a miss.`
      : b.cost === "cliff"
        ? `From ${lead} before the real limit, until you complete it or declare a miss. A hold locks the whole tray; a declared miss forfeits that round's draw.`
        : "None.";
  return [
    { label: "Due", text: due },
    { label: "Draw", text: draw },
    { label: "Tray hold", text: hold },
  ];
};

export const ruleSummary = (s: Schedule, b: TaskBehavior): string =>
  ruleLines(s, b)
    .map((line) => line.text)
    .join(" ");
