import { expect, Locator, Page, test } from "@playwright/test";
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

const answerRhythm = async (
  scope: Page | Locator,
  answers = [
    "No, once per round",
    "Time since I last did it",
    "It gets worse each day",
  ],
) => {
  for (const name of answers)
    await scope.getByRole("radio", { name, exact: true }).check();
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
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
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
  await expect(habitSheet.getByRole("radio", { checked: true })).toHaveCount(0);
  await answerRhythm(habitSheet);
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
  const walkAgain = page.getByRole("button", { name: "Complete Take a little walk", exact: true });
  const reveal = page.getByRole("dialog", { name: "Reward" });
  for (const n of [1, 2]) {
    await walkAgain.click();
    await expect(walkAgain).toBeEnabled();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await expect(reveal).toHaveCount(0);
    await expect(page.locator(".task-meta").filter({ hasText: `Completed ${n} ${n === 1 ? "time" : "times"} today` })).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Complete Take a little walk", exact: true })
    .click();
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
  await expect(page.getByText("1 of 3 draws", { exact: true })).toBeVisible();
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

test("weekdays only hides weekend obligations and keeps the task editable", async ({ page }) => {
  await seed(page);
  await go(page);
  await expect(page.getByText("1 open", { exact: true })).toBeVisible();
  await page.getByLabel("Actions for Take a walk").click();
  await page.getByRole("button", { name: "Edit task & history" }).click();
  const toggle = page.getByRole("checkbox", { name: "Weekdays only" });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeHidden();
  await expect(page.getByText("0 open", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("No tasks due.")).toBeVisible();
  await nav(page, "Plan");
  await expect(page.getByText("No tasks scheduled.")).toBeVisible();
  await page.getByRole("button", { name: "Saturday, November 14" }).click();
  await expect(page.getByText("No tasks scheduled.")).toBeVisible();
  await page.getByRole("button", { name: "All tasks" }).click();
  await expect(page.getByText("Take a walk", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete Take a walk" })).toHaveCount(0);
  await page.getByLabel("Actions for Take a walk").click();
  await page.getByRole("button", { name: "Edit task & history" }).click();
  await expect(toggle).toBeChecked();

  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00-05:00"));
  await go(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Complete Take a walk" })).toBeVisible();
  await expect(page.getByText("1 open", { exact: true })).toBeVisible();
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
  await answerRhythm(sheet);
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

test("paused row menus fit the screen and completed tasks can be undone from Plan", async ({
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
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tasks 0" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No tasks due." }),
  ).toBeVisible();
  await nav(page, "Plan");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await page.getByLabel("Actions for First paused task").click();
  const undo = page.getByRole("button", { name: "Undo last completion" });
  await undo.focus();
  await undo.press("Enter");
  await nav(page, "Today");
  await expect(
    page.getByRole("button", {
      name: "Complete First paused task",
      exact: true,
    }),
  ).toBeEnabled();
});

test("carried tasks check off and a completion clock returns when it reopens today", async ({
  page,
}) => {
  const hourly = {
    ...task({ kind: "after", every: 2, unit: "hours", start: "2026-11-14" }),
    id: "water",
    title: "Water seedlings",
  };
  await seed(page, {
    ...emptyNotebook(),
    onboarded: true,
    tasks: [task({ start: "2026-11-14" }), hourly],
    rewards: [],
  });
  await go(page);
  const group = page.locator(".task-groups");
  await expect(page.getByRole("heading", { name: /^(Today|Anytime|Run it back)$/ })).toHaveCount(0);
  await expect(group.getByRole("article")).toHaveCount(2);
  const walk = group.getByRole("article").filter({ hasText: "Take a walk" });
  const message = await walk.locator(".task-meta").innerText();
  expect(message.trim()).toBeTruthy();
  expect(message).not.toMatch(/idle days?|Available since|Completed 0|not completed yet|since last completed/i);
  await expect(group.locator(".task-meta").filter({ hasText: message })).toHaveCount(1);
  await expect(group.getByRole("img", { name: /Nov 14: Open/ })).toBeVisible();
  await expect(group).not.toContainText(/overdue|past due/i);
  await walk.locator(".task-title").click();
  const checked = group.getByRole("button", { name: "Completed Take a walk" });
  await expect(checked).toBeDisabled();
  await expect(group.getByRole("article")).toHaveCount(1);
  const summary = page.getByRole("button", { name: "1 done", exact: true });
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await summary.click();
  const history = page.getByRole("region", { name: "Done today" });
  await expect(history.getByRole("article")).toHaveCount(1);
  await expect(history).toContainText("Take a walk");
  await summary.click();
  await expect(history).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "1 done", exact: true }).click();
  await history.getByRole("button", { name: /Undo completion of Take a walk/ }).click();
  await expect(history).toContainText("No completions yet today.");
  await expect(walk.locator(".task-meta")).toHaveText(message);
  await page.getByRole("button", { name: "0 done", exact: true }).click();
  await walk.getByRole("button", { name: "Complete Take a walk" }).click();

  await nav(page, "Plan");
  await page.getByRole("button", { name: "Complete Water seedlings" }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Complete Water seedlings" }).click();
  await nav(page, "Today");
  await expect(page.getByRole("heading", { name: "Tasks 0" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);

  // This clock's next draw opens halfway through its two-hour interval.
  await page.clock.setFixedTime(new Date("2026-11-15T13:00:00-05:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Complete Water seedlings" }),
  ).toBeEnabled();
  await expect(page.getByRole("article")).not.toContainText("since last completed");
});

test("clicking the row draws a check, wipes its contents, then slides the next task up", async ({
  page,
}) => {
  const first = task({ kind: "once", start: "2026-11-14" });
  const second = { ...first, id: "stretch", title: "Stretch" };
  await seed(page, { ...emptyNotebook(), tasks: [first, second], onboarded: true, rewards: [] });
  await go(page);
  const row = page.locator(".task-row").first();
  const next = page.locator('[data-task-id="stretch"]');
  if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
    await row.locator(".task-title").hover();
    await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
  await row.getByLabel("Actions for Take a walk").click();
  await row.getByRole("button", { name: "Edit task & history" }).click();
  const editor = page.getByRole("dialog", { name: "Edit task" });
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "0 done" })).toBeVisible();

  const walk = page.locator('[data-task-id="walk"]');
  const listY = (row: Locator) => row.evaluate((el) =>
    el.getBoundingClientRect().top - el.closest(".workspace-main")!.getBoundingClientRect().top,
  );
  const start = await listY(next);
  const finish = await listY(walk);
  await walk.locator(".task-title").click();
  await expect(editor).toHaveCount(0);
  await expect(walk.locator(".checked path")).toBeVisible();
  await expect(walk).toHaveCSS("mask-position", /^100% 0/);
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-task-id="walk"].finishing');
    return el && getComputedStyle(el).maskPosition.startsWith("0% ");
  });
  expect(await listY(next)).toBeCloseTo(start, 0);
  // Wait for the survivor's actual animation and sample it halfway through.
  const sample = await page.waitForFunction(() => {
    const el = document.querySelector('[data-task-id="stretch"]')!;
    const slide = el.getAnimations().find((a) => a.id === "task-list-move");
    if (!slide) return null;
    slide.pause();
    slide.currentTime = Number(slide.effect!.getTiming().duration) / 2;
    const top = el.getBoundingClientRect().top - el.closest(".workspace-main")!.getBoundingClientRect().top;
    slide.finish();
    return top;
  });
  const middle = await sample.jsonValue();
  expect(middle).toBeLessThan(start);
  expect(middle).toBeGreaterThan(finish);
  expect(await listY(next)).toBeCloseTo(finish, 0);
});

test("checks move repeatable tasks to the bottom and only the elapsed number changes color", async ({
  page,
}) => {
  const data = emptyNotebook();
  data.onboarded = true;
  data.preferences.dayStart = 4;
  data.preferences.reduceMotion = true;
  data.rewards = [];
  const upkeep = task({ kind: "after", every: 5, start: "2026-11-01" });
  const first = {
    ...upkeep, id: "sketch", title: "Sketch",
    behavior: { ...upkeep.behavior, payoff: "more" as const },
  };
  const second = { ...first, id: "read", title: "Read" };
  data.tasks = [first, second, upkeep];
  data.events.push({
    id: "prior", type: "completed", taskId: upkeep.id, taskTitle: upkeep.title,
    period: `${upkeep.id}:after:0:r1:unit:0`, at: "2026-11-10T13:00:00-05:00",
    roll: 0.9, reward: null,
  });
  await seed(page, data);
  await go(page);
  const repeats = page.locator(".task-group").filter({
    has: page.getByRole("heading", { name: "Run it back" }),
  });
  const walk = page.getByRole("article").filter({ hasText: upkeep.title });
  const normal = page.locator(".task-group.main");
  await expect(repeats).toHaveCount(0);
  await expect(normal.locator(".task-title")).toHaveCount(3);
  await expect(walk).toContainText("5 days since last completed");
  await expect(walk).not.toContainText(/due nov/i);
  await expect(walk.locator(".elapsed-highlight")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-11-15T13:00:01-05:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(walk.locator(".elapsed-highlight")).toHaveText("5");

  const sketch = page.locator(".task-groups").getByRole("article").filter({ hasText: "Sketch" });
  const check = sketch.getByRole("button", { name: "Complete Sketch" });
  // The padding at the top edge also belongs to the completion button.
  await sketch.click({ position: { x: 4, y: 4 } });
  await expect(repeats.locator(".task-title")).toHaveText(["Sketch"]);
  await expect(page.locator(".task-groups .task-title").last()).toHaveText("Sketch");
  await expect(sketch).toHaveClass(/completed-repeat/);
  await expect(sketch.locator(".task-copy")).toHaveCSS("opacity", "0.78");
  await expect(sketch.locator(".task-meta")).toHaveText("Completed 1 time today");
  await check.click();
  await page.getByRole("button", { name: "2 done", exact: true }).click();
  const history = page.getByRole("region", { name: "Done today" });
  await history.getByRole("article").last().getByRole("button", { name: /Undo completion/ }).click();
  await expect(history.getByRole("article")).toHaveCount(1);
  await expect(sketch.locator(".task-meta")).toHaveText("Completed 1 time today");
  await history.getByRole("button", { name: /Undo completion/ }).click();
  await expect(repeats).toHaveCount(0);
  await expect(normal.locator(".task-title")).toHaveCount(3);
  await check.press("Space");
  await expect(repeats.locator(".task-title")).toHaveText(["Sketch"]);
  await nav(page, "Plan");
  await expect(page.locator(".plan-list .task-title").last()).toHaveText("Sketch");
  await nav(page, "Today");
  await page.clock.setFixedTime(new Date("2026-11-16T03:59:59-05:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(sketch).toHaveClass(/completed-repeat/);
  await page.clock.setFixedTime(new Date("2026-11-16T04:00:00-05:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(sketch).not.toHaveClass(/completed-repeat/);
  await expect(repeats).toHaveCount(0);
  await expect(normal.locator(".task-title")).toHaveCount(3);
  await expect(sketch).not.toContainText("since last completed");
  await expect(sketch.locator(".task-meta .phrase")).toHaveCount(1);
  await page.clock.setFixedTime(new Date("2026-11-17T04:00:00-05:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(sketch.locator(".task-meta")).toContainText("2 days since last completed");
  await expect(sketch.locator(".task-meta .phrase")).toHaveCount(2);
});

test("keyboard undo preserves text edits and can reverse an enjoyed reward after reload", async ({
  page,
}) => {
  const data = emptyNotebook();
  const t = task({ kind: "after", start: "2026-11-01" });
  t.behavior.payoff = "more";
  data.tasks = [t];
  data.onboarded = true;
  data.events = [0, 1].map((i) => ({
    id: `check-${i}`,
    type: "completed",
    taskId: t.id,
    taskTitle: t.title,
    period: `${t.id}:after:${i}:r1:unit:0`,
    at: `2026-11-15T1${i}:00:00-05:00`,
    roll: i ? 0.1 : 0.9,
    reward: i ? data.rewards[0] : null,
  }));
  data.events.push({
    id: "enjoy", type: "enjoyed", target: "check-1",
    at: "2026-11-15T11:05:00-05:00",
  });
  await seed(page, data);
  await go(page, "/plan");
  const search = page.getByRole("textbox", { name: "Search tasks" });
  await search.fill("walk");
  await search.press("Meta+z");
  await nav(page, "Today");
  await page.getByRole("button", { name: "2 done", exact: true }).click();
  const history = page.getByRole("region", { name: "Done today" });
  await expect(history.getByRole("article")).toHaveCount(2);
  await expect(history.getByRole("article").first()).toContainText(data.rewards[0].title);
  await page.reload();
  await expect(page.getByRole("button", { name: "2 done", exact: true })).toBeVisible();
  await page.keyboard.press("Meta+z");
  await expect(page.getByRole("button", { name: "1 done", exact: true })).toBeVisible();
  await expect(page.locator(".page-heading")).toContainText("0 rewards");
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "0 done", exact: true })).toBeVisible();
  await expect(page.locator(".task-meta")).not.toContainText("Completed");
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
  await answerRhythm(sheet, [
    "No, once per round",
    "A date on the calendar",
    "It gets worse each day",
  ]);
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
  await expect(row.locator(".task-meta")).not.toContainText("Every day");
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
  await expect(page.locator(".tray-panel")).toHaveCount(0);
  await expect(
    page.locator(".nav-badge, .mobile-nav a i").filter({ visible: true }),
  ).toHaveText("1");
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
  await expect(
    page.locator(".task-row").filter({ hasText: writing.title }),
  ).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("evidence-reward.png") });
  await page.keyboard.press("Meta+z");
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
  await answerRhythm(editor, [
    "No, once per round",
    "Time since I last did it",
    "Nothing, then a sharp cost",
  ]);
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
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
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
  await expect(editor.getByRole("radio", { checked: true })).toHaveCount(0);
  await answerRhythm(editor, [
    "Yes, each one adds up",
    "Time since I last did it",
    "It gets worse each day",
  ]);
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

test("every new-task dialog starts blank, including after cancelling or adding a task", async ({
  page,
}) => {
  await seed(page);
  await go(page);
  const open = () =>
    page
      .getByRole("button", { name: "Add a task", exact: true })
      .filter({ visible: true })
      .first()
      .click();
  const editor = page.getByRole("dialog", { name: "New task" });
  await open();
  await expect(editor.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(editor.getByLabel("Your task rules")).toHaveCount(0);
  await editor.getByLabel("Task name").fill("An unfinished draft");
  await editor
    .getByRole("radio", { name: "No, once per round", exact: true })
    .check();
  await expect(editor.getByRole("radio", { checked: true })).toHaveCount(1);
  await editor.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "Answer all three questions.",
  );
  await editor
    .getByRole("button", { name: "Close New task", exact: true })
    .click();
  await nav(page, "Plan");
  await open();
  await expect(editor.getByRole("radio", { checked: true })).toHaveCount(0);
  await editor.getByLabel("Task name").fill("An intentional task");
  await answerRhythm(editor);
  await editor.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await open();
  await expect(editor.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("the last completion opens the seed picker after the reward, and the plant moves to the Garden", async ({
  page,
}) => {
  const habit = { ...task({ start: "2026-11-01" }), title: "Stretch" };
  const data = emptyNotebook();
  data.onboarded = true;
  data.preferences.reduceMotion = true;
  data.tasks = [habit];
  data.garden = [{ seed: "pea", at: "2026-11-01T12:00:00.000Z", start: 0 }];
  for (let day = 1; day <= 9; day++) {
    const date = `2026-11-0${day}`;
    data.events.push({
      id: `grow-${day}`,
      type: "completed",
      taskId: habit.id,
      taskTitle: habit.title,
      period: `${habit.id}:${date}:start:r1:unit:0`,
      at: `${date}T17:00:00.000Z`,
      roll: 0.9,
      reward: null,
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
  const herbarium = page.getByRole("region", { name: "Herbarium" });
  await expect(herbarium.getByLabel("9 of 10 completions")).toBeVisible();
  await expect(page.getByRole("button", { name: /seed/i })).toHaveCount(0);
  await expect(page.locator(".workspace-topbar")).toHaveCount(0);
  await nav(page, "Garden");
  await expect(
    page.getByRole("heading", { name: "No finished plants yet." }),
  ).toBeVisible();
  await nav(page, "Today");

  await page
    .getByRole("button", { name: "Complete Stretch", exact: true })
    .click();
  const reveal = page.getByRole("dialog", { name: "Reward" });
  const picker = page.getByRole("dialog", { name: "Choose a seed packet" });
  await expect(reveal).toBeVisible();
  await expect(picker).toHaveCount(0);
  await reveal.getByRole("button", { name: "Keep in tray" }).click();
  await expect(
    picker.getByRole("heading", { name: "Pea Shoot is fully grown!" }),
  ).toBeVisible();
  await expect(picker.getByRole("button", { name: /\d+ tasks/ })).toHaveCount(
    12,
  );
  await noOverflow(page);
  await picker.getByRole("button", { name: /Fennel 18 tasks/ }).click();
  await expect(picker).toHaveCount(0);
  await expect(herbarium.getByLabel("0 of 18 completions")).toBeVisible();

  await nav(page, "Garden");
  const sheet = page.getByRole("button", {
    name: /^No\. 1, Pea Shoot, 9 leaves and 1 flower/,
  });
  await expect(sheet).toBeVisible();
  await noOverflow(page);
  await sheet.click();
  const specimen = page.getByRole("dialog", { name: "No. 1 · Pea Shoot" });
  await specimen.getByRole("button", { name: "Inspect flower 10" }).click();
  await expect(specimen.locator(".specimen-pop")).toContainText("Stretch");
});
