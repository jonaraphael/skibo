import { expect, Page, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Notebook } from "../../app/types";
import { emptyNotebook } from "../../lib/persistence/notebook";
import { task } from "../fixtures";

const seed = async (page: Page, title: string) => {
  const data: Notebook = {
    ...emptyNotebook(),
    onboarded: true,
    tasks: [{ ...task({ kind: "once", start: "2026-01-31" }), title }],
  };
  await page.addInitScript((root) => {
    const request = indexedDB.open("skibo", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("notebook");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("notebook", "readwrite");
      const stored = tx.objectStore("notebook").get("root");
      stored.onsuccess = () => {
        if (!stored.result) tx.objectStore("notebook").put(root, "root");
      };
      tx.oncomplete = () => db.close();
    };
  }, data);
};
const login = async (page: Page, email: string) => {
  await page.goto("./#/settings");
  const popupReady = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sync with Google" }).click();
  const popup = await popupReady;
  await popup.locator(".js-new-account").waitFor();
  const existing = popup
    .locator(".js-reuse-account")
    .filter({ hasText: email });
  if (await existing.count()) await existing.click();
  else {
    await popup.getByRole("button", { name: "Add new account" }).click();
    await popup.locator("#email-input").fill(email);
    await popup.getByRole("button", { name: "Sign in with Google" }).click();
  }
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.locator(".settings-panel").getByText("Synced", { exact: true })).toBeVisible();
};
const stored = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("skibo", 1);
      request.onsuccess = () => resolve(request.result);
    });
    const result = await new Promise<{ data: Notebook }[]>((resolve) => {
      const request = db
        .transaction("notebook")
        .objectStore("notebook")
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return result.filter((entry) => entry.data).map((entry) => entry.data);
  });

test("syncs two devices, completes once, survives offline reload, and isolates accounts", async ({
  browser,
  page,
  context,
  baseURL,
}, testInfo) => {
  const secondContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const second = await secondContext.newPage();
  for (const ctx of [context, secondContext])
    await ctx.route(
      /^https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
      (route) => route.abort(),
    );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  second.on("pageerror", (error) => errors.push(error.message));
  const email = `sync-${randomUUID()}@example.com`;
  try {
    await seed(page, "Cloud habit");
    await seed(second, "Separate local habit");
    await login(page, email);
    await login(second, email);
    await page.goto("./#/");
    await second.goto("./#/");
    await expect(
      second.getByRole("button", { name: "Complete Cloud habit", exact: true }),
    ).toBeEnabled();
    await expect(
      second.getByText("Separate local habit", { exact: true }),
    ).toHaveCount(0);
    await Promise.all([
      page.getByRole("button", { name: "Complete Cloud habit", exact: true }).evaluate((button: HTMLButtonElement) => button.click()),
      second.getByRole("button", { name: "Complete Cloud habit", exact: true }).evaluate((button: HTMLButtonElement) => button.click()),
    ]);
    await expect
      .poll(
        async () =>
          (await stored(page))[0]?.events.filter((e) => e.type === "completed")
            .length,
      )
      .toBe(1);
    await expect
      .poll(
        async () =>
          (await stored(second))[0]?.events.filter(
            (e) => e.type === "completed",
          ).length,
      )
      .toBe(1);
    for (const device of [page, second]) {
      await expect(device.locator(".roll-status")).toHaveCount(0);
      const keep = device.getByRole("button", { name: "Keep in tray" });
      if (await keep.isVisible()) await keep.click();
    }
    await page.goto("./#/settings");
    const dismiss = page.getByRole("button", { name: "Dismiss notification" });
    if (await dismiss.isVisible()) await dismiss.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("sync-settings.png"),
      fullPage: true,
    });
    await page.getByLabel("Day starts at").selectOption("5");
    await second.goto("./#/settings");
    await expect(second.getByLabel("Day starts at")).toHaveValue("5");

    const backup = await stored(page);
    const restored = {
      ...backup[0],
      tasks: [{ ...backup[0].tasks[0], title: "Restored cloud habit" }],
    };
    await page
      .getByLabel("Backup file")
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(restored)),
      });
    await page.getByRole("button", { name: "Restore this backup" }).click();
    await expect
      .poll(async () => (await stored(second))[0]?.tasks[0].title)
      .toBe("Restored cloud habit");

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByLabel("Day starts at")).toHaveValue("5");
    await expect(page.getByLabel("Day starts at")).toBeDisabled();
    await expect(
      page.locator(".storage-error strong").getByText("Offline—view only", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("sync-offline.png"),
      fullPage: true,
    });
    await context.setOffline(false);
    await expect(page.getByLabel("Day starts at")).toBeEnabled();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sync with Google" }),
    ).toBeVisible();
    await page.goto("./#/");
    await expect(
      page.getByRole("button", { name: "Complete Cloud habit", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Restored cloud habit", { exact: true }),
    ).toHaveCount(0);

    await login(page, `different-${randomUUID()}@example.com`);
    await expect(page.getByLabel("Day starts at")).toHaveValue("0");
    await page.goto("./#/");
    await expect(
      page.getByText("Restored cloud habit", { exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await secondContext.close();
  }
});
