# Shared brief for screen agents (SousChef 2.0)

Repo: Expo 54, expo-router 6, NativeWind 4, zustand, TS strict. Branch `redesign/v2`. Plan: `C:\Users\USER\.claude\plans\validated-toasting-castle.md`.
Several agents run in parallel on disjoint files. **Edit only the files your brief lists.** Never commit, never switch branches, never run `git stash/reset/checkout`.

## Source of truth
- `docs/redesign/tokens.css` for every size, radius, gap, color, type.
- The screen's HTML in `docs/redesign/screens/<Name>.html`. Match layout, copy, spacing, sizes exactly. Spec text: the Screen Spec doc was summarised in the plan; HTML wins.
- Photos: `assets/sample/` (index `SAMPLE` in `assets/sample/index.ts`). Same names as `.redesign-assets/`.
- Icons: `Icon` + `components/ui/icons.ts` (add missing icons there only if needed, append-only).

## Build rules
- Compose from the Phase 1 primitives in `components/ui` (see `components/ui/README.md`; `Screen`, `TopBar`, `PhotoCard`, `UButton`, `Tag`, `Chip`, `ListRow`, `Sheet`, etc). `tone="dark"` on `Screen` where the design is dark.
- No hex literals, no `dark:` class pairs, no Ionicons in screens you rewrite. No emoji, sparkle icons, pastel washes, fake status bars. Touch targets >= 44.
- **Existing screens: presentation only.** Keep every store call, service call, navigation target, paywall/limit gate, permission flow and i18n key. If the design drops a control that carries logic, keep the logic reachable and say so in the report.
- **New copy**: use `t('area.key', 'Default English text')` with the default string always supplied. Do NOT edit `locales/en.json` (parallel agents would clobber it). Write your new keys as a nested object to `locales/parts/<your-area>.json`; a merge step runs later.
- Do NOT install dependencies or edit `package.json`, `tailwind.config.js`, `global.css`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `components/ui/*` (except append-only icons). If you need a change there, list it in your report under "Needs from shared files".
- Dev data: where a screen needs content the stores lack, read real store data first; fall back to the design's sample content only for clearly-new features.

## Verify (before reporting)
1. `node node_modules\typescript\bin\tsc --noEmit` — no errors beyond `docs/redesign/baseline-typecheck.txt` (11 errors).
2. `npx eslint <each file you changed>` — 0 errors.
3. `npx expo export --platform web` bundles (skip if another agent's in-progress files break it, and say so).
4. If you can run the web dev server and the browser tools are available, compare each screen at 390x844 with its HTML; otherwise state "not visually checked".

## Report (<= 250 words)
Files changed/created, screens done vs skipped (with reason), logic you preserved/relocated, "Needs from shared files", deviations from the design, verification results.
