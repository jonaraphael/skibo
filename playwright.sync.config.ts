import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "sync.spec.ts",
  timeout: 120_000,
  workers: 1,
  outputDir: "test-results/sync",
});
