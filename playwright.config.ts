import { defineConfig, devices } from "@playwright/test";
const basePath = process.env.VITE_BASE_PATH ?? "/";
export default defineConfig({
  testDir: "./src/test/e2e",
  timeout: 45_000,
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:4173${basePath}`,
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: `http://127.0.0.1:4173${basePath}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
