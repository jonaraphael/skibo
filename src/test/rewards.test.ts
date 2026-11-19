import { expect, it } from "vitest";
import { Completion, Effort, Notebook } from "../app/types";
import { emptyNotebook, parseNotebook } from "../lib/persistence/notebook";
import { liveEvents } from "../lib/schedule/calendar";
import {
  availableMix,
  drawReward,
  SIZE_MIX,
  trayRewards,
} from "../lib/rewards/engine";
import { SeededRng } from "../lib/rewards/rng";

import { periodFor } from "../lib/tasks/taxonomy";
import { completePeriod, undoEvent } from "../lib/tasks/actions";
import { task } from "./fixtures";

it.each(["light", "solid", "heavy"] as Effort[])(
  "matches the stated hit rate and size distribution for %s effort",
  (effort) => {
    const data = emptyNotebook();
    const rng = new SeededRng(123456);
    const sizes = { small: 0, medium: 0, big: 0 };
    let hits = 0;
    for (let i = 0; i < 50_000; i++) {
      const result = drawReward(
        effort,
        data,
        new Date("2026-11-15T12:00:00"),
        rng,
      );
      if (result.reward) {
        hits++;
        sizes[result.reward.size]++;
      }
    }
    expect(hits / 50_000).toBeCloseTo(0.3, 2);
    for (const size of ["small", "medium", "big"] as const)
      expect(
        Math.abs(sizes[size] / hits - SIZE_MIX[effort][size]),
      ).toBeLessThan(0.015);
  },
);
it("does not reroll an undone completion and rejects a stale double completion", () => {
  const data = emptyNotebook();
  data.tasks = [task()];
  const now = new Date("2026-11-15T12:00:00");
  const p = periodFor(data.tasks[0], [], now, data.preferences);
  const first = completePeriod(data, p, now, { float01: () => 0 }, "one")!;
  data.events.push(first);
  expect(
    completePeriod(data, p, now, { float01: () => 0.99 }, "duplicate"),
  ).toBeNull();
  expect(trayRewards(data.events)).toEqual([first]);
  data.events.push(undoEvent(data, first.id, now, "undo")!);
  expect(trayRewards(data.events)).toHaveLength(0);
  const redo = completePeriod(
    data,
    p,
    now,
    {
      float01: () => {
        throw new Error("Should reuse the saved draw");
      },
    },
    "redo",
  )!;
  expect(redo.reward).toEqual(first.reward);
  expect(redo.roll).toBe(first.roll);
  data.events.push(redo, {
    id: "enjoy",
    type: "enjoyed",
    target: redo.id,
    at: now.toISOString(),
  });
  expect(trayRewards(data.events)).toHaveLength(0);
  data.events.push(undoEvent(data, redo.id, now, "undo-again")!);
  expect(liveEvents(data.events)).toHaveLength(0);
  expect(trayRewards(data.events)).toHaveLength(0);
  expect(() => parseNotebook(data)).not.toThrow();
});

it("awards the third distinct introductory draw across undo, reload, and an empty menu", () => {
  const t = task({ kind: "after" });
  t.behavior.payoff = "more";
  let data: Notebook = { ...emptyNotebook(), tasks: [t], introductoryDraws: true };
  const now = new Date("2026-11-15T12:00:00");
  const check = (id: string, sample: number) => {
    const period = periodFor(t, data.events, now, data.preferences);
    const event = completePeriod(data, period, now, { float01: () => sample }, id)!;
    data.events.push(event);
    return event;
  };
  expect(check("one", 0).reward).toBeNull();
  data.events.push(undoEvent(data, "one", now, "undo-one")!);
  expect(check("redo-one", 0).reward).toBeNull();
  expect(check("two", 0).reward).toBeNull();
  const menu = data.rewards;
  data.rewards = [];
  expect(check("no-menu", 0.99)).toMatchObject({ roll: null, reward: null });
  data.rewards = menu;
  data = parseNotebook(JSON.parse(JSON.stringify(data)));
  const win = check("three", 0.99);
  expect(win.reward).not.toBeNull();
  data.events.push(undoEvent(data, win.id, now, "undo-win")!);
  expect(check("redo-win", 0).reward).toEqual(win.reward);
  expect(check("four", 0.99).reward).toBeNull();
  expect(check("five", 0).reward).not.toBeNull();
});
it("renormalizes missing sizes and respects the weekly big-reward cap", () => {
  const data = emptyNotebook();
  data.preferences.bigRewardCap = 1;
  const now = new Date("2026-11-15T12:00:00");
  data.events.push({
    id: "big",
    type: "completed",
    taskId: "walk",
    taskTitle: "Walk",
    period: "old",
    at: now.toISOString(),
    roll: 0.1,
    reward: data.rewards.find((r) => r.size === "big")!,
  } as Completion);
  const rng = new SeededRng(999);
  for (let i = 0; i < 1000; i++)
    expect(drawReward("heavy", data, now, rng).reward?.size).not.toBe("big");
  const mix = availableMix(
    "solid",
    data.rewards.filter((r) => r.size !== "big"),
  );
  expect(mix.small).toBeCloseTo(0.25);
  expect(mix.medium).toBeCloseTo(0.75);
  expect(
    drawReward("light", { ...data, rewards: [] }, now, { float01: () => 0 })
      .reward,
  ).toBeNull();
});

it("forecasts cap redistribution across a full week's draws", async () => {
  const { forecastRewards } = await import("../lib/rewards/engine");
  const data = emptyNotebook();
  const efforts: Effort[] = new Array(10).fill("heavy");
  const zero = forecastRewards(efforts, data.rewards, 0);
  expect(zero.big).toBe(0);
  expect(zero.small).toBeCloseTo(2 / 3);
  expect(zero.medium).toBeCloseTo(7 / 3);
  const one = forecastRewards(efforts, data.rewards, 1);
  expect(one.big).toBeCloseTo(1 - (1 - 0.3 * 0.55) ** 10);
  expect(one.small + one.medium + one.big).toBeCloseTo(3);
  const unlimited = forecastRewards(efforts, data.rewards, null);
  expect(unlimited.big).toBeCloseTo(1.65);
});
