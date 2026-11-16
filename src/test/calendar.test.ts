import { describe, expect, it } from "vitest";
import { task } from "./fixtures";
import { emptyNotebook } from "../lib/persistence/notebook";
import {
  addDays,
  dayKey,
  matchesDay,
  nextCalendarDay,
} from "../lib/schedule/calendar";
import { periodFor } from "../lib/tasks/taxonomy";
import { completePeriod } from "../lib/tasks/actions";

describe("local calendar periods", () => {
  it("keeps calendar dates across DST and applies the day-start boundary", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(dayKey(new Date("2026-03-08T03:30:00"), 4)).toBe("2026-03-07");
    expect(dayKey(new Date("2026-03-08T04:00:00"), 4)).toBe("2026-03-08");
  });
  it("keeps one overdue period after weeks of inactivity and advances from the completion day", () => {
    const data = emptyNotebook();
    data.tasks = [task()];
    const now = new Date("2026-03-08T14:00:00");
    const p = periodFor(data.tasks[0], [], now, data.preferences);
    expect(p.date).toBe("2026-01-31");
    expect(p.bucket).toBe("late");
    const completed = completePeriod(
      data,
      p,
      now,
      { float01: () => 0.9 },
      "done",
    )!;
    data.events.push(completed);
    const next = periodFor(data.tasks[0], data.events, now, data.preferences);
    expect(next.date).toBe("2026-03-09");
    expect(next.bucket).toBe("done");
  });
  it("uses the actual local weekday and honors multi-week anchors", () => {
    const s = task({
      kind: "weekly",
      start: "2026-11-15",
      weekdays: [0],
      every: 2,
    }).schedule;
    expect(nextCalendarDay(s, "2026-11-15")).toBe("2026-11-15");
    expect(nextCalendarDay(s, "2026-11-16")).toBe("2026-11-29");
    expect(matchesDay(s, "2026-11-14")).toBe(false);
  });
  it("clamps month ends and supports last weekdays", () => {
    const s = task({ kind: "monthly" }).schedule;
    expect(nextCalendarDay(s, "2026-02-01")).toBe("2026-02-28");
    expect(nextCalendarDay(s, "2026-03-01")).toBe("2026-03-31");
    expect(
      nextCalendarDay(
        { ...s, nthWeekday: { nth: -1, weekday: 5 } },
        "2026-02-01",
      ),
    ).toBe("2026-02-27");
  });
  it("reschedules after-completion routines from actual completion, including hours", () => {
    const data = emptyNotebook();
    data.tasks = [task({ kind: "after", every: 3 })];
    const now = new Date("2026-03-07T14:00:00");
    const p = periodFor(data.tasks[0], [], now, data.preferences);
    data.events.push(
      completePeriod(data, p, now, { float01: () => 0.9 }, "done")!,
    );
    expect(
      periodFor(data.tasks[0], data.events, now, data.preferences).date,
    ).toBe("2026-03-10");
    const hourly = {
      ...data.tasks[0],
      schedule: { ...data.tasks[0].schedule, every: 1, unit: "hours" as const },
    };
    expect(periodFor(hourly, data.events, now, data.preferences).time).toBe(
      "15:00",
    );
    expect(
      periodFor(
        hourly,
        data.events,
        new Date("2026-03-07T15:01:00"),
        data.preferences,
      ).bucket,
    ).toBe("today");
  });
});

it("keeps an overnight hourly recurrence in the configured day", () => {
  const data = emptyNotebook();
  data.preferences.dayStart = 4;
  data.tasks = [task({ kind: "after", every: 1, unit: "hours" })];
  const now = new Date("2026-11-15T00:30:00");
  const period = periodFor(data.tasks[0], [], now, data.preferences);
  data.events.push(
    completePeriod(data, period, now, { float01: () => 0.9 }, "night")!,
  );
  const next = periodFor(
    data.tasks[0],
    data.events,
    new Date("2026-11-15T01:31:00"),
    data.preferences,
  );
  expect(next.date).toBe("2026-11-14");
  expect(next.bucket).toBe("today");
});

it("lets a recurring task become a new one-off without resolving it from old history", () => {
  const data = emptyNotebook();
  const original = task({ start: "2026-11-14" });
  data.tasks = [original];
  const completedAt = new Date("2026-11-14T12:00:00");
  data.events.push(
    completePeriod(
      data,
      periodFor(original, [], completedAt, data.preferences),
      completedAt,
      { float01: () => 0.9 },
      "routine",
    )!,
  );
  const once = {
    ...original,
    schedule: {
      ...original.schedule,
      kind: "once" as const,
      start: "2026-11-16",
    },
  };
  const due = periodFor(
    once,
    data.events,
    new Date("2026-11-16T12:00:00"),
    data.preferences,
  );
  expect(due.bucket).toBe("today");
  expect(due.key).toBe(`${original.id}:2026-11-16:start:r1:unit:0`);
});
it("uses distinct hourly periods for the repeated DST hour", () => {
  const data = emptyNotebook();
  data.tasks = [
    task({
      kind: "after",
      start: "2026-11-01",
      time: "01:30",
      unit: "hours",
      every: 1,
    }),
  ];
  const firstTime = new Date("2026-11-01T01:30:00-04:00");
  const firstPeriod = periodFor(data.tasks[0], [], firstTime, data.preferences);
  data.events.push(
    completePeriod(
      data,
      firstPeriod,
      firstTime,
      { float01: () => 0 },
      "first-hour",
    )!,
  );
  const secondTime = new Date("2026-11-01T01:30:00-05:00");
  const secondPeriod = periodFor(
    data.tasks[0],
    data.events,
    secondTime,
    data.preferences,
  );
  expect(secondPeriod.key).not.toBe(firstPeriod.key);
  expect(
    completePeriod(
      data,
      secondPeriod,
      secondTime,
      { float01: () => 0.9 },
      "second-hour",
    )?.roll,
  ).toBe(0.9);
});
