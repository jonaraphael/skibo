import { expect, it } from "vitest";
import { Task } from "../app/types";
import { emptyNotebook } from "../lib/persistence/notebook";
import { nextCalendarDay } from "../lib/schedule/calendar";
import { completePeriod } from "../lib/tasks/actions";
import { taskHistory } from "../lib/tasks/history";
import { activeHolds, periodFor, targetMisses } from "../lib/tasks/taxonomy";
import { task } from "./fixtures";

const makeTask = (schedule: Partial<Task["schedule"]> = {}) =>
  task({ weekdaysOnly: true, start: "2026-10-30", ...schedule });
const dataFor = (task: Task) => {
  const data = emptyNotebook();
  data.preferences.dayStart = 4;
  data.tasks = [task];
  return data;
};

it("skips weekend deliveries and history squares when returning on Monday", () => {
  const t = makeTask();
  const data = dataFor(t);
  const monday = new Date("2026-11-02T04:00:00");
  expect(taskHistory(t, [], monday, data.preferences).map((d) => d.date))
    .toEqual(["2026-10-30", "2026-11-02"]);
  t.behavior.payoff = "more";
  const period = (now: Date) => periodFor(t, [], now, data.preferences);
  const friday = period(new Date("2026-10-31T03:59:59"));
  expect(friday.detail).toBe("1 session owed");
  for (const time of ["2026-10-31T04:00:00", "2026-11-02T03:59:59"]) {
    const weekend = new Date(time);
    expect(period(weekend)).toMatchObject({ bucket: "later", detail: "1 session owed" });
    expect(completePeriod(data, friday, weekend, { float01: () => 0 }, "stale")).toBeNull();
  }
  expect(period(monday)).toMatchObject({ bucket: "anytime", detail: "2 sessions owed" });
});

it("skips weekend target rounds during catch-up and counts only weekdays for pace", () => {
  const t = makeTask();
  t.behavior = { ...t.behavior, payoff: "more", cost: "cliff", goal: 3 };
  const data = dataFor(t);
  const monday = new Date("2026-11-02T12:00:00");
  const missed = targetMisses(data, monday);
  expect(missed).toHaveLength(1);
  expect(missed[0]).toMatchObject({ period: "walk:2026-10-30:window:r1:unit:miss" });
  data.events.push(...missed);
  expect(targetMisses(data, monday)).toEqual([]);
  expect(activeHolds(data, monday)).toEqual([]);

  // One of three units done Friday is on pace for a Tuesday deadline on Monday.
  t.schedule.kind = "once";
  t.schedule.start = "2026-11-03";
  const friday = new Date("2026-10-30T12:00:00");
  const open = periodFor(t, data.events, friday, data.preferences);
  data.events.push(completePeriod(data, open, friday, { float01: () => 0.9 }, "friday")!);
  expect(activeHolds(data, monday)).toEqual([]);
  expect(activeHolds(data, new Date("2026-11-03T04:00:00"))).toHaveLength(1);
});

it("pauses an hourly completion clock at day start across a DST weekend", () => {
  const t = makeTask({ kind: "after", unit: "hours", every: 4, time: "03:00" });
  t.behavior.cost = "cliff";
  t.behavior.lead = 1;
  const data = dataFor(t);
  const period = (time: string) => periodFor(t, [], new Date(time), data.preferences);
  // The Friday notebook day includes Saturday at 3 AM. One working hour
  // passes before the weekend, leaving two hours until the hold on Monday.
  expect(period("2026-10-31T03:59:59").drawEligible).toBe(false);
  expect(period("2026-11-01T12:00:00")).toMatchObject({
    bucket: "later", hold: null, pastDue: false, drawEligible: false,
  });
  expect(period("2026-11-02T04:29:59").drawEligible).toBe(false);
  expect(period("2026-11-02T04:30:00").drawEligible).toBe(true);
  expect(period("2026-11-02T05:59:59").hold).toBeNull();
  expect(period("2026-11-02T06:00:00").hold).toBeTruthy();
});

it("releases an overdue task's tray hold for the weekend and restores it on Monday", () => {
  const t = makeTask({ kind: "once" });
  t.behavior.cost = "cliff";
  const data = dataFor(t);
  const holds = (time: string) => activeHolds(data, new Date(time));
  expect(holds("2026-10-31T03:59:59")).toHaveLength(1);
  expect(holds("2026-10-31T04:00:00")).toHaveLength(0);
  expect(holds("2026-11-02T03:59:59")).toHaveLength(0);
  expect(holds("2026-11-02T04:00:00")).toHaveLength(1);
});

it("keeps calendar anchors, skips weekend-only recurrences, and defers one-offs to Monday", () => {
  const start = "2026-10-31";
  const next = (schedule: Partial<Task["schedule"]>) =>
    nextCalendarDay(makeTask({ start, ...schedule }).schedule, start);
  expect(next({ kind: "weekly", weekdays: [0, 3, 6] })).toBe("2026-11-04");
  expect(next({ kind: "monthly", monthDay: 31 })).toBe("2026-11-30");
  expect(next({ kind: "once" })).toBe("2026-11-02");
  expect(next({ kind: "daily", every: 7 })).toBeNull();
  expect(next({ kind: "weekly", weekdays: [6] })).toBeNull();
  expect(next({ kind: "monthly", nthWeekday: { nth: 1, weekday: 0 } })).toBeNull();
});
