# Skibo release checks

Run these against the final commit:

- `TZ=America/New_York npm test`
- `TZ=UTC npm test`
- `VITE_BASE_PATH=/skinner/ npm run test:e2e`
- Inspect the mobile and desktop screenshots in `test-results/` for layout, sheets, and dark mode.
- Verify the generated manifest has 192px and 512px PNG icons, the correct start URL, and the repository scope.
- Confirm notebook backup/restore tests pass.
- Confirm the PR checks and review cover the final head.

Deploy only through the existing GitHub Pages workflow after merging to `main`. Reminders and automatic sync are not part of this release.
