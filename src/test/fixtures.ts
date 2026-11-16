import { Task } from "../app/types";
export const task = (patch: Partial<Task["schedule"]> = {}): Task => ({
  id: "walk",
  title: "Take a walk",
  notes: "",
  rhythmRevision: 1,
  effort: "light",
  status: "active",
  createdAt: "2026-01-31T12:00:00.000Z",
  behavior: {
    payoff: "accrues",
    cost: "ramp",
    windowStart: patch.start ?? "2026-01-31",
    goal: 1,
    unitLabel: "session",
    lead: 0.5,
    opening: 0.5,
  },
  schedule: {
    kind: "daily",
    time: "",
    every: 1,
    weekdays: [0],
    monthDay: 31,
    unit: "days",
    ...patch,
    start: patch.start ?? "2026-01-31",
  },
});
