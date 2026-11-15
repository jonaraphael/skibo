import { create } from "zustand";
import {
  Completion,
  JournalEvent,
  Notebook,
  Preferences,
  Reward,
  Task,
  TaskPeriod,
} from "./types";
import {
  emptyNotebook,
  parseNotebook,
  readBackup,
} from "../lib/persistence/notebook";
import { loadNotebook, saveNotebook } from "../lib/persistence/storage";
import { completePeriod, undoEvent } from "../lib/tasks/actions";
import { createCryptoRng } from "../lib/rewards/rng";
import { addDays, dayKey, periodFor } from "../lib/schedule/calendar";
import { trayRewards } from "../lib/rewards/engine";

export const randomId = () => crypto.randomUUID();
interface Toast {
  message: string;
  undo?: () => void;
}
interface AppState {
  data: Notebook;
  loaded: boolean;
  loadError: string | null;
  storageError: string | null;
  pending: number;
  toast: Toast | null;
  reveal: Completion | null;
  initialize: () => Promise<void>;
  change: (update: (data: Notebook) => Notebook) => boolean;
  saveTask: (input: Omit<Task, "id" | "createdAt">, id?: string) => boolean;
  setTaskStatus: (id: string, status: Task["status"]) => void;
  complete: (period: TaskPeriod) => void;
  skip: (period: TaskPeriod) => void;
  snooze: (period: TaskPeriod) => void;
  undo: (eventId: string) => void;
  enjoy: (eventId: string) => void;
  saveReward: (input: Omit<Reward, "id">, id?: string) => boolean;
  preferences: (patch: Partial<Preferences>) => void;
  importBackup: (json: string) => void;
  notify: (toast: Toast | null) => void;
  dismissReveal: () => void;
}
let initialization: Promise<void> | undefined;
let writes: Promise<void> = Promise.resolve();
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Storage isn't available. Enable browser storage, then reload.";
export const useApp = create<AppState>((set, get) => ({
  data: emptyNotebook(),
  loaded: false,
  loadError: null,
  storageError: null,
  pending: 0,
  toast: null,
  reveal: null,
  initialize: () =>
    (initialization ??= loadNotebook()
      .then((data) => {
        set({ data, loaded: true });
      })
      .catch((error) => {
        set({ loadError: errorMessage(error) });
      })),
  change: (update) => {
    if (!get().loaded || get().storageError) return false;
    const data = { ...update(get().data), revision: get().data.revision + 1 };
    try {
      parseNotebook(data);
    } catch {
      get().notify({
        message: "Please check the task, reward, or schedule before saving.",
      });
      return false;
    }
    set({ data, pending: get().pending + 1 });
    writes = writes
      .then(async () => {
        if (get().storageError) throw new Error(get().storageError!);
        await saveNotebook(data);
      })
      .catch((error) => {
        set({ storageError: errorMessage(error) });
      })
      .finally(() => {
        set({ pending: get().pending - 1 });
      });
    return true;
  },
  saveTask: (input, id) => {
    const task: Task = {
      ...input,
      id: id ?? randomId(),
      createdAt:
        get().data.tasks.find((t) => t.id === id)?.createdAt ??
        new Date().toISOString(),
    };
    const saved = get().change((d) => ({
      ...d,
      tasks: id
        ? d.tasks.map((t) => (t.id === id ? task : t))
        : [...d.tasks, task],
    }));
    if (!saved) return false;
    get().notify({
      message: id ? "Task updated." : "A little intention, added.",
    });
    return true;
  },
  setTaskStatus: (id, status) => {
    const previous = get().data.tasks.find((t) => t.id === id)?.status;
    const changed = get().change((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
    if (!changed) return;
    get().notify({
      message:
        status === "archived"
          ? "Task archived. History kept."
          : status === "paused"
            ? "Task paused."
            : "Task is active.",
      undo: () => {
        if (!previous) return;
        const restored = get().change((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === id ? { ...t, status: previous } : t,
          ),
        }));
        if (restored) get().notify({ message: "Undone." });
      },
    });
  },
  complete: (period) => {
    if (get().reveal?.reward) return;
    const event = completePeriod(
      get().data,
      period,
      new Date(),
      createCryptoRng(),
      randomId(),
    );
    if (!event || get().storageError) return;
    if (!get().change((d) => ({ ...d, events: [...d.events, event] }))) return;
    set({ reveal: event });
    get().notify({
      message: "Done. That counts.",
      undo: () => get().undo(event.id),
    });
  },
  skip: (period) => {
    const d = get().data;
    const current = periodFor(period.task, d.events, new Date(), d.preferences);
    if (
      current.key !== period.key ||
      current.bucket === "done" ||
      current.bucket === "later"
    )
      return;
    const event: JournalEvent = {
      id: randomId(),
      type: "skipped",
      taskId: period.task.id,
      taskTitle: period.task.title,
      period: period.key,
      at: new Date().toISOString(),
    };
    if (!get().change((data) => ({ ...data, events: [...data.events, event] })))
      return;
    get().notify({
      message: "Skipped this time. No roll taken.",
      undo: () => get().undo(event.id),
    });
  },
  snooze: (period) => {
    const now = new Date();
    const event: JournalEvent = {
      id: randomId(),
      type: "snoozed",
      taskId: period.task.id,
      period: period.key,
      until: addDays(dayKey(now, get().data.preferences.dayStart), 1),
      at: now.toISOString(),
    };
    if (!get().change((d) => ({ ...d, events: [...d.events, event] }))) return;
    get().notify({
      message: "Moved to tomorrow.",
      undo: () => get().undo(event.id),
    });
  },
  undo: (target) => {
    const event = undoEvent(get().data, target, new Date(), randomId());
    if (!event) {
      get().notify({ message: "That action can no longer be undone." });
      return;
    }
    if (!get().change((d) => ({ ...d, events: [...d.events, event] }))) return;
    set({ reveal: null });
    get().notify({ message: "Undone." });
  },
  enjoy: (target) => {
    if (!trayRewards(get().data.events).some((e) => e.id === target)) return;
    const event: JournalEvent = {
      id: randomId(),
      type: "enjoyed",
      target,
      at: new Date().toISOString(),
    };
    if (!get().change((d) => ({ ...d, events: [...d.events, event] }))) return;
    set({ reveal: null });
    get().notify({
      message: "Enjoy it. You've earned it.",
      undo: () => get().undo(event.id),
    });
  },
  saveReward: (input, id) => {
    const reward: Reward = { ...input, id: id ?? randomId() };
    return get().change((d) => ({
      ...d,
      rewards: id
        ? d.rewards.map((r) => (r.id === id ? reward : r))
        : [...d.rewards, reward],
    }));
  },
  preferences: (patch) =>
    get().change((d) => ({
      ...d,
      preferences: { ...d.preferences, ...patch },
    })),
  importBackup: (json) => {
    const imported = readBackup(json);
    if (!get().change((d) => ({ ...imported, revision: d.revision }))) return;
    set({ reveal: null, toast: { message: "Your backup has been restored." } });
  },
  notify: (toast) => set({ toast }),
  dismissReveal: () => set({ reveal: null }),
}));
