# Fidelity harness

Renders the Expo web build in design-review mode next to `docs/redesign/screens/*.html` and measures the difference.

```
cd tools/fidelity && npm install && npx playwright install chromium   # once
node tools/fidelity/run.mjs Kitchen Login            # named screens
node tools/fidelity/run.mjs --all [--theme dark]     # everything with a route in screens.json
node tools/fidelity/run.mjs Pantry --rebuild         # re-export the web bundle first (needed after app code changes)
node tools/fidelity/summary.mjs                      # systematic deltas across all reports
```

Needs `.redesign-assets/` at the repo root (design photos, not in git). Output goes to `tools/fidelity/out/`:
`<Name>.design.png`, `.rn.png`, `.diff.png`, `.side.jpg` (design | app | diff, small enough for image readers),
`.report.json` (pixel mismatch %, per-element boxes/deltas sorted by severity, missing elements).

How it works
- `serve.mjs` exports the app with `EXPO_PUBLIC_DESIGN_REVIEW=1` into `dist-web/` and serves it with SPA fallback.
  `public/index.html` (Firebase landing page) is moved aside only during the export and restored in `finally`.
- Review mode (`lib/designReview.ts`): guest everywhere, no route guards, RevenueCat off, `?theme=`,
  safe-area insets forced to 44/34 (react-native-web reports 0), stores on `window.__SC__`.
- `fixtures/*.json` patch store state (`$daysFromNow` becomes a real Timestamp; `calls` invokes store actions;
  `reload` re-navigates so persisted stores are seen by route guards). Regenerate with `gen-fixtures.mjs`.
- `screens.json` maps design name to route/theme/fixture (`gen-screens.mjs`); `route: null` = no RN route.
- Element matching is by identical text (n-th occurrence), images by index, text-less boxes by nearest centre.
