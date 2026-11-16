import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  VITE_FIREBASE_EMULATORS: "true",
  VITE_FIREBASE_CONFIG: JSON.stringify({
    apiKey: "demo-skibo",
    authDomain: "demo-skibo.firebaseapp.com",
    databaseURL: "https://demo-skibo-default-rtdb.firebaseio.com",
    projectId: "demo-skibo",
    appId: "demo-skibo",
  }),
};
for (const [command, args] of [
  ["npm", ["run", "build"]],
  ["node", ["--test", "scripts/sync-rules.test.mjs"]],
  ["npx", ["playwright", "test", "--config", "playwright.sync.config.ts"]],
]) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
