import { expect, it } from "vitest";
import {
  emptyNotebook,
  importLegacy,
  parseNotebook,
  readBackup,
} from "../lib/persistence/notebook";
import { task } from "./fixtures";
it("round-trips the full notebook and rejects malformed backups instead of clearing data", () => {
  const data = emptyNotebook();
  data.tasks.push(task());
  expect(readBackup(JSON.stringify(data))).toEqual(data);
  expect(() => readBackup('{"version":99}')).toThrow();
  expect(() =>
    parseNotebook({ ...data, tasks: [...data.tasks, ...data.tasks] }),
  ).toThrow();
  expect(() =>
    parseNotebook({
      ...data,
      tasks: [
        {
          ...task(),
          schedule: { ...task().schedule, weekdays: [], kind: "weekly" },
        },
      ],
    }),
  ).toThrow();
  expect(() =>
    parseNotebook({
      ...data,
      tasks: [
        { ...task(), schedule: { ...task().schedule, start: "2026-02-31" } },
      ],
    }),
  ).toThrow();
  expect(() =>
    parseNotebook({
      ...data,
      events: [
        {
          id: "x",
          at: new Date().toISOString(),
          type: "enjoyed",
          target: "missing",
        },
      ],
    }),
  ).toThrow();
});
it("imports original tasks, wins, and retained completion history while keeping all reward ideas editable", () => {
  const legacy = {
    version: 1,
    prefs: { reduceMotion: true },
    tasks: [
      {
        id: "old",
        title: "Weekly review",
        notes: "Remember this",
        kind: "recurring",
        difficulty: "hard",
        active: true,
        createdAtIso: "2026-01-04T14:00:00.000Z",
        recurrence: {
          kind: "weekly",
          interval: 1,
          daysOfWeek: [0],
          anchorIso: "2026-01-04T14:00:00.000Z",
        },
      },
    ],
    occurrences: [
      {
        occurrenceId: "kept",
        taskId: "old",
        completedAtIso: "2026-01-11T15:00:00.000Z",
      },
    ],
    rewardEvents: [
      {
        id: "win",
        taskId: "old",
        occurrenceId: "first",
        createdAtIso: "2026-01-04T15:00:00.000Z",
        triggered: true,
        roll: 0.1,
        rewardId: "H06",
      },
    ],
  };
  const imported = importLegacy(legacy);
  expect(imported.tasks[0].effort).toBe("heavy");
  expect(imported.tasks[0].notes).toBe("Remember this");
  expect(imported.events).toHaveLength(2);
  expect(imported.events[0]).toMatchObject({
    reward: { title: "Book a professional massage", size: "big" },
  });
  expect(imported.rewards).toHaveLength(90);
  expect(imported.preferences.reduceMotion).toBe(true);
});

it("keeps imported one-off completions resolved and preserves long original titles", () => {
  const title = "An original task " + "with a long title ".repeat(25);
  const imported = importLegacy({
    version: 1,
    prefs: {},
    tasks: [
      {
        id: "legacy-once",
        title,
        kind: "deadline",
        difficulty: "easy",
        active: true,
        createdAtIso: "2026-01-01T12:00:00.000Z",
        dueAtIso: null,
      },
    ],
    occurrences: [],
    rewardEvents: [
      {
        id: "legacy-win",
        taskId: "legacy-once",
        occurrenceId: "old-period",
        triggered: false,
        roll: 0.9,
        createdAtIso: "2026-11-14T12:00:00.000Z",
      },
    ],
  });
  expect(imported.tasks[0].title).toBe(title);
  expect(imported.events[0]).toMatchObject({ period: "legacy-once:once" });
});
