import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useApp } from "../app/store";
import { emptyNotebook, parseNotebook } from "../lib/persistence/notebook";
import { saveNotebook } from "../lib/persistence/storage";
import { REWARD_SUGGESTIONS } from "../lib/rewards/rewardPools";
import { periodFor } from "../lib/schedule/calendar";
import { WorkspaceContext } from "../components/Workspace";
import { Toast } from "../components/Toast";
import { TaskRow } from "../components/TaskRow";
import { Welcome } from "../screens/Welcome";
import { TaskEditor } from "../screens/TaskEditor";
import { Dashboard } from "../screens/Dashboard";
import { task } from "./fixtures";
vi.mock("../lib/persistence/storage", () => ({
  saveNotebook: vi.fn(async () => {}),
  loadNotebook: vi.fn(),
}));
const now = new Date("2026-11-15T12:00:00");
const openTask = vi.fn();
const workspace = { now, openTask, openReward: vi.fn() };
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  useApp.setState({
    data: emptyNotebook(),
    loaded: true,
    storageError: null,
    pending: 0,
    toast: null,
    reveal: null,
  });
});
afterEach(async () => {
  cleanup();
  await waitFor(() => expect(useApp.getState().pending).toBe(0));
});

it("refuses a mutation that the loader could not reopen", () => {
  const original = useApp.getState().data;
  const invalid = task({ every: 0 });
  expect(useApp.getState().change((d) => ({ ...d, tasks: [invalid] }))).toBe(
    false,
  );
  expect(useApp.getState().data).toBe(original);
  expect(saveNotebook).not.toHaveBeenCalled();
});
it("normalizes an invalid hidden field when switching schedule modes", () => {
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>
        <TaskEditor task={null} close={vi.fn()} />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Task name"), {
    target: { value: "A one-off" },
  });
  fireEvent.change(screen.getByLabelText("Every", { exact: true }), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Once" }));
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  expect(useApp.getState().data.tasks).toHaveLength(1);
  expect(() => parseNotebook(useApp.getState().data)).not.toThrow();
});
it("rejects whitespace onboarding rewards and personalizes one reward of each size", () => {
  useApp.setState({
    data: { ...emptyNotebook(), tasks: [task()], rewards: REWARD_SUGGESTIONS },
  });
  render(
    <MemoryRouter>
      <Welcome />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Small reward"), {
    target: { value: "   " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Looks good to me" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(useApp.getState().data.rewards[0].title.trim()).not.toBe("");
  fireEvent.change(screen.getByLabelText("Small reward"), {
    target: { value: "A coffee" },
  });
  fireEvent.change(screen.getByLabelText("Medium reward"), {
    target: { value: "My medium reward" },
  });
  fireEvent.change(screen.getByLabelText("Big reward"), {
    target: { value: "My big reward" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Looks good to me" }));
  expect(
    useApp.getState().data.rewards.find((r) => r.size === "medium")?.title,
  ).toBe("My medium reward");
  expect(
    useApp.getState().data.rewards.find((r) => r.size === "big")?.title,
  ).toBe("My big reward");
});
it("leaves older resolved one-offs in history without showing them on Today", () => {
  const t = {
    ...task({ kind: "once", start: "2026-11-14" }),
    title: "Yesterday's one-off",
  };
  useApp.setState({
    data: {
      ...emptyNotebook(),
      tasks: [t],
      events: [
        {
          id: "old",
          type: "completed",
          taskId: t.id,
          taskTitle: t.title,
          period: `${t.id}:once`,
          at: new Date("2026-11-14T12:00:00").toISOString(),
          roll: 0.9,
          reward: null,
        },
      ],
    },
  });
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>
        <Dashboard />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
  expect(screen.queryByText(t.title, { exact: true })).not.toBeInTheDocument();
  expect(useApp.getState().data.events).toHaveLength(1);
});
it("recognizes a swipe starting on task text and suppresses its edit click", () => {
  const t = task();
  const data = { ...emptyNotebook(), tasks: [t] };
  useApp.setState({ data });
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>
        <TaskRow period={periodFor(t, [], now, data.preferences)} />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
  const title = screen.getByText(t.title, { exact: true });
  fireEvent.touchStart(title, {
    changedTouches: [{ clientX: 250, clientY: 150 }],
  });
  fireEvent.touchEnd(title, {
    changedTouches: [{ clientX: 60, clientY: 150 }],
  });
  expect(useApp.getState().data.events.at(-1)?.type).toBe("snoozed");
  fireEvent.click(title);
  expect(openTask).not.toHaveBeenCalled();
});

it("keeps a focused undo notification until focus leaves", () => {
  vi.useFakeTimers();
  try {
    useApp.setState({ toast: { message: "Done.", undo: vi.fn() } });
    render(<Toast />);
    const undo = screen.getByRole("button", { name: "Undo" });
    fireEvent.focus(undo);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    fireEvent.blur(undo, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.queryByRole("button", { name: "Undo" }),
    ).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it("does not persist a start date whose next period could exceed supported date keys", () => {
  const original = useApp.getState().data;
  expect(
    useApp.getState().change((d) => ({
      ...d,
      tasks: [task({ kind: "weekly", start: "9999-12-31", weekdays: [0] })],
    })),
  ).toBe(false);
  expect(useApp.getState().data).toBe(original);
  expect(saveNotebook).not.toHaveBeenCalled();
});
it("does not report a successful undo when saving is blocked", () => {
  const t = task();
  useApp.setState({
    data: {
      ...emptyNotebook(),
      tasks: [t],
      events: [
        {
          id: "skip",
          type: "skipped",
          taskId: t.id,
          taskTitle: t.title,
          period: `${t.id}:once`,
          at: now.toISOString(),
        },
      ],
    },
    storageError: "Saving failed",
    toast: { message: "Skipped this time." },
  });
  useApp.getState().undo("skip");
  expect(useApp.getState().data.events).toHaveLength(1);
  expect(useApp.getState().toast?.message).not.toBe("Undone.");
});
it("dismisses the replacement toast after its focused Undo button is removed", () => {
  vi.useFakeTimers();
  try {
    useApp.setState({
      toast: {
        message: "Done.",
        undo: () => useApp.getState().notify({ message: "Undone." }),
      },
    });
    render(<Toast />);
    const undo = screen.getByRole("button", { name: "Undo" });
    act(() => {
      undo.focus();
    });
    fireEvent.click(undo);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it.each(["paused", "archived"] as const)(
  "keeps %s status and accurate feedback when status undo cannot save",
  (status) => {
    useApp.setState({ data: { ...emptyNotebook(), tasks: [task()] } });
    useApp.getState().setTaskStatus("walk", status);
    const undo = useApp.getState().toast?.undo;
    expect(undo).toBeTypeOf("function");
    useApp.setState({ storageError: "Saving failed" });
    undo!();
    expect(useApp.getState().data.tasks[0].status).toBe(status);
    expect(useApp.getState().toast?.message).not.toBe("Undone.");
  },
);
