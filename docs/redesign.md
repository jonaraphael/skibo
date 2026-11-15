# A little intention. A little good.

The redesign centers a complete loop: choose something to do, finish it, see the outcome, and enjoy something you chose. The product should make the next action obvious while remaining comfortable to return to after an absence.

## The experience

Today is the home screen. It shows a day record, one open row per active task, and a persistent reward tray. Late tasks retain their original date but never multiply. Effort appears as three quiet dots; amber is reserved for rewards. Completing a task gives brief feedback, followed by a reward sheet on a win. Both quiet outcomes and wins count as progress.

Plan combines the old Tasks and Upcoming screens. A seven-day view shows calendar forecasts and the next known after-completion date. All Tasks supports search, pause, resume, and archive. Editing a task includes its recent history. Future repeats are predictions rather than stored task instances.

Rewards has three views: Tray for wins waiting to be enjoyed, Menu for active/paused rewards and the current odds, and Record for actual completion outcomes. A cumulative step chart marks reward events in amber. The menu includes three general starters and the original 90 reward texts as editable inspiration. Existing notebooks import their original reward pool.

First run adds a daily intention, personalizes three reward sizes, then offers a clearly labeled practice pull. The practice always wins and never changes history or the tray. Settings covers appearance, motion, sound, day start, reward cap, and file backup/restore.

## Visual system

Warm paper and quiet green structure the workspace. Serif headings soften the application; compact sans-serif controls and monospace labels keep it legible. Desktop uses a fixed navigation rail and a two-column Today workspace. Mobile uses three bottom navigation destinations and task sheets. Native dialogs provide focus containment, Escape handling, and focus return. Controls have keyboard focus states; device reduced-motion preferences apply independently of the app toggle.

## Domain rules

- Calendar schedules use local date arithmetic, with explicit tests across DST and month ends.
- Each routine has one unresolved period. Completion or skip advances to the next scheduled date after the actual action day. After-completion intervals use their configured hour/day/week unit.
- The action journal is preserved. Undo adds a reversal event; it does not erase history. A redraw of the same period reuses its original roll and reward.
- Reward selection first draws a hit with probability 0.30, then draws a size from the effective mix, then a uniform reward within that size. No hidden per-item eligibility filter changes the published mix.
- A weekly cap removes big rewards from the eligible mix after the cap is reached. Missing/paused sizes are treated the same way. Menu and engine share the same mix calculation.
- IndexedDB writes are atomic and revision-checked. Import is strict and non-destructive until explicitly restored. Migration never removes the original localStorage key.

## Verification

Unit tests cover schedules, probability distributions, menu eligibility, caps, undo, and data validation/migration. Browser tests exercise onboarding, practice, completion, reward reveal, roll reuse, enjoyment and undo, menu editing, task management, backup restoration, original data import, scope-safe reload, and offline reload on desktop and mobile. PR CI runs the unit suite in UTC and America/New_York and browser tests under the repository base path.

## Later phases

Reminders require a separate delivery architecture. Automatic sync requires an identity and conflict model. Both remain outside this browser-local release. The original timezone preference never influenced schedules; this release explicitly follows the device timezone. File backups provide deliberate movement between devices.
