# Screen polish brief (SousChef 2.0)

Goal: make each assigned screen match its design file in sizing, spacing, alignment, type and colour. The user's complaint: "you didn't match the sizing, spacing and neatness of the design".

## Setup (fresh clone per agent, never touch X:\GitHub\SousChef)
```
git clone --branch redesign/v2 --single-branch X:/GitHub/SousChef  <scratchpad>\<yourname>
cd <yourname>; git remote set-url origin https://github.com/dbisina/SousChef.git; git pull origin redesign/v2
NPM_CONFIG_LEGACY_PEER_DEPS=true npm ci --ignore-scripts
(cd tools/fidelity && npm install && npx playwright install chromium)
copy X:\GitHub\SousChef\.redesign-assets to .\.redesign-assets
```
Read tools/fidelity/README.md. Run only YOUR screens: `node tools/fidelity/run.mjs <Names> --rebuild` (never `--all`; other agents are using the machine). Outputs in tools/fidelity/out/: `<Name>.side.jpg` (design | app | diff; READ it with the Read tool), `<Name>.report.json` (per-element deltas sorted by severity).

## Method per screen
1. Run, read the side image, read the top deltas.
2. Classify each delta: (a) real app layout bug -> fix the screen; (b) fixture/data difference (the harness fixture lacks content or has different text) -> fix the fixture in tools/fidelity/fixtures/ and screens.json, not the app; (c) harness artefact (e.g. the 58px button vs the 126px gradient CTA bar, 3300px Home frame, safe-area) -> note it, ignore; (d) genuine primitive bug in components/ui -> make the smallest fix, keep prop names stable, mention it in the report.
3. Fix, re-run, repeat until every element is within 2px of the design in x/y/w/h and font-size/weight/colour/radius match, and the side image looks identical to the eye. Also check the dark theme where the design is dark (`--theme dark` or the screen's own theme in screens.json).
4. Neatness: consistent left edge (20px page padding), 12/18px gaps per tokens.css, no clipped or wrapped text that wraps in the design, tap targets >= 44px, images with the same object-fit/crop and radius as the design, icons the same size and stroke.
5. Screens the harness cannot render (sheets/overlays with no route): compare by reading the design HTML and the code and match the numbers; say "not measured".

## Rules
- Edit only the files of your area (listed in your task), plus fixtures/screens.json entries for your screens. Another 5 agents work in parallel on other areas. Do not edit components/ui/* except a clear primitive bug (smallest fix; report it). Do not edit app/_layout.tsx, package.json, tailwind.config.js.
- Keep ALL existing logic: store/service calls, navigation targets, gating, i18n keys (use t('key','Default') with defaults; do not edit locales/en.json: write new keys to locales/parts/<area>.json). No hex literals, no `dark:` class pairs, no emoji, NO EM DASHES in user-facing text, tokens only.
- Do not invent content the design does not show; do not remove features the design omits without keeping them reachable.

## Verify and ship
`node node_modules\typescript\bin\tsc --noEmit` = 0 errors; `rtk npm test` passes; `npx eslint <changed files> --quiet` clean; `npx expo export --platform android` bundles. Commit in logical commits (plain messages, no attribution lines), `git pull --rebase origin redesign/v2`, `git push origin HEAD:redesign/v2` (never force; resolve conflicts carefully, they are expected in shared files).

## Report (<= 250 words)
Per screen: mismatch % before -> after and remaining deltas > 2px with cause; fixtures changed; primitive fixes made; screens not measurable; commit shas.
