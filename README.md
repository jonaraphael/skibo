# Skibo

A calmer place for small intentions, with a chance at something good.

Add a task, choose rewards that matter to you, and make a little progress. Each completion gets a 30% reward roll. Wins stay in your tray until you enjoy them.

- **Today:** one row per task, grouped into overdue, today, anytime, and done.
- **Plan:** a week forecast, task search, and active/paused/archived intentions.
- **Rewards:** your tray, an editable menu, payout forecasts, and the full completion record.
- **Your rhythm:** local dates, a custom day-start hour, light/dark/system themes, reduced motion, optional sound, and a weekly cap on big rewards.
- **Your notebook:** IndexedDB storage, offline operation after the first visit, validated JSON backups, and one-time import from the original `sb:root` data.

## Schedules and rewards

Tasks can happen once (with or without a date), every N days, on selected weekdays every N weeks, monthly by date or nth weekday, or N hours/days/weeks after completion. Short months use their last day when a requested date does not exist. Calendar routines have one open period; missed dates never create extra rows. Finishing late advances the schedule from the actual completion day. Pausing and archiving keep history.

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
npm test                 # deterministic calendar, rewards, import, and undo tests
npm run build            # strict TypeScript + production PWA
npx playwright install chromium
npm run test:e2e         # production app on mobile and desktop Chromium
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing local Chromium binary. CI verifies both UTC and America/New_York and runs browser tests under `/skinner/`.

## Data and recovery

Skibo was previously called SkinnerBox. The published URL and browser database are preserved so existing notebooks continue to open after the rename.

A version 2 notebook stores tasks, the reward menu, preferences, and an append-only action journal in one IndexedDB transaction. Generated occurrences are no longer stored. Original `sb:root` data stays untouched after import. Import preserves surviving original completion and reward records; history already discarded by the old app cannot be recovered. Dates follow the device's local timezone. Original wins appear in the tray because the old app did not record enjoyment. The loading-error screen can export raw stored data for recovery.

Use **Settings → Download backup** before clearing browser data or moving devices. Restore validates the complete file before offering to replace the notebook. Other tabs cannot silently overwrite a newer revision: a stale tab stops saving and offers an export of its current state. Use one tab for editing; reload other tabs to see the saved version.

This version is a browser-local PWA. Reminders and automatic cross-device sync are future phases; neither is simulated. There is no account or server dependency.

## GitHub Pages

`.github/workflows/ci.yml` verifies PRs. `.github/workflows/deploy.yml` builds and deploys pushes to `main`. Set repository Pages source to **GitHub Actions**.

`VITE_BASE_PATH` controls the deployment path. CI sets `/skinner/`; the deploy workflow derives it from the repository name. Hash routing keeps routes and reloads inside the PWA's scope, including on static GitHub Pages.

See [the redesign scope](docs/redesign.md) and [release checks](RELEASE_CHECKLIST.md).
