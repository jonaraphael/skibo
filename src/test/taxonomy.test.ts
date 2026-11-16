import { describe, expect, it } from "vitest";
import { JournalEvent, Notebook, Task } from "../app/types";
import { emptyNotebook, parseNotebook } from "../lib/persistence/notebook";
import { completePeriod, undoEvent } from "../lib/tasks/actions";
import {
  activeHolds,
  defaultBehavior,
  targetMisses,
  periodFor,
  taskType,
  TaskType,
} from "../lib/tasks/taxonomy";
import { task } from "./fixtures";

const at = (day: string) => new Date(`2026-11-${day}`);
const habit = (type: TaskType): Task => {
  const calendar = ["Target", "Backlog", "Deadline", "Start date"].includes(
    type,
  );
  const cliff = ["Target", "Deadline", "Tank", "Lapse"].includes(type);
  const more = ["Target", "Backlog", "Lapse", "Practice"].includes(type);
  return {
    ...task({
      kind: calendar ? "once" : "after",
      start: calendar && cliff ? "2026-11-07" : "2026-11-01",
      every: 7,
    }),
    behavior: {
      ...defaultBehavior("2026-11-01"),
      payoff: more ? "more" : "accrues",
      cost: cliff ? "cliff" : "ramp",
      goal: 7,
    },
  };
};
const notebook = (type: TaskType) => ({
  ...emptyNotebook(),
  tasks: [habit(type)],
});
const period = (data: Notebook, now: Date) =>
  periodFor(data.tasks[0], data.events, now, data.preferences);
const complete = (data: Notebook, now: Date, id: string) => {
  const e = completePeriod(
    data,
    period(data, now),
    now,
    { float01: () => 0.1 },
    id,
  );
  if (e) data.events.push(e);
  return e;
};
const miss = (data: Notebook, now: Date) => {
  const p = period(data, now);
  const e: JournalEvent = {
    id: "skip",
    type: "skipped",
    taskId: p.task.id,
    taskTitle: p.task.title,
    period: p.key,
    at: now.toISOString(),
  };
  data.events.push(e);
};

describe("the eight task behaviors", () => {
  it.each([
    "Target",
    "Backlog",
    "Lapse",
    "Practice",
    "Deadline",
    "Start date",
    "Tank",
    "Upkeep",
  ] as TaskType[])(
    "derives %s from the three answers and validates its notebook",
    (type) => {
      const data = notebook(type),
        t = data.tasks[0];
      expect(taskType(t.schedule, t.behavior)).toBe(type);
      expect(() => parseNotebook(data)).not.toThrow();
    },
  );
  it.each(["Practice", "Lapse", "Target", "Backlog"] as TaskType[])(
    "%s draws for repeated units on the same day, with distinct periods",
    (type) => {
      const data = notebook(type),
        now = at("03T12:00:00");
      const stale = period(data, now);
      const first = complete(data, now, "first")!;
      const second = complete(data, now, "second")!;
      expect(first.roll).toBe(0.1);
      expect(second.roll).toBe(0.1);
      expect(second.period).not.toBe(first.period);
      expect(
        completePeriod(data, stale, now, { float01: () => 0 }, "stale"),
      ).toBeNull();
    },
  );
  it.each(["Tank", "Upkeep"] as TaskType[])(
    "%s records an early reset without consuming randomness and opens at halfway",
    (type) => {
      const data = notebook(type);
      const early = at("02T00:00:00");
      const e = completePeriod(
        data,
        period(data, early),
        early,
        {
          float01: () => {
            throw Error("early completion must not draw");
          },
        },
        "early",
      )!;
      expect(e).toMatchObject({ roll: null, reward: null });
      data.events.push(e);
      const half = type === "Tank" ? at("05T00:00:00") : at("05T12:00:00");
      expect(period(data, new Date(half.getTime() - 1)).drawEligible).toBe(
        false,
      );
      expect(period(data, half).drawEligible).toBe(true);
      expect(period(data, half).hold).toBeNull();
      expect(complete(data, half, "eligible")!.roll).toBe(0.1);
      expect(period(data, half).drawEligible).toBe(false);
    },
  );
  it.each(["Deadline", "Start date"] as TaskType[])(
    "%s pays once in its window and keeps late odds flat",
    (type) => {
      const data = notebook(type),
        now = at("15T12:00:00");
      expect(complete(data, now, "late")!.roll).toBe(0.1);
      expect(complete(data, now, "twice")).toBeNull();
    },
  );
  it("Deadline is available before due, then holds before its real deadline", () => {
    const data = notebook("Deadline");
    expect(period(data, at("02T12:00:00")).drawEligible).toBe(true);
    expect(activeHolds(data, at("05T23:59:59"))).toHaveLength(0);
    expect(activeHolds(data, at("06T00:00:00"))).toHaveLength(1);
    complete(data, at("06T12:00:00"), "done");
    expect(activeHolds(data, at("06T12:00:00"))).toHaveLength(0);
  });
  it.each(["Tank", "Lapse"] as TaskType[])(
    "%s releases its hold on a declared miss, records no completion, and undo restores it",
    (type) => {
      const data = notebook(type),
        now = at("07T12:00:00");
      expect(activeHolds(data, now)).toHaveLength(1);
      miss(data, now);
      expect(activeHolds(data, now)).toHaveLength(0);
      expect(data.events.filter((e) => e.type === "completed")).toHaveLength(0);
      data.events.push(undoEvent(data, "skip", now, "undo")!);
      expect(activeHolds(data, now)).toHaveLength(1);
    },
  );
  it.each(["Upkeep", "Practice", "Backlog", "Start date"] as TaskType[])(
    "%s never holds the tray",
    (type) => {
      const data = notebook(type);
      expect(activeHolds(data, at("30T12:00:00"))).toHaveLength(0);
      expect(period(data, at("30T12:00:00")).detail).toMatch(
        /owed|idle|lost|past due/,
      );
    },
  );
  it("Target releases behind-pace holds for one local day, then closes unmet totals as one automatic miss", () => {
    const data = notebook("Target"),
      now = at("05T12:00:00");
    expect(period(data, now).hold).toMatch(/Behind pace/);
    complete(data, now, "progress");
    expect(period(data, now).hold).toBeNull();
    expect(period(data, at("06T00:00:00")).hold).toMatch(/Behind pace/);
    expect(targetMisses(data, at("07T23:59:59"))).toHaveLength(0);
    const expired = at("08T00:00:00");
    const misses = targetMisses(data, expired);
    expect(misses).toHaveLength(1);
    data.events.push(...misses);
    expect(targetMisses(data, expired)).toHaveLength(0);
    expect(period(data, expired).bucket).toBe("done");
    expect(complete(data, expired, "too-late")).toBeNull();
    expect(() => parseNotebook(data)).not.toThrow();
  });
  it("Target has no finish-line bonus and explicit misses forfeit the rest of the round", () => {
    const data = notebook("Target"),
      now = at("05T12:00:00");
    data.tasks[0].behavior.goal = 2;
    complete(data, now, "one");
    complete(data, now, "two");
    expect(complete(data, now, "three")!.roll).toBe(0.1);
    expect(data.events).toHaveLength(3);
    expect(targetMisses(data, at("09T12:00:00"))).toEqual([]);
    const missed = notebook("Target");
    miss(missed, now);
    expect(activeHolds(missed, now)).toHaveLength(0);
    expect(complete(missed, now, "forfeited")).toBeNull();
    expect(targetMisses(missed, at("09T12:00:00"))).toHaveLength(0);
  });
  it("Backlog carries units forward, pays each unit, and stops when empty", () => {
    const data = notebook("Backlog"),
      now = at("09T12:00:00");
    data.tasks[0].schedule = {
      ...data.tasks[0].schedule,
      kind: "daily",
      every: 7,
    };
    data.tasks[0].behavior.goal = 2;
    expect(period(data, now).detail).toContain("4 sessions owed");
    for (let i = 0; i < 4; i++)
      expect(complete(data, now, String(i))!.roll).toBe(0.1);
    expect(period(data, now).detail).toContain("0 sessions owed");
    expect(complete(data, now, "extra")).toBeNull();
    expect(period(data, at("15T12:00:00")).detail).toContain("2 sessions owed");
  });
  it("reuses an undone unit's draw and its no-draw early reset after reload", () => {
    for (const type of ["Practice", "Tank"] as TaskType[]) {
      let data = notebook(type),
        now = at("02T12:00:00");
      const first = complete(data, now, "first")!;
      data.events.push(undoEvent(data, "first", now, "undo")!);
      data = parseNotebook(JSON.parse(JSON.stringify(data)));
      expect(
        completePeriod(
          data,
          period(data, now),
          now,
          {
            float01: () => {
              throw Error("must reuse");
            },
          },
          "redo",
        ),
      ).toMatchObject({ roll: first.roll, reward: first.reward });
    }
  });
  it("keeps elapsed hours distinct across DST and respects the custom day boundary", () => {
    const data = notebook("Lapse");
    data.tasks[0].schedule = {
      ...data.tasks[0].schedule,
      every: 2,
      unit: "hours",
      time: "00:30",
    };
    data.tasks[0].behavior.lead = 1;
    const first = new Date("2026-11-01T00:30:00-04:00");
    complete(data, first, "first");
    const repeated = new Date("2026-11-01T01:30:00-05:00");
    expect(period(data, repeated).hold).not.toBeNull();
    data.preferences.dayStart = 4;
    const night = new Date("2026-11-15T00:30:00");
    complete(data, night, "night");
    expect(period(data, new Date("2026-11-15T01:31:00")).date).toBe(
      "2026-11-14",
    );
  });
  it("rejects invalid behavior settings and a completion with a reward but no draw", () => {
    const data = notebook("Tank");
    for (const bad of [
      { lead: 7 },
      { opening: 1.1 },
      { goal: 0 },
      { payoff: "unknown" },
      { windowStart: "2026-02-31" },
    ]) {
      expect(() =>
        parseNotebook({
          ...data,
          tasks: [
            {
              ...data.tasks[0],
              behavior: { ...data.tasks[0].behavior, ...bad },
            },
          ],
        }),
      ).toThrow();
    }
    const event = complete(data, at("07T12:00:00"), "one")!;
    expect(() =>
      parseNotebook({
        ...data,
        events: [{ ...event, roll: null, reward: data.rewards[0] }],
      }),
    ).toThrow();
  });
});
