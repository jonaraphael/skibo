# Tasks, rewards, and evidence

The redesign centers a complete loop: choose something to do, finish it, see the outcome, and enjoy something you chose. The product should make the next action obvious while remaining comfortable to return to after an absence.

## The experience

Today is the home screen. It shows the date and outcome counts, one open row per active task with a 14-period evidence strip, and a list of waiting rewards. Open tasks carry forward. Recurring and multi-unit tasks appear under On repeat. The done count opens today’s completion history. Effort appears as three quiet dots; amber is reserved for rewards. Completing a task draws a check and fades its row away. The next unit appears when its schedule opens. A win opens the reward sheet. On each strip a leaf marks a completion and a flower marks a reward; the same two marks appear in onboarding, the reward sheet, the tray, and the record. Late completions count toward the original due day, and undo removes the mark. Strips follow the current calendar schedule; one-off, after-completion, and multi-unit tasks have no strip.

Plan combines the old Tasks and Upcoming screens. A seven-day view shows calendar forecasts and the next known after-completion date. All Tasks supports search, pause, resume, and archive. Editing a task includes its recent history. Future repeats are predictions rather than stored task instances.

Rewards has three views: Tray for wins waiting to be enjoyed, Menu for active/paused rewards and the current odds, and Record for actual completion outcomes. A cumulative step chart marks reward events in amber. The personal default menu has 177 active rewards: 73 small, 68 medium, and 36 big. The ideas emphasize everyday upgrades, gardening, climbing, fewer obligations, and reclaimed time. The same menu supplies editable inspiration.

First run asks for something the user wants to do regularly but finds hard to start, followed by the three behavior questions and the resulting draw and hold rules. Examples at every reward tier help them choose the effort for that same habit, with the actual winning mix explained beside the choice. Adding personal rewards is optional and preserves the rest of the menu. A clearly labeled practice pull imagines completing that habit and shows a reward from its main tier; it always wins and never changes history or the tray. The final invitation is to write down as many habits as come to mind, opening habit entry from Plan. Settings covers appearance, motion, sound, day start, reward cap, and file backup/restore. The default cap is one big reward per week.

## Visual system

Warm paper and quiet green structure the workspace. Serif headings soften the application; compact sans-serif controls and monospace labels keep it legible. Desktop uses a fixed navigation rail and a two-column Today workspace. Mobile uses three bottom navigation destinations and task sheets. Native dialogs provide focus containment, Escape handling, and focus return. Controls have keyboard focus states; device reduced-motion preferences apply independently of the app toggle.

## Domain rules

- Calendar schedules use local date arithmetic, with explicit tests across DST and month ends.
- Three behavior questions derive Target, Backlog, Lapse, Practice, Deadline, Start date, Tank, or Upkeep. Reward eligibility follows units or time accrued. Hockey-stick tasks hold tray enjoyment until a completion or declared miss; Target holds use daily pace. Closed, unmet Target windows are recorded as misses. See the README for the complete timing rules.
- The action journal is preserved. Undo adds a reversal event; it does not erase history. A redraw of the same period reuses its original roll and reward.
- Reward selection first draws a hit with probability 0.30, then draws a size from the effective mix, then a uniform reward within that size. No hidden per-item eligibility filter changes the published mix.
- A weekly cap removes big rewards from the eligible mix after the cap is reached. Missing/paused sizes are treated the same way. Menu and engine share the same mix calculation.
- IndexedDB writes are atomic and revision-checked. Backup restore validates the complete notebook before replacing it.

## Verification

Unit tests cover schedules, probability distributions, menu eligibility, caps, undo, and backup validation. Browser tests exercise onboarding, practice, completion, reward reveal, roll reuse, enjoyment and undo, menu editing, task management, backup restoration, scope-safe reload, and offline reload on desktop and mobile. PR CI runs the unit suite in UTC and America/New_York and browser tests under the repository base path.

## Later phases

Reminders require a separate delivery architecture. Optional Firebase Spark sync uses Google identity, one notebook per account, and revision-checked saves. Synced notebooks require internet for editing and retain an account-specific offline viewing copy. Local notebooks keep offline editing. Schedules follow the device timezone, and file backups work in either mode. See the README for setup and verification.
