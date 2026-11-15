export type Effort = "light" | "solid" | "heavy";
export type RewardSize = "small" | "medium" | "big";
export type DateKey = string;

export interface Schedule {
  kind: "once" | "daily" | "weekly" | "monthly" | "after";
  start: DateKey | null;
  time: string;
  every: number;
  weekdays: number[];
  monthDay: number;
  nthWeekday?: { nth: number; weekday: number };
  unit: "hours" | "days" | "weeks";
}
export interface Task {
  id: string;
  title: string;
  notes: string;
  effort: Effort;
  schedule: Schedule;
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
  roll: number;
  reward: Reward | null;
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
      type: "skipped";
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
  version: 2;
  revision: number;
  tasks: Task[];
  rewards: Reward[];
  events: JournalEvent[];
  preferences: Preferences;
  onboarded: boolean;
}
export interface TaskPeriod {
  task: Task;
  key: string;
  date: DateKey | null;
  time: string;
  bucket: "late" | "today" | "anytime" | "later" | "done";
}
