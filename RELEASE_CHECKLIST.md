# Skibo release checks

Run these against the final commit:

- `TZ=America/New_York npm test`
- `TZ=UTC npm test`
- `VITE_BASE_PATH=/skibo/ npm run test:e2e`
- Inspect the mobile and desktop screenshots in `test-results/` for layout, sheets, and dark mode.
- Verify the generated manifest has 192px and 512px PNG icons, the correct start URL, and the repository scope.
- Confirm notebook backup/restore tests pass.
- Confirm the PR checks and review cover the final head.

For Firebase-enabled deployments, run `npm run test:sync`, publish the owner-only database rules, and verify Google sign-in on desktop, iPhone Safari, and the installed iPhone PWA. Confirm the Firebase project stays on Spark with no linked billing account. Without `VITE_FIREBASE_CONFIG`, the app remains local-only.

Deploy only through the existing GitHub Pages workflow after merging to `main`. Reminders remain outside this release.
