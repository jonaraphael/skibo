import { expect, it } from "vitest";
import {
  emptyNotebook,
  parseNotebook,
  readBackup,
} from "../lib/persistence/notebook";
import { task } from "./fixtures";
it("starts new notebooks with the full personal menu and one big reward per week", () => {
  const data = emptyNotebook();
  expect(data.preferences.bigRewardCap).toBe(1);
  expect(data.rewards).toHaveLength(177);
  expect(data.rewards.filter((r) => r.size === "small")).toHaveLength(73);
  expect(data.rewards.filter((r) => r.size === "medium")).toHaveLength(68);
  expect(data.rewards.filter((r) => r.size === "big")).toHaveLength(36);
  expect(data.rewards.every((r) => r.active)).toBe(true);
  expect(new Set(data.rewards.map((r) => r.title)).size).toBe(177);
  expect(() => parseNotebook(data)).not.toThrow();
  data.rewards[0].title = "My own coffee";
  data.rewards[1].active = false;
  expect(emptyNotebook().rewards[0].title).toBe(
    "Fancy coffee at your favorite local café",
  );
  expect(emptyNotebook().rewards[1].active).toBe(true);
});
it("round-trips a customized menu and reward cap", () => {
  const data = {
    ...emptyNotebook(),
    rewards: [
      {
        id: "personal",
        title: "My reward",
        size: "small" as const,
        active: false,
      },
    ],
    preferences: { ...emptyNotebook().preferences, bigRewardCap: null },
    onboarded: true,
  };
  expect(readBackup(JSON.stringify(data))).toEqual(data);
});
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

it("opens empty v2 notebooks without losing their menu, settings, or setup progress", () => {
  const stored = {
    ...emptyNotebook(),
    version: 2,
    revision: 12,
    onboarded: true,
    rewards: [
      { id: "personal", title: "My coffee", size: "small", active: false },
    ],
    preferences: {
      ...emptyNotebook().preferences,
      theme: "dark",
      bigRewardCap: null,
    },
  };
  const original = JSON.stringify(stored);
  expect(readBackup(original)).toEqual({ ...stored, version: 3 });
  expect(JSON.stringify(stored)).toBe(original);
  expect(parseNotebook(readBackup(original))).toEqual(readBackup(original));
});
it("keeps populated older notebooks and malformed empty notebooks intact", () => {
  const populated = { ...emptyNotebook(), version: 2, tasks: [task()] };
  const original = JSON.stringify(populated);
  expect(() => parseNotebook(populated)).toThrow(
    "before task rhythms were added",
  );
  expect(JSON.stringify(populated)).toBe(original);
  expect(() =>
    parseNotebook({ ...emptyNotebook(), version: 2, preferences: {} }),
  ).toThrow();
  expect(() =>
    parseNotebook({ ...emptyNotebook(), version: 2, rewards: [{ id: "bad" }] }),
  ).toThrow();
  expect(() =>
    parseNotebook({ ...emptyNotebook(), version: 2, events: [{ id: "bad" }] }),
  ).toThrow();
});
