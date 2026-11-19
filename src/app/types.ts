import type { Sowing } from "../lib/garden/garden";

export type Effort = "light" | "solid" | "heavy";
export type RewardSize = "small" | "medium" | "big";
export type DateKey = string;

export interface Schedule {
  kind: "once" | "daily" | "weekly" | "monthly" | "after";
  start: DateKey;
  time: string;
  every: number;
  weekdays: number[];
  monthDay: number;
  nthWeekday?: { nth: number; weekday: number };
  unit: "hours" | "days" | "weeks";
}
export interface TaskBehavior {
  payoff: "more" | "accrues";
  cost: "ramp" | "cliff";
  windowStart: DateKey;
  goal: number;
  unitLabel: string;
  // Days for calendar tasks; the schedule's unit for completion clocks.
  lead: number;
  opening: number;
}
export interface Task {
  id: string;
  title: string;
  notes: string;
  effort: Effort;
  schedule: Schedule;
  behavior: TaskBehavior;
  rhythmRevision: number;
  status: "active" | "paused" | "archived";
  createdAt: string;
}
export interface Reward {
  id: string;
  title: string;
  size: RewardSize;
  active: boolean;
}
export interface Completion {
  id: string;
  type: "completed";
  taskId: string;
  taskTitle: string;
  period: string;
  at: string;
  roll: number | null;
  reward: Reward | null;
  noDrawReason?: "empty-menu";
}
export type JournalEvent =
  | Completion
  | {
      id: string;
      type: "undone";
      target: string;
      at: string;
    }
  | {
      id: string;
      type: "enjoyed";
      target: string;
      at: string;
    }
  | {
      id: string;
      type: "skipped" | "missed";
      taskId: string;
      taskTitle: string;
      period: string;
      at: string;
    }
  | {
      id: string;
      type: "snoozed";
      taskId: string;
      period: string;
      until: DateKey;
      at: string;
    };
export interface Preferences {
  theme: "system" | "light" | "dark";
  reduceMotion: boolean;
  sound: boolean;
  dayStart: number;
  bigRewardCap: number | null;
}
export interface Notebook {
  version: 3;
  revision: number;
  tasks: Task[];
  rewards: Reward[];
  events: JournalEvent[];
  preferences: Preferences;
  onboarded: boolean;
  introductoryDraws?: true;
  garden?: Sowing[];
}
export interface TaskPeriod {
  task: Task;
  lastCompletion: Completion | undefined;
  completedToday: number;
  pastDue: boolean;
  key: string;
  date: DateKey | null;
  time: string;
  bucket: "today" | "anytime" | "later" | "done";
  round: string;
  drawEligible: boolean;
  hold: string | null;
  detail: string;
  progress?: { done: number; goal: number };
}
