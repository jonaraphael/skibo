# Skibo

Do what you want to do more often.

Add a task, choose rewards that matter to you, and build a record of your effort. Eligible completions draw from your reward menu. Standard draws have a 30% win chance. Wins stay in your tray until you enjoy them.

New notebooks come with 177 personal reward ideas, from good coffee and garden upgrades to climbing gear and time off, with big rewards capped at one per week by default. The walkthrough connects a habit that's hard to start with reward examples at every tier, lets you add your own, and finishes by inviting you to write down more habits.

- **Today** shows open tasks, including anything carried forward, with counts and tray holds, beside the plant you are growing. Each open task is a blank leaf; a completion fills it and a reward makes it a flower. Select a leaf or flower to see the task that earned it. After two days, a row shows how many days have passed since its last completion. Click an open row to complete it, or open its menu to edit. Repeatable tasks start alongside other tasks. After their first check of the day, available repeats move to **Run it back** with their daily count. Select the done count beneath the date to see and undo individual completions.
- **Plan:** a week forecast, task search, and active/paused/archived tasks.
- **Rewards:** your tray, an editable menu, payout forecasts, and the full completion record. The tab shows how many rewards are waiting.
- **Garden:** every finished plant on its own sheet. Pea Shoot is first and takes 10 completions; finishing a plant opens the choice of twelve seeds for the next one.
- **Your rhythm:** local dates, a custom day-start hour, light/dark/system themes, reduced motion, optional sound, and a weekly cap on big rewards.
- **Your notebook:** IndexedDB storage, offline operation after the first visit, and validated JSON backups.

## Schedules and rewards

Task setup asks three questions: does a second session today count, does a calendar date or your last completion start the clock, and does waiting cost a little each day or become costly after a grace period? New tasks start with no radio choices selected; all three behavior questions must be answered before saving. The answers derive one of eight rhythms. The form reads back the draw and hold rules before you save; onboarding uses the same questions.

| Rhythm | Draws | Holds |
| --- | --- | --- |
| Target | Every unit until the deadline | Behind the daily straight-line pace; the first unit each local day releases it for that day |
| Backlog | Every unit owed; calendar rounds add units to the pile | Never; shows units owed |
| Lapse | Every unit | At the app due time, ahead of the real limit |
| Practice | Every session | Never |
| Deadline | Once per window, from opening through late completion | At the app due time, ahead of the real deadline |
| Start date | Once per round, from its start date onward | Never |
| Tank | From halfway to the app due time | At the app due time, ahead of the real limit |
| Upkeep | From halfway to due | Never |

Tank and Upkeep can be completed early: that restarts the clock and records a completion without taking a draw. The halfway fraction is adjustable. Safety margins place holds before a real limit. A hold locks enjoyment of the whole tray, including newly earned rewards. Completion or a declared miss releases that task's hold; a miss forfeits the rest of the round's draws and stays in the record. Multiple holds must all be resolved. Paused and archived tasks do not hold the tray. Snoozing cannot bypass a hold.

Target windows close at their real deadline (the end of the local day when no time is set). Unmet totals automatically enter the record as misses, including after time away. There is no extra finish-line reward. Calendar schedules support once, every N days, selected weekdays every N weeks, and monthly dates or nth weekdays. Short months use their last day. Completion clocks support hours, days, and weeks, with local day boundaries and DST handling.

Calendar tasks that pay once per round show up to 14 scheduled days, oldest to newest: a leaf for a completion, a flower for a reward, an outline for the open period, and a bare stem for no completion. Late and snoozed completions fill the original calendar day; undo removes that mark. One-off, completion-clock, and multi-unit tasks have no calendar strip. Schedule edits recompute the strip; the full action record remains unchanged.

The standard hit probability is 0.30. On a winning roll, the size weights are:

| Effort | Small | Medium | Big |
| ------ | ----: | -----: | --: |
| Light  |   80% |    20% |  0% |
| Solid  |   20% |    60% | 20% |
| Heavy  |   10% |    35% | 55% |

Missing, paused, or capped sizes are removed and the remaining weights are normalized. The Menu shows the current effective mix. If there is no eligible reward, completion still counts and no reward is awarded. The observed payout rate will vary. Undoing then redoing the same unit reuses its original draw, including its reward snapshot. An early completion stays a no-draw result on redo.

Completion, declared miss, snooze, and enjoyment actions have a five-second undo; hovering or focusing the notification keeps it available. Press Command-Z (Ctrl-Z on Windows or Linux) to undo the latest completion and its draw, including a reward already marked enjoyed. The shortcut works after the notification closes. You can also undo a task’s last completion from its menu in Plan → All tasks. The countdown waits while the reward reveal is open. On touch devices, swipe a task left to move it to tomorrow, or right to declare a miss. The same actions are available in each row's menu.

## Development

```sh
npm ci
npm run dev
npm test                 # deterministic calendar, rewards, backup, and undo tests
npm run build            # strict TypeScript + production PWA
npx playwright install chromium
npm run test:e2e         # production app on mobile and desktop Chromium
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing local Chromium binary. CI verifies both UTC and America/New_York and runs browser tests under `/skinner/`.

## Data and recovery

Version 3 notebooks store the derived behavior settings alongside tasks, the reward menu, preferences, and an append-only action journal in one IndexedDB transaction. Occurrences are calculated from schedules. Dates follow the device's local timezone. Empty notebooks saved before the task-rhythm update upgrade automatically, preserving the reward menu and preferences. Older notebooks with tasks remain untouched. The loading-error screen can export raw stored data and offers an explicitly confirmed fresh start for this browser; synced account notebooks are not deleted.

Use **Settings → Download backup** before clearing browser data or moving devices. Restore validates the complete file before offering to replace the notebook. Other tabs cannot silently overwrite a newer revision: a stale tab stops saving and offers an export of its current state. Use one tab for editing; reload other tabs to see the saved version.

Skibo works entirely on this device by default. Optional Google sign-in syncs one notebook across devices using Firebase's no-cost Spark plan. Synced notebooks require internet for edits; the last saved account copy can be viewed offline. Saves check the cloud revision so another device cannot silently overwrite newer progress. Local notebooks retain offline editing, and JSON backups work in either mode.

## Optional Firebase sync

1. Create a Firebase project on **Spark** without linking a billing account. Register a web app, enable **Authentication → Google**, and add your site's hostname to Authentication's authorized domains.
2. Create **Realtime Database** in locked mode. Publish this repository's `database.rules.json` using `npx firebase deploy --only database --project YOUR_PROJECT_ID` (after `npx firebase login`).
3. Copy the web app's public configuration, including `databaseURL`, into `VITE_FIREBASE_CONFIG` as JSON. See `.env.example` for local development. For GitHub Pages, set the repository **Actions variable** `VITE_FIREBASE_CONFIG` and run the Pages deployment workflow. Never put service-account credentials in this value.
4. Open **Settings → Sync with Google** on each device. The first device supplies the notebook if the account is new. An existing account opens its cloud notebook; the separate local notebook is retained and returns when you sign out. Existing notebooks are not merged automatically.

The integration uses Google authentication and Realtime Database only, with no custom server or Cloud Functions. Spark's database limits apply across the project; sync can become unavailable if quotas are exceeded. Keep JSON backups. See [Firebase pricing](https://firebase.google.com/pricing).

Run `npm run test:sync` for local Auth/Database emulator rules and two-device browser tests. It uses the isolated `demo-skibo` project and never contacts production Firebase. Java 21 and Playwright Chromium are recommended; ports 9470–9474 must be free. The test build enables emulators temporarily; run `npm run build` afterward to return to your normal configuration. Desktop and mobile Chromium are automated; verify real Google sign-in in iPhone Safari and an installed iPhone PWA before enabling the live integration.

## GitHub Pages

`.github/workflows/ci.yml` verifies PRs. `.github/workflows/deploy.yml` builds and deploys pushes to `main`. Set repository Pages source to **GitHub Actions**.

`VITE_BASE_PATH` controls the deployment path. CI sets `/skinner/`; the deploy workflow derives it from the repository name. Hash routing keeps routes and reloads inside the PWA's scope, including on static GitHub Pages.

See [the redesign scope](docs/redesign.md) and [release checks](RELEASE_CHECKLIST.md).
