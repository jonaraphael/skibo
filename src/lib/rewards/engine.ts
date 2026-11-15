import {
  Completion,
  Effort,
  JournalEvent,
  Notebook,
  Reward,
  RewardSize,
} from "../../app/types";
import { dayKey, liveEvents, weekStart } from "../schedule/calendar";
import { RandomSource } from "./rng";

export const HIT_RATE = 0.3;
export const SIZE_MIX: Record<Effort, Record<RewardSize, number>> = {
  light: { small: 0.8, medium: 0.2, big: 0 },
  solid: { small: 0.2, medium: 0.6, big: 0.2 },
  heavy: { small: 0.1, medium: 0.35, big: 0.55 },
};
export const completions = (events: JournalEvent[]): Completion[] =>
  liveEvents(events).filter((e): e is Completion => e.type === "completed");
export const trayRewards = (events: JournalEvent[]): Completion[] => {
  const enjoyed = new Set(
    liveEvents(events)
      .filter((e) => e.type === "enjoyed")
      .map((e) => e.target),
  );
  return completions(events).filter((e) => e.reward && !enjoyed.has(e.id));
};
export const availableMix = (
  effort: Effort,
  rewards: Reward[],
  allowBig = true,
): Record<RewardSize, number> => {
  const mix = { ...SIZE_MIX[effort] };
  const sizes: RewardSize[] = ["small", "medium", "big"];
  for (const size of sizes)
    if (
      !rewards.some((r) => r.active && r.size === size) ||
      (size === "big" && !allowBig)
    )
      mix[size] = 0;
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  for (const size of sizes) mix[size] = total ? mix[size] / total : 0;
  return mix;
};
export const drawReward = (
  effort: Effort,
  data: Notebook,
  now: Date,
  rng: RandomSource,
): { roll: number; reward: Reward | null } => {
  const roll = rng.float01();
  if (roll >= HIT_RATE) return { roll, reward: null };
  const week = weekStart(dayKey(now, data.preferences.dayStart));
  const wonBig = completions(data.events).filter(
    (e) =>
      e.reward?.size === "big" &&
      weekStart(dayKey(new Date(e.at), data.preferences.dayStart)) === week,
  ).length;
  const mix = availableMix(
    effort,
    data.rewards,
    data.preferences.bigRewardCap === null ||
      wonBig < data.preferences.bigRewardCap,
  );
  const sizeRoll = rng.float01();
  let cumulative = 0;
  let size: RewardSize | null = null;
  for (const candidate of ["small", "medium", "big"] as const) {
    cumulative += mix[candidate];
    if (sizeRoll < cumulative) {
      size = candidate;
      break;
    }
  }
  const pool = data.rewards.filter((r) => r.active && r.size === size);
  return {
    roll,
    reward: pool.length
      ? { ...pool[Math.floor(rng.float01() * pool.length)] }
      : null,
  };
};

// Expected rewards for a fresh week, tracking the probability that the cap
// has already been reached before each completion.
export const forecastRewards = (
  efforts: Effort[],
  rewards: Reward[],
  cap: number | null,
): Record<RewardSize, number> => {
  const totals = { small: 0, medium: 0, big: 0 };
  let states = [1];
  const limit = cap === null ? 0 : Math.min(cap, efforts.length);
  for (const effort of efforts) {
    const eligible = availableMix(effort, rewards);
    const capped = availableMix(effort, rewards, false);
    const next = new Array<number>(Math.min(limit + 1, states.length + 1)).fill(
      0,
    );
    states.forEach((probability, count) => {
      const mix = cap === null || count < cap ? eligible : capped;
      for (const size of ["small", "medium", "big"] as const)
        totals[size] += probability * HIT_RATE * mix[size];
      const bigChance = HIT_RATE * mix.big;
      next[count] += probability * (1 - bigChance);
      if (bigChance)
        next[cap === null ? count : count + 1] += probability * bigChance;
    });
    states = next;
  }
  return totals;
};
