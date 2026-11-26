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
const MAX_BOOST_MISSES = 10;
const sizes = ["small", "medium", "big"] as const;
type SizeMix = Record<RewardSize, number>;
export const SIZE_MIX: Record<Effort, SizeMix> = {
  light: { small: 0.8, medium: 0.2, big: 0 },
  solid: { small: 0.2, medium: 0.6, big: 0.2 },
  heavy: { small: 0.1, medium: 0.35, big: 0.55 },
};

export type RewardCompletion = Completion & { redrawn?: true };
export const drawKey = (event: Completion) =>
  JSON.stringify([event.taskId, event.period]);

export const completions = (events: JournalEvent[]): RewardCompletion[] => {
  const done = liveEvents(events).filter(
    (e): e is Completion => e.type === "completed",
  );
  const swaps = events.filter((e) => e.type === "redrawn");
  if (!swaps.length) return done;

  // A rechecked unit has a new event ID but keeps the same earned reward.
  const originals = new Map(events.filter((e) => e.type === "completed").map((e) => [e.id, e]));
  const latestReward = new Map<string, Reward>();
  for (const swap of swaps) {
    const original = originals.get(swap.target);
    if (original?.reward) latestReward.set(drawKey(original), swap.reward);
  }
  return done.map((e) => {
    const reward = latestReward.get(drawKey(e));
    return reward ? { ...e, reward, redrawn: true } : e;
  });
};

export const trayRewards = (events: JournalEvent[]): RewardCompletion[] => {
  const enjoyed = new Set(
    liveEvents(events)
      .filter((e) => e.type === "enjoyed")
      .map((e) => e.target),
  );
  return completions(events).filter((e) => e.reward && !enjoyed.has(e.id));
};

const normalizedTitle = (reward: Reward) => reward.title.trim().toLowerCase();
export const isRedrawOption = (current: Reward, candidate: Reward) =>
  candidate.active && candidate.size === current.size && candidate.id !== current.id &&
  normalizedTitle(candidate) !== normalizedTitle(current);

export const redrawOptions = (entry: RewardCompletion, rewards: Reward[]) => {
  const current = entry.reward;
  if (!current || entry.redrawn) return [];
  return rewards.filter((r) => isRedrawOption(current, r));
};

// Count live units in their original draw order. Replaying an old draw cannot
// turn it into a new miss or move an old win past more recent misses.
export const unrewardedDraws = (events: JournalEvent[]) => {
  const liveDraws = new Set(
    liveEvents(events)
      .filter((e): e is Completion => e.type === "completed" && e.roll !== null)
      .map(drawKey),
  );
  let misses = 0;
  for (const e of events) {
    if (e.type === "completed" && e.roll !== null && liveDraws.delete(drawKey(e)))
      misses = e.reward ? 0 : misses + 1;
  }
  return misses;
};

export const availableMix = (
  effort: Effort,
  rewards: Reward[],
  allowBig = true,
  misses = 0,
): SizeMix => {
  const mix = { ...SIZE_MIX[effort] };
  const boost = 1 + Math.min(misses, MAX_BOOST_MISSES) / 6;
  mix.medium *= boost;
  mix.big *= boost * boost;
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

export const weeklyBigWins = (done: Completion[], now: Date, dayStart: number) => {
  const week = weekStart(dayKey(now, dayStart));
  return done.filter((e) =>
    e.reward?.size === "big" && weekStart(dayKey(new Date(e.at), dayStart)) === week,
  ).length;
};

// Undo and re-check replay the same draw. Count distinct drawn units in the
// journal, including reversed ones, to track which results someone has seen.
export function nextIntroductoryDraw(data: Notebook): number | null {
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
  const misses = intro === null ? unrewardedDraws(data.events) : 0;
  const cap = data.preferences.bigRewardCap;
  const allowBig = cap === null ||
    weeklyBigWins(completions(data.events), now, data.preferences.dayStart) < cap;
  const mix = availableMix(effort, data.rewards, allowBig, misses);
  const eligible = sizes.filter((size) => mix[size] > 0);
  if (!eligible.length)
    return { roll: null, reward: null, noDrawReason: "empty-menu" };

  const sample = rng.float01();
  if (intro !== null && intro < 3)
    return { roll: HIT_RATE + sample * (1 - HIT_RATE), reward: null };
  const roll = intro === 3 ? sample * HIT_RATE : sample;
  if (roll >= HIT_RATE) return { roll, reward: null };

  const sizeRoll = rng.float01();
  let cumulative = 0;
  const size = eligible.find((candidate) => {
    cumulative += mix[candidate];
    return sizeRoll < cumulative;
  }) ?? eligible[eligible.length - 1];
  const pool = data.rewards.filter((r) => r.active && r.size === size);
  return { roll, reward: { ...pool[Math.floor(rng.float01() * pool.length)] } };
};

// Start a fresh week at the base odds. Carry the distribution of both the
// weekly big-win count and consecutive misses forward after each task.
export const forecastRewards = (
  efforts: Effort[],
  rewards: Reward[],
  cap: number | null,
): SizeMix => {
  const totals = { small: 0, medium: 0, big: 0 };
  const limit = cap === null ? 0 : Math.min(cap, efforts.length);
  const emptyStates = () => Array.from({ length: limit + 1 }, () =>
    Array<number>(MAX_BOOST_MISSES + 1).fill(0));
  let states = emptyStates();
  states[0][0] = 1;
  const mixes = new Map<Effort, { open: SizeMix[]; capped: SizeMix[] }>();
  for (const effort of new Set(efforts)) {
    const byStreak = (allowBig: boolean) => Array.from({ length: MAX_BOOST_MISSES + 1 },
      (_, misses) => availableMix(effort, rewards, allowBig, misses));
    mixes.set(effort, { open: byStreak(true), capped: byStreak(false) });
  }
  for (const effort of efforts) {
    const next = emptyStates();
    const { open, capped } = mixes.get(effort)!;
    for (const [bigWins, row] of states.entries()) {
      const byStreak = cap === null || bigWins < cap ? open : capped;
      for (const [misses, probability] of row.entries()) {
        if (!probability) continue;
        const mix = byStreak[misses];
        if (!sizes.some((size) => mix[size] > 0)) {
          next[bigWins][misses] += probability;
          continue;
        }
        const nextMiss = Math.min(misses + 1, MAX_BOOST_MISSES);
        next[bigWins][nextMiss] += probability * (1 - HIT_RATE);
        for (const size of sizes) {
          const win = probability * HIT_RATE * mix[size];
          if (!win) continue;
          totals[size] += win;
          const nextBig = size === "big" && cap !== null ? bigWins + 1 : bigWins;
          next[nextBig][0] += win;
        }
      }
    }
    states = next;
  }
  return totals;
};
