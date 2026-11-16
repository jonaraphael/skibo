# Skibo

Do what you want to do more often.

Add a task, choose rewards that matter to you, and build a record of your effort. Each completion gets a 30% reward roll. Wins stay in your tray until you enjoy them.

New notebooks come with 177 personal reward ideas, from good coffee and garden upgrades to climbing gear and time off, with big rewards capped at one per week by default. The walkthrough connects a habit that's hard to start with reward examples at every tier, lets you add your own, and finishes by inviting you to write down more habits.

- **Today:** one row per task, grouped into overdue, today, anytime, and done.
- **Plan:** a week forecast, task search, and active/paused/archived tasks.
- **Rewards:** your tray, an editable menu, payout forecasts, and the full completion record.
- **Your rhythm:** local dates, a custom day-start hour, light/dark/system themes, reduced motion, optional sound, and a weekly cap on big rewards.
- **Your notebook:** IndexedDB storage, offline operation after the first visit, and validated JSON backups.

## Schedules and rewards

Tasks can happen once (with or without a date), every N days, on selected weekdays every N weeks, monthly by date or nth weekday, or N hours/days/weeks after completion. Short months use their last day when a requested date does not exist. Calendar routines have one open period; missed dates never create extra rows. Finishing late advances the schedule from the actual completion day. Pausing and archiving keep history.

Skibo draws two marks: a leaf for each day a task was done and a flower for each reward. Calendar task rows show up to 14 scheduled days along a stem, oldest to newest: a leaf for a completion, a flower for a reward, an outlined leaf for the open period, and a closed bud for a skipped period. Bare stem has no completion. Late and snoozed completions fill the original due day; undo removes that mark. The count includes the open day. One-off and after-completion tasks have no calendar strip. Schedule edits recompute the strip against the current schedule; the full action record remains unchanged.

The hit probability is fixed at 0.30. On a winning roll, the size weights are:

| Effort | Small | Medium | Big |
| ------ | ----: | -----: | --: |
| Light  |   80% |    20% |  0% |
| Solid  |   20% |    60% | 20% |
| Heavy  |   10% |    35% | 55% |

Missing, paused, or capped sizes are removed and the remaining weights are normalized. The Menu shows the current effective mix. If there is no eligible reward, completion still counts and no reward is awarded. The observed payout rate will vary. Undoing then redoing the same period reuses its original draw, including its reward snapshot.

Completion, skip, snooze, and enjoyment actions have a five-second undo; hovering or focusing the notification keeps it available. Completed rows also offer an Undo button. The countdown waits while the reward reveal is open. On touch devices, swipe a task left to move it to tomorrow, or right to skip the open period. The same actions are available in each row's menu.

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

A notebook stores tasks, the reward menu, preferences, and an append-only action journal in one IndexedDB transaction. Occurrences are calculated from schedules. Dates follow the device's local timezone. The loading-error screen can export raw stored data for recovery.

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
