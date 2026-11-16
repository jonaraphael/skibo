import { describe, expect, it } from "vitest";
import { Completion, JournalEvent } from "../app/types";
import { defaultPreferences } from "../lib/persistence/notebook";
import { taskHistory } from "../lib/tasks/history";
import { task } from "./fixtures";

const preferences = defaultPreferences();
const now = new Date("2026-11-15T12:00:00");
const daily = task({ start: "2026-11-01" });
const completion = (date: string, at = `${date}T12:00:00`): Completion => ({
  id: `done-${date}`,
  type: "completed",
  taskId: daily.id,
  taskTitle: daily.title,
  period: `${daily.id}:${date}:`,
  at: new Date(at).toISOString(),
  roll: 0.9,
  reward: null,
});

describe("task evidence history", () => {
  it("shows the last 14 scheduled days, oldest first, with outcomes and an open day", () => {
    const reward = {
      id: "coffee",
      title: "A coffee",
      size: "small" as const,
      active: true,
    };
    const days = taskHistory(
      daily,
      [completion("2026-11-13"), { ...completion("2026-11-14"), reward }],
      now,
      preferences,
    );
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ date: "2026-11-02", state: "missed" });
    expect(days.slice(-3)).toEqual([
      { date: "2026-11-13", state: "done" },
      { date: "2026-11-14", state: "reward" },
      { date: "2026-11-15", state: "open" },
    ]);
  });

  it("credits a late completion to the original due day and removes it on undo", () => {
    const event = completion("2026-11-13", "2026-11-15T10:00:00");
    const days = taskHistory(daily, [event], now, preferences);
    expect(days.find((d) => d.date === "2026-11-13")?.state).toBe("done");
    expect(days.at(-1)?.state).toBe("missed");
    const undone: JournalEvent = {
      id: "undo",
      type: "undone",
      target: event.id,
      at: now.toISOString(),
    };
    expect(
      taskHistory(daily, [event, undone], now, preferences).find(
        (d) => d.date === "2026-11-13",
      )?.state,
    ).toBe("missed");
  });

  it("keeps skipped days distinct from completions and honors skip undo", () => {
    const skipped: JournalEvent = {
      ...completion("2026-11-14"),
      type: "skipped",
    };
    expect(taskHistory(daily, [skipped], now, preferences).at(-2)?.state).toBe(
      "skipped",
    );
    const undone: JournalEvent = {
      id: "undo",
      type: "undone",
      target: skipped.id,
      at: now.toISOString(),
    };
    expect(
      taskHistory(daily, [skipped, undone], now, preferences).at(-2)?.state,
    ).toBe("missed");
  });

  it("keeps a snoozed period on its original square until completion", () => {
    const t = task({ start: "2026-11-14" });
    const moved: JournalEvent = {
      id: "move",
      type: "snoozed",
      taskId: t.id,
      period: `${t.id}:2026-11-14:`,
      until: "2026-11-16",
      at: now.toISOString(),
    };
    expect(taskHistory(t, [moved], now, preferences)[0].state).toBe("open");
    expect(
      taskHistory(
        t,
        [moved, completion("2026-11-14", "2026-11-16T12:00:00")],
        new Date("2026-11-16T13:00:00"),
        preferences,
      )[0].state,
    ).toBe("done");
  });

  it("uses actual weekly and monthly dates and shows fewer squares for new tasks", () => {
    const weekly = task({
      kind: "weekly",
      start: "2026-11-01",
      weekdays: [0],
      every: 2,
    });
    expect(
      taskHistory(weekly, [], now, preferences).map((d) => d.date),
    ).toEqual(["2026-11-01", "2026-11-15"]);
    const monthly = task({
      kind: "monthly",
      start: "2026-01-31",
      monthDay: 31,
    });
    expect(
      taskHistory(
        monthly,
        [],
        new Date("2026-03-31T12:00:00"),
        preferences,
      ).map((d) => d.date),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(
      taskHistory(task({ start: "2026-11-20" }), [], now, preferences),
    ).toEqual([]);
  });

  it("uses the configured day boundary and preserves completions when the due time changes", () => {
    const t = task({ start: "2026-11-14", time: "09:00" });
    const event = completion("2026-11-14", "2026-11-15T02:00:00");
    const days = taskHistory(t, [event], new Date("2026-11-15T03:00:00"), {
      ...preferences,
      dayStart: 4,
    });
    expect(days).toEqual([{ date: "2026-11-14", state: "done" }]);
    expect(
      taskHistory({ ...t, status: "paused" }, [], now, preferences).every(
        (d) => d.state === "missed",
      ),
    ).toBe(true);
  });

  it("recomputes dates after schedule edits without modifying the journal", () => {
    const events = [completion("2026-11-13"), completion("2026-11-14")];
    const edited = {
      ...daily,
      schedule: { ...daily.schedule, kind: "weekly" as const, weekdays: [6] },
    };
    expect(taskHistory(edited, events, now, preferences)).toEqual([
      { date: "2026-11-07", state: "missed" },
      { date: "2026-11-14", state: "done" },
    ]);
    expect(events).toHaveLength(2);
  });

  it.each(["once", "after"] as const)(
    "omits the strip for %s schedules",
    (kind) => {
      expect(taskHistory(task({ kind }), [], now, preferences)).toEqual([]);
    },
  );
});
