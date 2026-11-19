import { gardenPlants, sow, starterPacket } from "../lib/garden/garden";
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
import {
  loadNotebook,
  saveNotebook,
  loadCloudCache,
  saveCloudCache,
} from "../lib/persistence/storage";
import {
  CloudConflict,
  CloudRecord,
  leaveAccount,
  saveCloud,
  signIn,
  syncAvailable,
  watchAuth,
  watchCloud,
} from "../lib/sync/firebase";
import { completePeriod, undoEvent } from "../lib/tasks/actions";
import { createCryptoRng } from "../lib/rewards/rng";
import { addDays, dayKey } from "../lib/schedule/calendar";
import { periodFor, activeHolds, targetMisses } from "../lib/tasks/taxonomy";
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
  syncAvailable: boolean;
  syncUser: { uid: string; email: string | null } | null;
  syncLoading: boolean;
  syncConnected: boolean;
  syncError: string | null;
  authPending: boolean;
  connectAccount: () => Promise<void>;
  disconnectAccount: () => Promise<void>;
  initialize: () => Promise<void>;
  change: (update: (data: Notebook) => Notebook) => Promise<boolean>;
  saveTask: (
    input: Omit<Task, "id" | "createdAt" | "rhythmRevision">,
    id?: string,
  ) => Promise<boolean>;
  setTaskStatus: (id: string, status: Task["status"]) => Promise<void>;
  settle: () => Promise<void>;
  complete: (period: TaskPeriod) => Promise<void>;
  plantSeed: (seed: string) => Promise<boolean>;
  skip: (period: TaskPeriod) => Promise<void>;
  snooze: (period: TaskPeriod) => Promise<void>;
  undo: (eventId: string) => Promise<void>;
  enjoy: (eventId: string) => Promise<void>;
  saveReward: (input: Omit<Reward, "id">, id?: string) => Promise<boolean>;
  preferences: (patch: Partial<Preferences>) => Promise<boolean>;
  importBackup: (json: string) => Promise<boolean>;
  notify: (toast: Toast | null) => void;
  dismissReveal: () => void;
}
let initialization: Promise<void> | undefined;
let writes: Promise<void> = Promise.resolve();
let session = 0;
let cloudRevision: number | null = null;
let stopCloud: (() => void) | undefined;
export const canEdit = (state: AppState) =>
  state.loaded &&
  !state.storageError &&
  !state.syncLoading &&
  !state.authPending &&
  (!state.syncUser ||
    (state.syncConnected && !state.syncError && state.pending === 0));
export const saveStatus = (state: AppState) =>
  state.storageError
    ? "Backup needed"
    : state.syncUser
      ? state.syncLoading
        ? "Connecting…"
        : state.pending
          ? "Saving…"
          : state.syncError
            ? "Sync needs attention"
            : state.syncConnected
              ? "Synced"
              : "Offline—view only"
      : state.pending
        ? "Saving…"
        : "Saved on this device";
const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Storage isn't available. Enable browser storage, then reload.";
const acceptCloud = (record: CloudRecord, uid: string, active: number) => {
  if (
    active !== session ||
    (cloudRevision !== null && record.revision <= cloudRevision)
  )
    return;
  const data = parseNotebook(JSON.parse(record.json));
  cloudRevision = record.revision;
  useApp.setState({
    data,
    syncLoading: false,
    syncError: null,
    toast: null,
    reveal: null,
  });
  void saveCloudCache(uid, { data, revision: record.revision }).catch(() => {
    if (active === session)
      useApp.getState().notify({
        message:
          "Saved online. This browser couldn't keep an offline copy; download a backup.",
      });
  });
};
const openAccount = async (user: AppState["syncUser"]) => {
  const active = ++session;
  stopCloud?.();
  cloudRevision = null;
  useApp.setState({
    data: emptyNotebook(),
    syncUser: user,
    syncLoading: true,
    syncConnected: false,
    syncError: null,
    storageError: null,
    pending: 0,
    toast: null,
    reveal: null,
  });
  try {
    const guest = await loadNotebook();
    if (active !== session) return;
    if (!user) {
      useApp.setState({ data: guest, syncLoading: false });
      return;
    }
    const cached = await loadCloudCache(user.uid);
    if (active !== session) return;
    if (cached) useApp.setState({ data: cached.data, syncLoading: false });
    stopCloud = watchCloud(
      user.uid,
      cached?.data ?? guest,
      (record) => acceptCloud(record, user.uid, active),
      (online) => {
        if (active === session) useApp.setState({ syncConnected: online });
      },
      (error) => {
        if (active === session)
          useApp.setState({
            syncError: errorMessage(error),
            syncConnected: false,
          });
      },
    );
  } catch (error) {
    if (active === session) useApp.setState({ syncError: errorMessage(error) });
  }
};
export const useApp = create<AppState>((set, get) => ({
  data: emptyNotebook(),
  loaded: false,
  loadError: null,
  storageError: null,
  pending: 0,
  toast: null,
  reveal: null,
  syncAvailable,
  syncUser: null,
  syncLoading: syncAvailable,
  syncConnected: false,
  syncError: null,
  authPending: false,
  connectAccount: async () => {
    if (get().pending || get().authPending || get().syncLoading) return;
    set({ authPending: true, syncError: null });
    try {
      await signIn();
    } catch (error) {
      set({ syncError: errorMessage(error) });
    } finally {
      set({ authPending: false });
    }
  },
  disconnectAccount: async () => {
    if (get().pending || get().authPending) return;
    set({ authPending: true });
    try {
      await leaveAccount();
    } catch (error) {
      set({ syncError: errorMessage(error) });
    } finally {
      set({ authPending: false });
    }
  },
  initialize: () =>
    (initialization ??= loadNotebook()
      .then((data) => {
        set({ data, loaded: true });
        if (syncAvailable) {
          try {
            watchAuth(
              (user) => {
                void openAccount(user);
              },
              (error) =>
                set({ syncError: errorMessage(error), syncLoading: true }),
            );
          } catch (error) {
            set({ syncError: errorMessage(error), syncLoading: true });
          }
        }
      })
      .catch((error) => {
        set({ loadError: errorMessage(error) });
      })),
  change: async (update) => {
    if (!canEdit(get())) return false;
    const updated = update(get().data);
    let data: Notebook;
    try {
      // Validate user input before evaluating schedules or generating events.
      parseNotebook(updated);
      data = {
        ...updated,
        events: [...updated.events, ...targetMisses(updated, new Date())],
        revision: get().data.revision + 1,
      };
      parseNotebook(data);
    } catch {
      get().notify({
        message: "Please check the task, reward, or schedule before saving.",
      });
      return false;
    }
    const active = session;
    const user = get().syncUser;
    if (user && cloudRevision === null) return false;
    const expected = cloudRevision;
    set({ pending: get().pending + 1, ...(user ? {} : { data }) });
    try {
      if (user) {
        const record = await saveCloud(user.uid, expected!, data);
        acceptCloud(record, user.uid, active);
      } else {
        const write = writes.then(async () => {
          if (get().storageError) throw new Error(get().storageError!);
          await saveNotebook(data);
        });
        writes = write.catch(() => {});
        await write;
      }
      return active === session;
    } catch (error) {
      if (active === session) {
        if (error instanceof CloudConflict && user) {
          acceptCloud(error.record, user.uid, active);
          get().notify({ message: error.message });
        } else if (user) {
          set({ syncError: errorMessage(error), syncConnected: false });
        } else set({ storageError: errorMessage(error) });
      }
      return false;
    } finally {
      if (active === session) set({ pending: get().pending - 1 });
    }
  },
  saveTask: async (input, id) => {
    const previous = get().data.tasks.find((t) => t.id === id);
    const changedRhythm =
      previous &&
      (JSON.stringify(previous.schedule) !== JSON.stringify(input.schedule) ||
        JSON.stringify(previous.behavior) !== JSON.stringify(input.behavior));
    const task: Task = {
      ...input,
      rhythmRevision: previous
        ? previous.rhythmRevision + (changedRhythm ? 1 : 0)
        : 1,
      id: id ?? randomId(),
      createdAt:
        get().data.tasks.find((t) => t.id === id)?.createdAt ??
        new Date().toISOString(),
    };
    const saved = await get().change((d) => ({
      ...d,
      tasks: id
        ? d.tasks.map((t) => (t.id === id ? task : t))
        : [...d.tasks, task],
    }));
    if (!saved) return false;
    get().notify({
      message: id ? "Task updated." : "Task added.",
    });
    return true;
  },
  setTaskStatus: async (id, status) => {
    const previous = get().data.tasks.find((t) => t.id === id)?.status;
    const changed = await get().change((d) => ({
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
      undo: async () => {
        if (!previous) return;
        const restored = await get().change((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === id ? { ...t, status: previous } : t,
          ),
        }));
        if (restored) get().notify({ message: "Undone." });
      },
    });
  },
  settle: async () => {
    if (
      !canEdit(get()) ||
      get().pending ||
      !targetMisses(get().data, new Date()).length
    )
      return;
    await get().change((d) => d);
  },
  complete: async (period) => {
    if (get().reveal?.reward) return;
    const event = completePeriod(
      get().data,
      period,
      new Date(),
      createCryptoRng(),
      randomId(),
    );
    if (!event || get().storageError) return;
    if (!(await get().change((d) => {
      const growing = d.garden?.length ? d : sow(d, starterPacket.key, event.at);
      return { ...growing, events: [...growing.events, event] };
    }))) return;
    set({ reveal: event.roll === null ? null : event });
    get().notify({
      message:
        event.roll === null
          ? event.noDrawReason === "empty-menu"
            ? "Done. No eligible rewards for a draw."
            : "Done. Clock restarted; too early for a draw."
          : event.reward
            ? "Done. Reward earned."
            : "Done. No reward.",
      undo: () => get().undo(event.id),
    });
  },
  plantSeed: async (seed) => {
    const data = get().data;
    if (!gardenPlants(data).at(-1)?.finished) return false;
    return get().change((notebook) => sow(notebook, seed, new Date().toISOString()));
  },
  skip: async (period) => {
    const d = get().data;
    const task = d.tasks.find((t) => t.id === period.task.id);
    if (!task || task.status !== "active") return;
    const current = periodFor(task, d.events, new Date(), d.preferences);
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
    if (
      !(await get().change((data) => ({
        ...data,
        events: [...data.events, event],
      })))
    )
      return;
    get().notify({
      message: "Miss declared. This round’s draw is forfeited.",
      undo: () => get().undo(event.id),
    });
  },
  snooze: async (period) => {
    const now = new Date();
    const d = get().data;
    const task = d.tasks.find((t) => t.id === period.task.id);
    if (!task || task.status !== "active") return;
    const current = periodFor(task, d.events, now, d.preferences);
    if (
      current.key !== period.key ||
      current.bucket === "done" ||
      current.bucket === "later"
    )
      return;
    if (current.hold) {
      get().notify({
        message: "Complete the task or declare a miss to release its hold.",
      });
      return;
    }
    const event: JournalEvent = {
      id: randomId(),
      type: "snoozed",
      taskId: period.task.id,
      period: period.key,
      until: addDays(dayKey(now, get().data.preferences.dayStart), 1),
      at: now.toISOString(),
    };
    if (!(await get().change((d) => ({ ...d, events: [...d.events, event] }))))
      return;
    get().notify({
      message: "Moved to tomorrow.",
      undo: () => get().undo(event.id),
    });
  },
  undo: async (target) => {
    const event = undoEvent(get().data, target, new Date(), randomId());
    if (!event) {
      get().notify({ message: "That action can no longer be undone." });
      return;
    }
    if (!(await get().change((d) => ({ ...d, events: [...d.events, event] }))))
      return;
    set({ reveal: null });
    get().notify({ message: "Undone." });
  },
  enjoy: async (target) => {
    if (activeHolds(get().data, new Date()).length) {
      get().notify({
        message:
          "The tray is on hold. Complete the listed tasks or declare a miss first.",
      });
      return;
    }
    if (!trayRewards(get().data.events).some((e) => e.id === target)) return;
    const event: JournalEvent = {
      id: randomId(),
      type: "enjoyed",
      target,
      at: new Date().toISOString(),
    };
    if (!(await get().change((d) => ({ ...d, events: [...d.events, event] }))))
      return;
    set({ reveal: null });
    get().notify({
      message: "Reward enjoyed.",
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
  importBackup: async (json) => {
    const imported = readBackup(json);
    if (!(await get().change((d) => ({ ...imported, revision: d.revision }))))
      return false;
    set({ reveal: null, toast: { message: "Your backup has been restored." } });
    return true;
  },
  notify: (toast) => set({ toast }),
  dismissReveal: () => set({ reveal: null }),
}));
