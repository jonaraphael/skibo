import { expect, Page, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Notebook } from "../../app/types";
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
    .then((el) => el.getByRole("link", { name, exact: true }).click());
const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
const seed = async (page: Page, notebook?: Notebook) => {
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

test("first intention, reward, undo, saved roll, menu, record, and reload", async ({
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
  await expect(page).toHaveTitle("Skibo — Little by little.");
  await expect(
    page.getByRole("link", { name: "Skibo home", exact: true }),
  ).toBeVisible();
  const manifest = await page.request.get("manifest.webmanifest");
  expect(await manifest.json()).toMatchObject({
    name: "Skibo",
    short_name: "Skibo",
  });
  await expect(
    page.getByRole("heading", { name: "Small steps. Something good." }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("welcome.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Let's begin" }).click();
  await page.getByLabel("A habit I want to build").fill("Take a little walk");
  await page
    .getByRole("button", { name: "Give it something to look forward to" })
    .click();
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
  await page.getByRole("button", { name: "Try it with this habit" }).click();
  await page.getByRole("button", { name: "Try a practice pull" }).click();
  await expect(
    page.getByText("This practice always wins.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "New climbing shoes" }),
  ).toBeVisible();
  await expect(page.getByText(/Write down as many habits/)).toBeVisible();
  await page.getByRole("button", { name: "Write down my habits" }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  const habitSheet = page.getByRole("dialog", { name: "A new intention" });
  await expect(habitSheet).toBeVisible();
  await habitSheet.getByLabel("Task name").fill("Water the indoor plants");
  await habitSheet
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(habitSheet).toHaveCount(0);
  await nav(page, "Today");
  await expect(
    page.getByRole("heading", { name: "A little progress, every day." }),
  ).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: "Take a little walk" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Complete Take a little walk", exact: true })
    .click();
  const reveal = page.getByRole("dialog", { name: "Something good, earned" });
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
  await page
    .getByRole("link", { name: "Your record", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your cumulative record" }),
  ).toBeVisible();
  await expect(
    page.getByText("1 of 1 completions", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("record.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "Your tray" })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("tray.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enjoy", exact: true }).click();
  await expect(
    page.getByText("Your next good thing is out there.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fancy coffee at your favorite local café",
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Rewards", exact: true })
    .getByRole("link", { name: "The menu" })
    .click();
  await expect(page.locator(".menu-card")).toHaveCount(178);
  await expect(
    page.getByRole("heading", { name: "A perfect flat white" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add reward", exact: true }).click();
  await page.getByLabel("Reward name").fill("An afternoon at the museum");
  await page
    .getByRole("dialog", { name: "Something to look forward to" })
    .getByRole("button", { name: "big", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to my menu" }).click();
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
  const sheet = page.getByRole("dialog", { name: "A new intention" });
  await sheet.getByLabel("Task name").fill("Water the plants");
  await sheet.getByRole("button", { name: "After done", exact: true }).click();
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
  await expect(
    page.getByRole("heading", { name: "Give your week some shape." }),
  ).toBeVisible();
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
    page.getByText("No intentions found.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "paused", exact: true }).click();
  await expect(
    page.getByText("3 days after done · paused", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Actions for Water the plants").click();
  await page.getByRole("button", { name: "Archive task", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByText("3 days after done · paused", { exact: true }),
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
    .getByRole("button", { name: "Skip this time", exact: true })
    .click();
  await expect(complete).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(complete).toBeVisible();
  await page
    .getByRole("link", { name: "Your record", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("0 of 0 completions", { exact: true }),
  ).toBeVisible();
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

test("hidden invalid schedule fields and partial years cannot corrupt the saved notebook", async ({
  page,
}) => {
  await seed(page);
  await go(page);
  await page
    .getByRole("button", { name: "Add a task", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "A new intention" });
  await sheet.getByLabel("Task name").fill("   ");
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(sheet.getByRole("alert")).toBeInViewport();
  await sheet.getByLabel("Task name").fill("A safe one-off");
  await sheet.getByLabel("Every", { exact: true }).fill("");
  await sheet.getByRole("button", { name: "Monthly", exact: true }).click();
  await sheet.getByLabel("Day of month", { exact: false }).fill("");
  await sheet.getByRole("button", { name: "Once", exact: true }).click();
  await sheet.getByRole("button", { name: "Pick a day", exact: true }).click();
  await sheet.getByLabel("Start date").fill("0026-11-20");
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Start date").fill("2026-11-15");
  await sheet.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.getByText("A safe one-off", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your notebook needs a moment." }),
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
    page.getByRole("heading", { name: "Your notebook needs a moment." }),
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
