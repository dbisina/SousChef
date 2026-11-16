# Moving the app into mobile/

Target layout:

```
mobile/   the Expo app (app/, components/, services/, stores/, assets/, locales/, __tests__/, app.json, eas.json, package.json, ...)
server/   the API (unchanged)
admin/    the staff dashboard (unchanged)
shared/   types and pure helpers used by all three (stays at the root)
docs/ deploy/ docker-compose.yml .github/ README.md ...   stay at the root
functions/ firebase.json .firebaserc public/               stay at the root (the old Firebase backend and its hosting)
```

## Why it waits

The repository has a long chain of open pull requests. A move underneath them would conflict with every one. Land the open PRs first, then run the script once on the up-to-date main branch.

## How

```bash
git checkout master && git pull
git checkout -b chore/mobile-folder
bash scripts/restructure-to-mobile.sh --check    # lists what will move
bash scripts/restructure-to-mobile.sh            # moves it (git mv, so history follows) and edits the config
rm -rf node_modules                              # the old install at the root
cd mobile && npm ci
npm run typecheck && npm test
npx expo export --platform android --output-dir /tmp/check   # proves Metro finds ../shared
```

Then commit and open the PR. Do not use `rm -rf` through a link or junction into another folder's `node_modules`; delete real folders only.

## What the script changes

- `git mv` of the app folders and config files into `mobile/`; untracked working folders (`.expo`, `dist`, `credentials`, `.redesign-assets`) are moved with them.
- Imports of the shared folder (`'../shared/x'`, `'../../shared/x'`) become `'@shared/x'`.
- `mobile/tsconfig.json`: path alias `@shared/*` -> `../shared/*`; the `server`/`admin` excludes go.
- `mobile/jest.config.js`: the same alias, plus `modulePaths` so code compiled from `../shared` finds this project's packages.
- `mobile/metro.config.js`: `watchFolders` includes `../shared`, `resolver.nodeModulesPaths` points at `mobile/node_modules`.
- `mobile/eslint.config.js`: the `server`/`admin` ignores go.
- The edits live in `scripts/restructure-edits.cjs` so they can be read or re-run by hand.

## After the move (by hand)

- Run `expo start`, `eas build` and `eas update` from `mobile/`. In the EAS dashboard nothing changes for the project id; if a build ever complains about the project root, set it to `mobile`.
- Add a `mobile.yml` GitHub workflow (typecheck, lint, tests, working directory `mobile`) next to `server.yml` and `admin.yml`, with paths `mobile/**` and `shared/**`.
- Update the README's "Project structure" section and any docs that name `app/`, `services/` and so on at the root.
- Root `.gitignore` entries such as `.expo/`, `dist/` and `.env` have no leading slash, so they cover `mobile/` too; check `git status` for strays.
- `.dockerignore`, `docker-compose.yml` and `.github/workflows/server.yml` already name only `server/` and `shared/`; they need no change.

## What was checked

The script was run on a throwaway copy of the app branch (not committed anywhere): after the move, `npm ci` in `mobile/`, `tsc --noEmit` clean, all 226 app tests passing, eslint clean on the new AI files, and `expo export --platform android` produced a bundle (so Metro resolves `../shared`). Not checked: an iOS bundle, a real EAS build, or a device run.
