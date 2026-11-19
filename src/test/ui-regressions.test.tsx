import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useApp } from "../app/store";
import { emptyNotebook, parseNotebook } from "../lib/persistence/notebook";
import { saveNotebook } from "../lib/persistence/storage";
import { drawReward } from "../lib/rewards/engine";

import { periodFor } from "../lib/tasks/taxonomy";
import { WorkspaceContext } from "../components/Workspace";
import { Toast } from "../components/Toast";
import { Dotted } from "../components/Shared";
import { TaskRow } from "../components/TaskRow";
import { Welcome } from "../screens/Welcome";
import { TaskEditor } from "../screens/TaskEditor";
import { Dashboard } from "../screens/Dashboard";
import { Garden } from "../screens/Garden";
import { SeedPicker } from "../components/SeedPicker";
import { gardenPlants } from "../lib/garden/garden";
import { task } from "./fixtures";
vi.mock("../lib/persistence/storage", () => ({
  saveNotebook: vi.fn(async () => {}),
  loadNotebook: vi.fn(),
}));
const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};
const now = new Date("2026-11-15T12:00:00");
const openTask = vi.fn();
const workspace = {
  now,
  openTask,
  openReward: vi.fn(),
  openSeedPicker: vi.fn(),
};
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

it("refuses a mutation that the loader could not reopen", async () => {
  const original = useApp.getState().data;
  const invalid = task({ every: 0 });
  expect(
    await useApp.getState().change((d) => ({ ...d, tasks: [invalid] })),
  ).toBe(false);
  expect(useApp.getState().data).toBe(original);
  expect(saveNotebook).not.toHaveBeenCalled();
});
it("derives a calendar start-date task from the behavior questions", async () => {
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
  expect(screen.getAllByRole("radio", { checked: false })).toHaveLength(6);
  await click(screen.getByRole("button", { name: "Add task" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Answer all three questions.",
  );
  expect(useApp.getState().data.tasks).toHaveLength(0);
  await click(screen.getByRole("radio", { name: "A date on the calendar" }));
  expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
  expect(screen.queryByLabelText("Repeats", { exact: true })).toBeNull();
  await click(screen.getByRole("radio", { name: "No, once per round" }));
  await click(screen.getByRole("radio", { name: "It gets worse each day" }));
  fireEvent.change(screen.getByLabelText("Repeats", { exact: true }), {
    target: { value: "once" },
  });
  await click(screen.getByRole("button", { name: "Add task" }));
  expect(useApp.getState().data.tasks).toHaveLength(1);
  expect(() => parseNotebook(useApp.getState().data)).not.toThrow();
});
it("connects a recurring habit to tier examples and its saved reward effort", async () => {
  render(
    <MemoryRouter>
      <Welcome />
    </MemoryRouter>,
  );
  await click(screen.getByRole("button", { name: "Get started" }));
  fireEvent.change(screen.getByLabelText("First task"), {
    target: { value: "Do ten minutes of mobility" },
  });
  // Defaults never answer for the person: nothing is selected and the
  // schedule fields wait until all three questions have answers.
  expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  expect(screen.queryByLabelText("Every")).toBeNull();
  await click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Answer all three questions.",
  );
  expect(useApp.getState().data.tasks).toHaveLength(0);
  await click(screen.getByRole("radio", { name: "Yes, each one adds up" }));
  await click(screen.getByRole("radio", { name: "Time since I last did it" }));
  await click(screen.getByRole("radio", { name: "It gets worse each day" }));
  expect(screen.getByLabelText("Your task rules")).toHaveTextContent(
    "Practice",
  );
  await click(
    screen.getByRole("button", {
      name: "Continue",
    }),
  );
  expect(screen.getByText("“Do ten minutes of mobility”")).toBeVisible();
  for (const example of [
    "One seed packet chosen purely for looks",
    "Send the favorite climbing shoes out for a resole",
    "A second raised bed, or a cold frame for the one you have",
  ])
    expect(screen.getByText(example)).toBeVisible();
  expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose an effort level.",
  );
  await click(screen.getByRole("radio", { name: "Heavy effort, big rewards" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "10% small, 35% medium, 55% big",
  );
  await click(screen.getByRole("button", { name: "Continue" }));
  const data = useApp.getState().data;
  expect(data.tasks).toHaveLength(1);
  expect(data.tasks[0]).toMatchObject({
    title: "Do ten minutes of mobility",
    effort: "heavy",
    schedule: { kind: "after" },
    behavior: { payoff: "more", cost: "ramp" },
  });
  expect(data.rewards).toHaveLength(177);
  const values = [0.1, 0.9, 0];
  expect(
    drawReward(data.tasks[0].effort, data, now, {
      float01: () => values.shift()!,
    }).reward?.size,
  ).toBe("big");
  await click(screen.getByRole("button", { name: "Try a practice pull" }));
  expect(
    screen.getByRole("heading", { name: "New climbing shoes" }),
  ).toBeVisible();
  expect(useApp.getState().data.events).toHaveLength(0);
  expect(useApp.getState().data.onboarded).toBe(false);
});
it("adds optional personal rewards without replacing the default menu", async () => {
  useApp.setState({ data: { ...emptyNotebook(), tasks: [task()] } });
  const originalRewards = useApp.getState().data.rewards;
  render(
    <MemoryRouter>
      <Welcome />
    </MemoryRouter>,
  );
  expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  await click(
    screen.getByRole("radio", { name: "Solid effort, medium rewards" }),
  );
  await click(screen.getByText("Add rewards of your own"));
  fireEvent.change(screen.getByLabelText("Small reward"), {
    target: { value: "   " },
  });
  await click(screen.getByRole("button", { name: "Continue" }));
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
  await click(screen.getByRole("button", { name: "Continue" }));
  expect(useApp.getState().data.rewards).toHaveLength(180);
  expect(useApp.getState().data.rewards.slice(0, 177)).toEqual(originalRewards);
  expect(
    useApp.getState().data.rewards.find((r) => r.title === "My medium reward")
      ?.size,
  ).toBe("medium");
  expect(
    useApp.getState().data.rewards.find((r) => r.title === "My big reward")
      ?.size,
  ).toBe("big");
  await click(screen.getByRole("button", { name: "Back" }));
  await click(screen.getByRole("button", { name: "Continue" }));
  expect(useApp.getState().data.rewards).toHaveLength(180);
});
it("resumes the same habit, allows revisions, and ends by inviting more habits", async () => {
  const first = { ...task(), effort: "heavy" as const };
  useApp.setState({ data: { ...emptyNotebook(), tasks: [first] } });
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>
        <Welcome />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
  expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  await click(screen.getByRole("button", { name: "Back" }));
  fireEvent.change(screen.getByLabelText("First task"), {
    target: { value: "Stretch after running" },
  });
  await click(
    screen.getByRole("button", {
      name: "Continue",
    }),
  );
  await click(
    screen.getByRole("radio", { name: "Light effort, small rewards" }),
  );
  await click(screen.getByRole("button", { name: "Continue" }));
  expect(useApp.getState().data.tasks).toHaveLength(1);
  expect(useApp.getState().data.tasks[0]).toMatchObject({
    id: first.id,
    title: "Stretch after running",
    effort: "light",
  });
  expect(screen.getByText(/Add the other habits/)).toBeVisible();
  await click(screen.getByRole("button", { name: "Add more tasks" }));
  expect(useApp.getState().data.onboarded).toBe(true);
  expect(openTask).toHaveBeenCalledOnce();
});
it("blocks advancing the walkthrough when storage is unavailable", async () => {
  useApp.setState({
    data: { ...emptyNotebook(), tasks: [task()] },
    storageError: "Saving failed",
  });
  render(
    <MemoryRouter>
      <Welcome />
    </MemoryRouter>,
  );
  const form = screen
    .getByRole("group", {
      name: "What should doing this habit give you a chance to earn?",
    })
    .closest("form")!;
  expect(within(form).getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.submit(form);
  expect(useApp.getState().data.onboarded).toBe(false);
  expect(
    screen.getByRole("heading", { name: "Set the effort." }),
  ).toBeVisible();
});
it("leaves older resolved one-offs in history without showing them on Today", async () => {
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
          period: `${t.id}:2026-11-14:start:r1:unit:0`,
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
it("recognizes a swipe starting on task text and suppresses its completion click", async () => {
  const t = task();
  const data = { ...emptyNotebook(), tasks: [t] };
  const onComplete = vi.fn();
  useApp.setState({ data });
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>
        <TaskRow period={periodFor(t, [], now, data.preferences)} onComplete={onComplete} />
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
  await click(title);
  expect(onComplete).not.toHaveBeenCalled();
  expect(openTask).not.toHaveBeenCalled();
});

it("keeps a focused undo notification until focus leaves", async () => {
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

it("does not persist a start date whose next period could exceed supported date keys", async () => {
  const original = useApp.getState().data;
  expect(
    await useApp.getState().change((d) => ({
      ...d,
      tasks: [task({ kind: "weekly", start: "9999-12-31", weekdays: [0] })],
    })),
  ).toBe(false);
  expect(useApp.getState().data).toBe(original);
  expect(saveNotebook).not.toHaveBeenCalled();
});
it("does not report a successful undo when saving is blocked", async () => {
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
          period: `${t.id}:2026-11-14:start:r1:unit:0`,
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
it("dismisses the replacement toast after its focused Undo button is removed", async () => {
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
    await click(undo);
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
  async (status) => {
    useApp.setState({ data: { ...emptyNotebook(), tasks: [task()] } });
    await useApp.getState().setTaskStatus("walk", status);
    const undo = useApp.getState().toast?.undo;
    expect(undo).toBeTypeOf("function");
    useApp.setState({ storageError: "Saving failed" });
    await undo!();
    expect(useApp.getState().data.tasks[0].status).toBe(status);
    expect(useApp.getState().toast?.message).not.toBe("Undone.");
  },
);

it("joins dotted items so a line can only break between them", () => {
  const { container } = render(
    <p>
      <Dotted items={["2 done", "1 reward", "5 open"]} />
    </p>,
  );
  expect(container.textContent).toBe("2 done · 1 reward · 5 open");
  expect(
    [...container.querySelectorAll(".phrase")].map((el) => el.textContent),
  ).toEqual(["2 done ·", "1 reward ·", "5 open"]);
});

it("enforces every active hold in store actions, including snooze and direct enjoyment", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    const tank = {
      ...task({ kind: "after", start: "2026-11-01", every: 7 }),
      behavior: { ...task().behavior, cost: "cliff" as const, lead: 1 },
    };
    const deadline = {
      ...task({ kind: "once", start: "2026-11-15" }),
      id: "deadline",
      behavior: {
        ...task().behavior,
        cost: "cliff" as const,
        windowStart: "2026-11-01",
        lead: 1,
      },
    };
    const data = { ...emptyNotebook(), tasks: [tank, deadline] };
    data.events.push({
      id: "earned",
      type: "completed",
      taskId: tank.id,
      taskTitle: tank.title,
      period: "old",
      at: "2026-11-01T12:00:00.000Z",
      roll: 0.1,
      reward: data.rewards[0],
    });
    useApp.setState({ data });
    await useApp.getState().enjoy("earned");
    expect(useApp.getState().data.events).toHaveLength(1);
    await useApp
      .getState()
      .snooze(periodFor(tank, data.events, now, data.preferences));
    expect(useApp.getState().data.events).toHaveLength(1);
    await useApp
      .getState()
      .skip(periodFor(tank, data.events, now, data.preferences));
    await useApp.getState().enjoy("earned");
    expect(
      useApp.getState().data.events.filter((e) => e.type === "enjoyed"),
    ).toHaveLength(0);
    const updated = useApp.getState().data;
    await useApp
      .getState()
      .complete(periodFor(deadline, updated.events, now, updated.preferences));
    await useApp.getState().enjoy("earned");
    expect(useApp.getState().data.events.at(-1)?.type).toBe("enjoyed");
  } finally {
    vi.useRealTimers();
  }
});

it("records expired Target windows automatically and only once", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    const target = {
      ...task({ kind: "once", start: "2026-11-14" }),
      behavior: {
        ...task().behavior,
        payoff: "more" as const,
        cost: "cliff" as const,
        windowStart: "2026-11-01",
        goal: 5,
      },
    };
    useApp.setState({ data: { ...emptyNotebook(), tasks: [target] } });
    await useApp.getState().settle();
    expect(useApp.getState().data.events).toHaveLength(1);
    expect(useApp.getState().data.events[0].type).toBe("missed");
    await useApp.getState().settle();
    expect(useApp.getState().data.events).toHaveLength(1);
    expect(() => parseNotebook(useApp.getState().data)).not.toThrow();
  } finally {
    vi.useRealTimers();
  }
});

it("keeps history and starts fresh rounds when changing clocks, while title edits keep the same rhythm", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    const data = {
      ...emptyNotebook(),
      tasks: [task({ kind: "after", start: "2026-11-01", every: 7 })],
    };
    useApp.setState({ data });
    await useApp
      .getState()
      .complete(periodFor(data.tasks[0], [], now, data.preferences));
    const prior = useApp.getState().data.tasks[0];
    await useApp.getState().saveTask({ ...prior, title: "Renamed" }, prior.id);
    expect(useApp.getState().data.tasks[0].rhythmRevision).toBe(1);
    await useApp.getState().saveTask(
      {
        ...prior,
        schedule: { ...prior.schedule, kind: "once", start: "2026-11-15" },
      },
      prior.id,
    );
    const updated = useApp.getState().data;
    expect(updated.tasks[0].rhythmRevision).toBe(2);
    expect(updated.events.filter((e) => e.type === "completed")).toHaveLength(
      1,
    );
    expect(
      periodFor(updated.tasks[0], updated.events, now, updated.preferences)
        .bucket,
    ).toBe("today");
    expect(() => parseNotebook(updated)).not.toThrow();
  } finally {
    vi.useRealTimers();
  }
});

it("rejects invalid Target input before trying to evaluate its schedule", async () => {
  const invalid = {
    ...task({ every: 0 }),
    behavior: {
      ...task().behavior,
      cost: "cliff" as const,
      payoff: "more" as const,
    },
  };
  expect(
    await useApp.getState().change((d) => ({ ...d, tasks: [invalid] })),
  ).toBe(false);
  expect(useApp.getState().data.tasks).toHaveLength(0);
  expect(saveNotebook).not.toHaveBeenCalled();
});

it("keeps saved answers selected when editing a task", () => {
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>
        <TaskEditor task={task()} close={vi.fn()} />
      </WorkspaceContext.Provider>
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(3);
  expect(
    screen.getByRole("radio", { name: "No, once per round" }),
  ).toBeChecked();
  expect(
    screen.getByRole("radio", { name: "A date on the calendar" }),
  ).toBeChecked();
  expect(
    screen.getByRole("radio", { name: "It gets worse each day" }),
  ).toBeChecked();
  expect(screen.getByLabelText("Your task rules")).toBeVisible();
});

const grown = (count: number) => {
  const habit = task();
  const at = now.toISOString();
  return {
    ...emptyNotebook(),
    tasks: [habit],
    garden: [{ seed: "pea", at, start: 0 }],
    events: Array.from({ length: count }, (_, index) => ({
      id: `garden-${index}`,
      type: "completed" as const,
      at,
      period: `round-${index}`,
      taskId: habit.id,
      taskTitle: habit.title,
      roll: 0.1,
      reward:
        index === 0
          ? { id: "tea", title: "Tea break", size: "medium" as const, active: true }
          : null,
    })),
  };
};
const screenIn = (ui: ReactNode) =>
  render(
    <MemoryRouter>
      <WorkspaceContext.Provider value={workspace}>{ui}</WorkspaceContext.Provider>
    </MemoryRouter>,
  );

it("offers a new seed only after the growing plant is finished", async () => {
  useApp.setState({ data: grown(9) });
  await act(async () => {
    expect(await useApp.getState().plantSeed("basil")).toBe(false);
  });
  expect(useApp.getState().data.garden).toHaveLength(1);
  const today = screenIn(<Dashboard />);
  const herbarium = within(screen.getByRole("region", { name: "Herbarium" }));
  expect(herbarium.getByLabelText("9 of 10 completions")).toBeVisible();
  expect(herbarium.queryByRole("button", { name: /seed/i })).toBeNull();
  expect(document.querySelector(".tray-panel")).toBeNull();
  today.unmount();

  useApp.setState({ data: grown(10) });
  const close = vi.fn();
  const picker = render(
    <SeedPicker
      plant={gardenPlants(useApp.getState().data).at(-1)!}
      close={close}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Pea Shoot is fully grown!" }),
  ).toBeVisible();
  expect(
    screen.getByText(/10 completions grew 9 leaves and 1 flower\./),
  ).toBeVisible();
  expect(screen.getAllByRole("button", { name: /\d+ tasks/ })).toHaveLength(12);
  await click(screen.getByRole("button", { name: /Basil 12 tasks/ }));
  const restored = parseNotebook(
    JSON.parse(JSON.stringify(useApp.getState().data)),
  );
  expect(restored.garden?.map(({ seed }) => seed)).toEqual(["pea", "basil"]);
  picker.unmount();

  screenIn(<Dashboard />);
  expect(
    within(screen.getByRole("region", { name: "Herbarium" })).getByLabelText(
      "0 of 12 completions",
    ),
  ).toBeVisible();
});

it("shows each finished plant as a garden sheet whose blossoms stay inspectable", async () => {
  const data = grown(10);
  useApp.setState({
    data: {
      ...data,
      garden: [...data.garden, { seed: "basil", at: data.garden[0].at, start: 10 }],
    },
  });
  screenIn(<Garden />);
  expect(document.querySelector(".page-heading .lede")).toHaveTextContent(
    "1 plant · 9 leaves · 1 flower",
  );
  const sheets = within(screen.getByRole("list", { name: "Finished plants" }));
  expect(sheets.getAllByRole("button")).toHaveLength(1);
  await click(sheets.getByRole("button", { name: /^No\. 1, Pea Shoot, 9 leaves and 1 flower/ }));
  const sheet = within(screen.getByRole("dialog", { name: "No. 1 · Pea Shoot" }));
  expect(sheet.getByLabelText("10 of 10 completions")).toBeVisible();
  fireEvent.keyDown(sheet.getByRole("button", { name: "Inspect flower 1" }), {
    key: "Enter",
  });
  expect(sheet.getByText("Tea break · medium reward")).toBeVisible();
  fireEvent.keyDown(sheet.getByRole("button", { name: "Inspect leaf 2" }), {
    key: "Enter",
  });
  expect(sheet.getByText("No reward drawn")).toBeVisible();
  expect(sheet.queryByText("Tea break · medium reward")).toBeNull();
});
