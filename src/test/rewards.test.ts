import { expect, it } from "vitest";
import { Completion, Effort, Notebook } from "../app/types";
import { emptyNotebook, parseNotebook } from "../lib/persistence/notebook";
import { liveEvents } from "../lib/schedule/calendar";
import {
  availableMix,
  completions,
  drawReward,
  forecastRewards,
  redrawOptions,
  SIZE_MIX,
  trayRewards,
  unrewardedDraws,
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
  const check = (id: string, sample: number, sizeRoll = sample) => {
    const period = periodFor(t, data.events, now, data.preferences);
    const samples = [sample, sizeRoll];
    const event = completePeriod(data, period, now, { float01: () => samples.shift() ?? sample }, id)!;
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
  const win = check("three", 0.99, 0.78);
  expect(win.reward?.size).toBe("small");
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

const now = new Date("2026-11-15T12:00:00");
const check = (id: string, reward: Completion["reward"] = null): Completion => ({
  id, type: "completed", taskId: "walk", taskTitle: "Walk", period: id,
  at: now.toISOString(), roll: reward ? 0 : 0.99, reward,
});

it("keeps the hit rate at 30% while the size mix shifts after misses and resets on a win", () => {
  const data = emptyNotebook();
  for (let misses = 0; misses <= 12; misses++) {
    expect(unrewardedDraws(data.events)).toBe(misses);
    expect(drawReward("solid", data, now, { float01: () => 0.3 }).reward).toBeNull();
    expect(drawReward("solid", data, now, { float01: () => 0.299 }).reward).toBeTruthy();
    const mix = availableMix("solid", data.rewards, true, misses);
    const next = availableMix("solid", data.rewards, true, misses + 1);
    if (misses < 10) {
      expect(next.big).toBeGreaterThan(mix.big);
      expect(next.medium + next.big).toBeGreaterThan(mix.medium + mix.big);
    } else expect(next).toEqual(mix);
    if (misses === 6) {
      const samples = [0.29, 0.7, 0];
      expect(drawReward("solid", data, now, { float01: () => samples.shift()! }).reward?.size).toBe("big");
      expect(availableMix("light", data.rewards, true, misses).big).toBe(0);
      expect(availableMix("heavy", data.rewards, false, misses).big).toBe(0);
    }
    data.events.push(check(String(misses)));
  }
  data.events.push(check("won", data.rewards[0]));
  expect(unrewardedDraws(data.events)).toBe(0);
  const samples = [0.29, 0.7, 0];
  expect(drawReward("solid", data, now, { float01: () => samples.shift()! }).reward?.size).toBe("medium");
});

it("ignores no-draw completions and keeps replayed draws in their original order", () => {
  const data = emptyNotebook();
  const miss = check("first");
  const win = check("winner", data.rewards[0]);
  data.events.push(miss, win, check("third"));
  const empty = drawReward("solid", { ...data, rewards: [] }, now, { float01: () => 0.99 });
  expect(empty).toEqual({ roll: null, reward: null, noDrawReason: "empty-menu" });
  data.events.push({ ...check("empty"), ...empty }, { ...check("early"), roll: null });
  data.events.push(undoEvent(data, miss.id, now, "undo-miss")!, { ...miss, id: "redo-miss" });
  expect(unrewardedDraws(data.events)).toBe(1);
  data.events.push(undoEvent(data, win.id, now, "undo-win")!);
  expect(unrewardedDraws(data.events)).toBe(2);
  data.events.push({ ...win, id: "redo-win" });
  expect(unrewardedDraws(data.events)).toBe(1);
});

it("keeps a used redraw across undo, replay, backup, and menu edits", () => {
  const data = emptyNotebook();
  data.tasks.push(task());
  const win = check("won", data.rewards[0]);
  const replacement = { ...data.rewards[1] };
  const swap = { type: "redrawn" as const, id: "swap", target: win.id, reward: replacement, at: win.at };
  data.events.push(win, swap);
  data.rewards[1].title = "Edited after the swap";
  expect(undoEvent(data, swap.id, now, "undo-swap")).toBeNull();
  data.events.push(undoEvent(data, win.id, now, "undo-win")!);
  expect(trayRewards(data.events)).toEqual([]);
  data.events.push({ ...win, id: "redo" });
  const saved = parseNotebook(JSON.parse(JSON.stringify(data)));
  expect(completions(saved.events)).toEqual([{ ...win, id: "redo", redrawn: true, reward: replacement }]);
  expect(trayRewards(saved.events)).toEqual(completions(saved.events));
  expect(() => parseNotebook({ ...data, events: [...data.events, { ...swap, target: "redo", id: "again" }] })).toThrow();
  // Older notebooks could swap back to the original reward.
  saved.events.push({ ...swap, id: "swap-back", target: "redo", reward: win.reward! });
  const [current] = trayRewards(parseNotebook(saved).events);
  expect(current.reward).toEqual(win.reward);
  expect(redrawOptions(current, saved.rewards)).toEqual([]);
});

it("forecasts streak bonuses, resets, and redistribution after a big win", () => {
  const rewards = emptyNotebook().rewards.filter((r) => r.size !== "small");
  const efforts: Effort[] = ["heavy", "heavy"];
  const total = 2 * 0.3;
  const firstBig = 0.3 * 0.55 / (0.35 + 0.55);
  const boostedBig = 0.3 * (0.55 * 7 / 6) / (0.35 + 0.55 * 7 / 6);
  const cappedBig = firstBig + (0.3 - firstBig) * firstBig + 0.7 * boostedBig;
  for (const [cap, expectedBig] of [[0, 0], [1, cappedBig], [null, cappedBig + firstBig ** 2]] as const) {
    const result = forecastRewards(efforts, rewards, cap);
    expect(result.big).toBeCloseTo(expectedBig, 10);
    expect(result.medium).toBeCloseTo(total - expectedBig, 10);
    expect(result.small).toBe(0);
  }
  const onlyBig = rewards.filter((r) => r.size === "big");
  // Light effort has no eligible size and preserves the pending bonus.
  const result = forecastRewards(["heavy", "light", "heavy"], onlyBig, 1);
  expect(result.big).toBeCloseTo(0.3 + 0.7 * 0.3, 10);
});
