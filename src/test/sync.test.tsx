import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useApp, canEdit } from "../app/store";
import {
  cloudRecord,
  CloudConflict,
  CloudRecord,
  saveCloud,
} from "../lib/sync/firebase";
import { emptyNotebook } from "../lib/persistence/notebook";
import { periodFor } from "../lib/schedule/calendar";
import { TaskEditor } from "../screens/TaskEditor";
import { WorkspaceContext } from "../components/Workspace";
import { task } from "./fixtures";

const hooks = vi.hoisted(() => ({
  auth: undefined as
    undefined | ((user: { uid: string; email: string } | null) => void),
  accept: undefined as undefined | ((record: CloudRecord) => void),
  connected: undefined as undefined | ((online: boolean) => void),
}));
vi.mock("../lib/persistence/storage", () => ({
  loadNotebook: vi.fn(async () => ({
    ...emptyNotebook(),
    tasks: [task({ kind: "once", start: null })],
    onboarded: true,
  })),
  saveNotebook: vi.fn(async () => {}),
  loadCloudCache: vi.fn(async () => null),
  saveCloudCache: vi.fn(async () => {}),
}));
vi.mock("../lib/sync/firebase", async (original) => ({
  ...(await original<typeof import("../lib/sync/firebase")>()),
  syncAvailable: true,
  watchAuth: vi.fn((next) => {
    hooks.auth = next;
    return () => {};
  }),
  watchCloud: vi.fn((_uid, seed, accept, connected) => {
    hooks.accept = accept;
    hooks.connected = connected;
    accept(cloudRecord(seed, 0));
    connected(true);
    return () => {};
  }),
  saveCloud: vi.fn(async (_uid, expected, data) =>
    cloudRecord(data, expected + 1),
  ),
}));
const login = async (uid = "one") => {
  hooks.auth!({ uid, email: `${uid}@example.com` });
  await waitFor(() => expect(useApp.getState().syncConnected).toBe(true));
};
beforeAll(async () => {
  await useApp.getState().initialize();
});
beforeEach(async () => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(saveCloud).mockImplementation(async (_uid, expected, data) =>
    cloudRecord(data, expected + 1),
  );
  hooks.auth!(null);
  await waitFor(() => expect(useApp.getState().syncLoading).toBe(false));
  await login();
});

it("waits for cloud acknowledgement before completing or revealing a reward", async () => {
  let acknowledge!: (record: CloudRecord) => void;
  vi.mocked(saveCloud).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
  );
  const original = useApp.getState().data;
  const period = periodFor(
    original.tasks[0],
    [],
    new Date(),
    original.preferences,
  );
  const action = useApp.getState().complete(period);
  expect(useApp.getState().pending).toBe(1);
  expect(useApp.getState().data.events).toHaveLength(0);
  expect(useApp.getState().reveal).toBeNull();
  expect(canEdit(useApp.getState())).toBe(false);
  const candidate = vi.mocked(saveCloud).mock.calls[0][2];
  acknowledge(cloudRecord(candidate, 1));
  await action;
  expect(useApp.getState().data.events).toHaveLength(1);
  expect(useApp.getState().reveal?.id).toBe(candidate.events[0].id);
  expect(useApp.getState().pending).toBe(0);
});

it("keeps an editor draft open when another device wins the revision", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const close = vi.fn();
  const data = useApp.getState().data;
  const remote = {
    ...data,
    tasks: [{ ...data.tasks[0], title: "Other device" }],
  };
  vi.mocked(saveCloud).mockRejectedValueOnce(
    new CloudConflict(cloudRecord(remote, 1)),
  );
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider
        value={{ now: new Date(), openTask: vi.fn(), openReward: vi.fn() }}
      >
        <TaskEditor task={data.tasks[0]} close={close} />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Task name"), {
    target: { value: "My draft" },
  });
  await act(async () => {
    fireEvent.submit(screen.getByLabelText("Task name").closest("form")!);
  });
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Task name")).toHaveValue("My draft");
  expect(useApp.getState().data.tasks[0].title).toBe("Other device");
  await act(async () => {
    fireEvent.submit(screen.getByLabelText("Task name").closest("form")!);
  });
  expect(saveCloud).toHaveBeenLastCalledWith("one", 1, expect.anything());
  expect(close).toHaveBeenCalledOnce();
});

it("blocks offline mutations and resumes after reconnecting", async () => {
  const original = useApp.getState().data;
  hooks.connected!(false);
  expect(
    await useApp.getState().change((d) => ({ ...d, onboarded: false })),
  ).toBe(false);
  expect(saveCloud).not.toHaveBeenCalled();
  expect(useApp.getState().data).toBe(original);
  hooks.connected!(true);
  expect(
    await useApp.getState().change((d) => ({ ...d, onboarded: false })),
  ).toBe(true);
});

it("keeps an uncertain save pending through a disconnection", async () => {
  let acknowledge!: (record: CloudRecord) => void;
  vi.mocked(saveCloud).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
  );
  const action = useApp.getState().change((d) => ({ ...d, onboarded: false }));
  hooks.connected!(false);
  expect(useApp.getState().pending).toBe(1);
  expect(useApp.getState().data.onboarded).toBe(true);
  hooks.connected!(true);
  acknowledge(cloudRecord(vi.mocked(saveCloud).mock.calls[0][2], 1));
  expect(await action).toBe(true);
  expect(useApp.getState().data.onboarded).toBe(false);
});

it("does not publish an old account’s pending result into the next account", async () => {
  let acknowledge!: (record: CloudRecord) => void;
  vi.mocked(saveCloud).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
  );
  const original = useApp.getState().data;
  const action = useApp
    .getState()
    .complete(
      periodFor(original.tasks[0], [], new Date(), original.preferences),
    );
  const candidate = vi.mocked(saveCloud).mock.calls[0][2];
  await login("two");
  acknowledge(cloudRecord(candidate, 1));
  await action;
  expect(useApp.getState().syncUser?.uid).toBe("two");
  expect(useApp.getState().data.events).toHaveLength(0);
  expect(useApp.getState().reveal).toBeNull();
  expect(useApp.getState().pending).toBe(0);
});

it("does not announce a save rejected by Firebase", async () => {
  vi.mocked(saveCloud).mockRejectedValueOnce(new Error("Permission denied"));
  expect(
    await useApp.getState().saveTask({ ...task(), title: "Rejected task" }),
  ).toBe(false);
  expect(useApp.getState().syncError).toBe("Permission denied");
  expect(useApp.getState().toast).toBeNull();
  expect(useApp.getState().data.tasks).toHaveLength(1);
  expect(canEdit(useApp.getState())).toBe(false);
});
