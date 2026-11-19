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
// Undo and re-check replay the same draw. Count distinct drawn units in the
// journal, including reversed ones, to track which results someone has seen.
function nextIntroductoryDraw(data: Notebook): number | null {
  if (!data.introductoryDraws) return null;
  const periods = new Set<string>();
  for (const event of data.events) {
    if (event.type !== "completed" || event.roll === null) continue;
    periods.add(event.period);
    if (periods.size === 3) return null;
  }
  return periods.size + 1;
}

export const drawReward = (
  effort: Effort,
  data: Notebook,
  now: Date,
  rng: RandomSource,
): Pick<Completion, "roll" | "reward" | "noDrawReason"> => {
  const intro = nextIntroductoryDraw(data);
  const sample = rng.float01();
  if (intro === null && sample >= HIT_RATE) return { roll: sample, reward: null };
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
  if (intro !== null) {
    if (!Object.values(mix).some((weight) => weight > 0))
      return { roll: null, reward: null, noDrawReason: "empty-menu" };
    if (intro < 3)
      return { roll: HIT_RATE + sample * (1 - HIT_RATE), reward: null };
  }
  const roll = intro === 3 ? sample * HIT_RATE : sample;
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
