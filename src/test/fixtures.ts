import { Task } from "../app/types";
export const task = (patch: Partial<Task["schedule"]> = {}): Task => ({
  id: "walk",
  title: "Take a walk",
  notes: "",
  effort: "light",
  status: "active",
  createdAt: "2026-01-31T12:00:00.000Z",
  schedule: {
    kind: "daily",
    start: "2026-01-31",
    time: "",
    every: 1,
    weekdays: [0],
    monthDay: 31,
    unit: "days",
    ...patch,
  },
});
