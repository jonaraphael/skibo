import { expect, Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyNotebook } from "../../lib/persistence/notebook";
import { task } from "../fixtures";
const go = async (page: Page, path = "") => page.goto(`./#${path}`);
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Primary", exact: true })
    .isVisible()
    .then((visible) =>
      visible
        ? page.getByRole("navigation", { name: "Primary", exact: true })
        : page.getByRole("navigation", {
            name: "Mobile navigation",
            exact: true,
          }),
    )
    .then((el) => el.getByRole("link", { name, exact: false }).click());
const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
const seed = async (page: Page, notebook?: unknown) => {
  const data = notebook ?? {
    ...emptyNotebook(),
    tasks: [task({ start: "2026-01-31" })],
    onboarded: true,
  };
  await page.addInitScript((root) => {
    const request = indexedDB.open("skibo", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("notebook");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("notebook", "readwrite");
      const get = tx.objectStore("notebook").get("root");
      get.onsuccess = () => {
        if (!get.result) tx.objectStore("notebook").put(root, "root");
      };
      tx.oncomplete = () => db.close();
    };
  }, data);
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00-05:00"));
});

test("first task, reward, undo, saved roll, menu, record, and reload", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Crypto.prototype.getRandomValues = function <
      T extends ArrayBufferView | null,
    >(array: T): T {
      if (array) new Uint8Array(array.buffer).fill(0);
      return array;
    };
  });
  await go(page);
  await expect(page).toHaveTitle("Skibo — Tasks and rewards");
  await expect(
    page.getByRole("link", { name: "Skibo home", exact: true }),
  ).toBeVisible();
  const manifest = await page.request.get("manifest.webmanifest");
  expect(await manifest.json()).toMatchObject({
    name: "Skibo",
    short_name: "Skibo",
  });
  await expect(
    page.getByRole("heading", { name: "Do what you want to do more often." }),
  ).toBeVisible();
  // The headline holds its two phrases, one per line, on phone and desktop.
  expect(
    await page
      .getByRole("heading", { name: "Do what you want to do more often." })
      .evaluate((h) =>
        [...h.querySelectorAll(".phrase")].map((phrase) => {
          const box = phrase.getBoundingClientRect();
          return {
            top: Math.round(box.top),
            lines: Math.round(
              box.height / parseFloat(getComputedStyle(h).lineHeight),
            ),
          };
        }),
      ),
  ).toEqual([
    { top: expect.any(Number), lines: 1 },
    { top: expect.any(Number), lines: 1 },
  ]);
  expect(await page.locator(".welcome-art .sprig-leaf").count()).toBe(10);
  expect(await page.locator(".welcome-art .sprig-flower").count()).toBe(2);
  await page.screenshot({
    path: testInfo.outputPath("welcome.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("First task").fill("Take a little walk");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Yes, each one adds up" }).check();
  await page.getByRole("radio", { name: "Time since I last did it" }).check();
  await page.getByRole("radio", { name: "It gets worse each day" }).check();
  await expect(page.getByLabel("Your task rules")).toContainText("Practice");
  await noOverflow(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("“Take a little walk”")).toBeVisible();
  await page.getByRole("radio", { name: "Heavy effort, big rewards" }).check();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("habit-rewards.png"),
    fullPage: true,
  });
  await page.getByText("Add rewards of your own").click();
  await page
    .getByLabel("Small reward", { exact: true })
    .fill("A perfect flat white");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Try a practice pull" }).click();
  await expect(
    page.getByText("This practice always wins.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "New climbing shoes" }),
  ).toBeVisible();
  await expect(page.getByText(/Add the other habits/)).toBeVisible();
  await page.getByRole("button", { name: "Add more tasks" }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  const habitSheet = page.getByRole("dialog", { name: "New task" });
  await expect(habitSheet).toBeVisible();
  await habitSheet.getByLabel("Task name").fill("Water the indoor plants");
  await habitSheet
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(habitSheet).toHaveCount(0);
  await nav(page, "Today");
  await expect(
    page.getByRole("heading", { name: "Sunday, November 15" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: "Take a little walk" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Complete Take a little walk", exact: true })
    .click();
  const reveal = page.getByRole("dialog", { name: "Reward" });
  await expect(
    reveal.getByRole("heading", {
      name: "Fancy coffee at your favorite local café",
    }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("reward-reveal.png"),
    fullPage: false,
  });
  await reveal.getByRole("button", { name: "Keep in tray" }).click();
  const undoToast = page.getByRole("button", { name: "Undo", exact: true });
  await undoToast.focus();
  await undoToast.press("Enter");
  await page.mouse.move(0, 0);
  await expect(page.locator(".toast")).toHaveCount(0, { timeout: 6500 });
  await page.evaluate(() => {
    Crypto.prototype.getRandomValues = function <
      T extends ArrayBufferView | null,
    >(array: T): T {
      if (array) new Uint8Array(array.buffer).fill(255);
      return array;
    };
  });
  await page
    .getByRole("button", { name: "Complete Take a little walk", exact: true })
    .click();
  await expect(
    reveal.getByRole("heading", {
      name: "Fancy coffee at your favorite local café",
    }),
  ).toBeVisible();
  await reveal.getByRole("button", { name: "Keep in tray" }).click();
  await nav(page, "Rewards");
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your cumulative record" }),
  ).toBeVisible();
  await expect(page.getByText("1 of 1 draws", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("record.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Tray" })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("tray.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enjoy", exact: true }).click();
  await expect(
    page.getByText("No rewards waiting.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fancy coffee at your favorite local café",
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Menu" })
    .click();
  await expect(page.locator(".menu-item")).toHaveCount(178);
  await expect(
    page.getByRole("heading", { name: "A perfect flat white" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add reward", exact: true }).click();
  await page.getByLabel("Reward name").fill("An afternoon at the museum");
  await page
    .getByRole("dialog", { name: "New reward" })
    .getByRole("button", { name: "big", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "New reward" })
    .getByRole("button", { name: "Add reward" })
    .click();
  await expect(
    page.getByRole("heading", { name: "An afternoon at the museum" }),
  ).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.screenshot({
    path: testInfo.outputPath("menu.png"),
    fullPage: false,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "An afternoon at the museum" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.screenshot({
    path: testInfo.outputPath("settings.png"),
    fullPage: true,
  });
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.getByLabel("Reduced motion", { exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await nav(page, "Today");
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("today-dark.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("plan, custom schedules, pause, archive, undo and file backup", async ({
  page,
}, testInfo) => {
  await seed(page);
  await go(page);
  await page
    .getByRole("button", { name: "Add a task", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "New task" });
  await sheet.getByLabel("Task name").fill("Water the plants");
  await sheet
    .getByRole("radio", { name: "Time since I last did it", exact: true })
    .check();
  await sheet.getByLabel("Every", { exact: true }).fill("3");
  await sheet.getByRole("button", { name: "light", exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("new-task.png"),
    fullPage: false,
  });
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: "Water the plants", exact: false })
      .first(),
  ).toBeVisible();
  await nav(page, "Plan");
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("plan.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await page.getByLabel("Search tasks").fill("Water");
  await page.getByLabel("Actions for Water the plants").click();
  await page.getByRole("button", { name: "Pause task", exact: true }).click();
  await expect(
    page.getByText("No tasks found.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "paused", exact: true }).click();
  await expect(
    page.getByText("Upkeep · 3 days after done · paused", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Actions for Water the plants").click();
  await page.getByRole("button", { name: "Archive task", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByText("Upkeep · 3 days after done · paused", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toMatch(
    /^skibo-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const backupPath = testInfo.outputPath("notebook.json");
  await downloaded.saveAs(backupPath);
  await page
    .getByLabel("Backup file", { exact: true })
    .setInputFiles(backupPath);
  await expect(
    page.getByRole("dialog", { name: "Restore your notebook" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(
    page.getByText("Your backup has been restored.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2,"tasks":[]}'),
  });
  await expect(page.getByRole("alert")).toContainText("valid Skibo backup");
});

test("keeps the notebook in the Pages scope and survives offline reload", async ({
  page,
  context,
  baseURL,
}) => {
  await seed(page);
  await go(page);
  await expect(page.getByText("Take a walk", { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(new URL(baseURL!).pathname);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByText("Take a walk", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Take a walk", { exact: true })).toBeVisible();
});

test("a stale tab cannot overwrite a saved notebook", async ({
  page,
  context,
}) => {
  await seed(page);
  await go(page, "/settings");
  await expect(page.getByLabel("Appearance", { exact: true })).toBeVisible();
  const other = await context.newPage();
  await go(other, "/settings");
  await expect(other.getByLabel("Appearance", { exact: true })).toBeVisible();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await other.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(other.getByRole("alert")).toContainText(
    "Another tab changed your notebook",
  );
  await expect(
    other.getByRole("button", { name: "Download current copy" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "dark",
  );
  await other.close();
});

test("snooze and skip are reversible without consuming a reward roll", async ({
  page,
}) => {
  await seed(page);
  await go(page);
  const complete = page.getByRole("button", {
    name: "Complete Take a walk",
    exact: true,
  });
  await expect(complete).toBeVisible();
  await page.getByLabel("Actions for Take a walk").click();
  await page
    .getByRole("button", { name: "Move to tomorrow", exact: true })
    .click();
  await expect(complete).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(complete).toBeVisible();
  await page.getByLabel("Actions for Take a walk").click();
  await page
    .getByRole("button", { name: "Declare a miss", exact: true })
    .click();
  await expect(complete).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(complete).toBeVisible();
  await nav(page, "Rewards");
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Record", exact: true })
    .click();
  await expect(page.getByText("0 of 0 draws", { exact: true })).toBeVisible();
});

test("paused row menus stay above following rows and completed tasks offer keyboard undo", async ({
  page,
}, testInfo) => {
  const data = {
    ...emptyNotebook(),
    onboarded: true,
    tasks: [
      {
        ...task(),
        id: "first",
        title: "First paused task",
        status: "paused" as const,
      },
      {
        ...task(),
        id: "second",
        title: "Second paused task",
        status: "paused" as const,
      },
    ],
  };
  await seed(page, data);
  await go(page, "/plan");
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await page.getByRole("button", { name: "paused", exact: true }).click();
  await page.getByLabel("Actions for First paused task").click();
  await expect
    .poll(async () =>
      page.locator(".row-menu[open] .popover").evaluate((el) => {
        const menu = el.getBoundingClientRect();
        const limit = Math.min(
          window.innerHeight,
          ...[...document.querySelectorAll(".mobile-nav, .mobile-fab")]
            .map((n) => n.getBoundingClientRect())
            .filter((r) => r.height > 0)
            .map((r) => r.top),
        );
        return menu.top >= 0 && menu.bottom <= limit;
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("paused-menu.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Resume task", exact: true }).click();
  await expect(
    page.getByText("First paused task", { exact: true }),
  ).toHaveCount(0);
  await nav(page, "Today");
  await page.addInitScript(() => {
    Crypto.prototype.getRandomValues = function <
      T extends ArrayBufferView | null,
    >(a: T): T {
      if (a) new Uint8Array(a.buffer).fill(255);
      return a;
    };
  });
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await page
    .getByRole("button", { name: "Complete First paused task", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0, { timeout: 7000 });
  const undo = page.getByRole("button", {
    name: "Undo First paused task",
    exact: true,
  });
  await undo.focus();
  await undo.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Complete First paused task",
      exact: true,
    }),
  ).toBeEnabled();
});

test("invalid dates and intervals cannot corrupt the saved notebook", async ({
  page,
}) => {
  await seed(page);
  await go(page);
  await page
    .getByRole("button", { name: "Add a task", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "New task" });
  await sheet.getByLabel("Task name").fill("   ");
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(sheet.getByRole("alert")).toBeInViewport();
  await sheet.getByLabel("Task name").fill("A safe one-off");
  await sheet.getByRole("radio", { name: "A date on the calendar" }).check();
  await sheet
    .getByRole("combobox", { name: "Repeats", exact: true })
    .selectOption("once");
  await sheet.getByLabel("First start date").fill("0026-11-20");
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("First start date").fill("2026-11-15");
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByText("A safe one-off", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unable to open your notebook." }),
  ).toHaveCount(0);
});

test("exports raw stored data if an existing notebook cannot open", async ({
  page,
}, testInfo) => {
  const data = {
    ...emptyNotebook(),
    tasks: [task({ every: 0 })],
    onboarded: true,
  };
  await seed(page, data);
  await go(page);
  await expect(
    page.getByRole("heading", { name: "Unable to open your notebook." }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download stored data", exact: true })
    .click();
  const download = await downloading;
  const path = testInfo.outputPath("raw-notebook.json");
  await download.saveAs(path);
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(data);
});

test("evidence strips update with rewards and undo, survive reload, and stay readable in Plan", async ({
  page,
}, testInfo) => {
  const data = emptyNotebook();
  data.onboarded = true;
  data.preferences.theme = "light";
  data.preferences.reduceMotion = true;
  const writing = {
    ...task({ start: "2026-11-02" }),
    title: "Write 500 words",
    effort: "solid" as const,
  };
  const once = {
    ...task({ kind: "once", start: "2026-01-31" }),
    id: "expenses",
    title: "File expenses",
  };
  const after = {
    ...task({ kind: "after", start: "2026-11-15", every: 3 }),
    id: "plants",
    title: "Water the plants",
  };
  data.tasks = [writing, once, after];
  for (let day = 2; day <= 14; day++) {
    if ([5, 9, 11].includes(day)) continue;
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    data.events.push({
      id: `write-${day}`,
      type: "completed",
      taskId: writing.id,
      taskTitle: writing.title,
      period: `${writing.id}:${date}:start:r1:unit:0`,
      at: `${date}T17:00:00.000Z`,
      roll: day === 14 ? 0.1 : 0.9,
      reward:
        day === 14
          ? {
              id: "reward",
              title: "Record store visit",
              size: "medium",
              active: true,
            }
          : null,
    });
  }
  await seed(page, data);
  await page.addInitScript(() => {
    Crypto.prototype.getRandomValues = function <
      T extends ArrayBufferView | null,
    >(array: T): T {
      if (array) new Uint8Array(array.buffer).fill(0);
      return array;
    };
  });
  await go(page);
  const row = page.getByRole("article").filter({ hasText: writing.title });
  await expect(row.locator(".history-cell")).toHaveCount(14);
  await expect(
    row.getByRole("img", {
      name: /^10 of the last 14 scheduled days completed/,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: once.title })
      .locator(".task-history-strip"),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: after.title })
      .locator(".task-history-strip"),
  ).toHaveCount(0);
  await expect(page.locator(".tray-preview")).toContainText(
    "Record store visit",
  );
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("evidence-today.png"),
    fullPage: true,
  });
  await row
    .getByRole("button", { name: `Complete ${writing.title}`, exact: true })
    .click();
  const reveal = page.getByRole("dialog", { name: "Reward", exact: true });
  await expect(
    reveal.getByRole("img", {
      name: /^11 of the last 14 scheduled days completed/,
    }),
  ).toBeVisible();
  await expect(row.locator(".task-meta")).not.toContainText("Every day");
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("evidence-reward.png") });
  await reveal.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    row.getByRole("img", {
      name: /^10 of the last 14 scheduled days completed/,
    }),
  ).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(
    row.getByRole("img", {
      name: /^10 of the last 14 scheduled days completed/,
    }),
  ).toBeVisible();
  await nav(page, "Plan");
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await expect(
    row.getByRole("img", {
      name: /^10 of the last 14 scheduled days completed/,
    }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("evidence-plan.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await noOverflow(page);
  await expect(row.locator(".history-count")).toBeInViewport();
});

test("holds protect the whole tray and declared misses release it without losing rewards", async ({
  page,
}) => {
  const data = emptyNotebook();
  data.onboarded = true;
  data.preferences.reduceMotion = true;
  const practice = {
    ...task({ kind: "after", start: "2026-11-01", every: 7 }),
    behavior: { ...task().behavior, payoff: "more" as const },
    title: "Piano practice",
  };
  const tank = {
    ...task({ kind: "after", start: "2026-11-08", every: 7 }),
    id: "plants",
    title: "Water plants",
    behavior: { ...task().behavior, cost: "cliff" as const, lead: 1 },
  };
  data.tasks = [practice, tank];
  data.events = [
    {
      id: "earned",
      type: "completed",
      taskId: practice.id,
      taskTitle: practice.title,
      period: `${practice.id}:after:0:r1:unit:0`,
      at: "2026-11-10T17:00:00.000Z",
      roll: 0.1,
      reward: data.rewards[0],
    },
  ];
  await seed(page, data);
  await go(page, "/rewards/tray");
  const holds = page.getByRole("region", { name: "Reward tray holds" });
  await expect(holds).toContainText("Water plants");
  await expect(
    page.getByRole("button", { name: "On hold", exact: true }),
  ).toBeDisabled();
  await noOverflow(page);
  await page.reload();
  await expect(holds).toBeVisible();
  await holds
    .getByRole("button", { name: "Declare a miss for Water plants" })
    .click();
  await expect(holds).toHaveCount(0);
  await expect(page.locator(".reward-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Enjoy", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Record" })
    .click();
  await expect(
    page.getByText("Water plants · Declared miss", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Tray", exact: false })
    .click();
  await page.getByRole("button", { name: "Enjoy", exact: true }).click();
  await expect(page.locator(".reward-card")).toHaveCount(0);
});

test("setup derives Tank, early resets take no draw, and repeated practice stays available", async ({
  page,
}) => {
  const data = emptyNotebook();
  data.onboarded = true;
  data.preferences.reduceMotion = true;
  await seed(page, data);
  await go(page);
  await page
    .getByRole("button", { name: "Add a task", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const editor = page.getByRole("dialog", { name: "New task" });
  await editor.getByLabel("Task name").fill("Water plants");
  await editor
    .getByRole("radio", { name: "Nothing, then a sharp cost" })
    .check();
  await expect(editor.getByLabel("Your task rules")).toContainText("Tank");
  await expect(editor.getByLabel("Your task rules")).toContainText(
    "Earlier completions restart the clock with no draw",
  );
  await noOverflow(page);
  await editor.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete Water plants", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Reward", exact: true }),
  ).toHaveCount(0);
  // The early reset reads as done today, and stays undoable.
  await expect(
    page.getByRole("button", { name: "Undo Water plants", exact: true }),
  ).toBeEnabled();
  await nav(page, "Rewards");
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Record" })
    .click();
  await expect(
    page.getByText("Clock restarted · no draw", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 of 0 draws", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Clock restarted · no draw", { exact: true }),
  ).toBeVisible();
  await nav(page, "Today");
  await page
    .getByRole("button", { name: "Add a task", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await editor.getByLabel("Task name").fill("Piano practice");
  await editor.getByRole("radio", { name: "Yes, each one adds up" }).check();
  await expect(editor.getByLabel("Your task rules")).toContainText("Practice");
  await editor.getByRole("button", { name: "Add task", exact: true }).click();
  // Lose both draws to keep the test on the task list.
  await page.evaluate(() => {
    Crypto.prototype.getRandomValues = function <
      T extends ArrayBufferView | null,
    >(array: T): T {
      if (array) new Uint8Array(array.buffer).fill(255);
      return array;
    };
  });
  const complete = page.getByRole("button", {
    name: "Complete Piano practice",
    exact: true,
  });
  await complete.click();
  await expect(complete).toBeEnabled();
  await complete.click();
  await nav(page, "Rewards");
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Record" })
    .click();
  await expect(page.getByText("0 of 2 draws", { exact: true })).toBeVisible();
});

test("an empty notebook from before the taxonomy update opens and upgrades atomically", async ({
  page,
}) => {
  const stored = {
    ...emptyNotebook(),
    version: 2,
    revision: 12,
    onboarded: true,
    rewards: [
      { id: "personal", title: "My coffee", size: "small", active: false },
    ],
    preferences: { ...emptyNotebook().preferences, theme: "dark" },
  };
  await seed(page, stored);
  await go(page);
  await expect(
    page.getByRole("heading", { name: "Sunday, November 15" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unable to open your notebook." }),
  ).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await nav(page, "Rewards");
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Menu" })
    .click();
  await expect(
    page.getByRole("heading", { name: "My coffee", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".menu-item")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({
    ...stored,
    version: 3,
    revision: 13,
  });
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("an unreadable notebook offers download, cancellation, and an explicit fresh start", async ({
  page,
}, testInfo) => {
  const oldTask: Record<string, unknown> = { ...task() };
  delete oldTask.behavior;
  delete oldTask.rhythmRevision;
  const stored = {
    ...emptyNotebook(),
    version: 2,
    revision: 7,
    tasks: [oldTask],
    onboarded: true,
  };
  await seed(page, stored);
  await go(page);
  await expect(page.getByRole("alert")).toContainText(
    "before task rhythms were added",
  );
  await page
    .getByRole("button", { name: "Start a new notebook", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Start a new notebook",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Keep existing data", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Unable to open your notebook." }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download stored data", exact: true })
    .click();
  const download = await downloading;
  const backup = testInfo.outputPath("original-v2.json");
  await download.saveAs(backup);
  expect(JSON.parse(await readFile(backup, "utf8"))).toEqual(stored);
  await page
    .getByRole("button", { name: "Start a new notebook", exact: true })
    .click();
  await dialog
    .getByRole("button", {
      name: "Replace this device’s notebook",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Do what you want to do more often." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Get started", exact: true }),
  ).toBeVisible();
});
