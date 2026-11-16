#!/usr/bin/env bash
# Moves the Expo app into mobile/ so the repository reads: mobile/ server/ admin/ shared/ docs/ deploy/.
#
#   bash scripts/restructure-to-mobile.sh            # do it (run from the repository root, on a clean branch)
#   bash scripts/restructure-to-mobile.sh --check    # only say what it would move
#
# It uses `git mv`, so history follows the files and other branches merge with renames detected. Run it after the open
# PRs have landed (see docs/restructure.md). It never deletes anything.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
CHECK=false
[ "${1:-}" = "--check" ] && CHECK=true

if [ -e mobile ]; then echo "mobile/ already exists: nothing to do." >&2; exit 1; fi
if [ ! -f app.json ] || [ ! -d app ]; then echo "Run this from the repository root (app.json and app/ must be there)." >&2; exit 1; fi
if ! $CHECK && [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo "Commit or stash your changes first (tracked files have changes)." >&2; exit 1; fi

# Everything that belongs to the phone app.
DIRS=(app assets components constants data hooks lib locales services stores types __tests__ patches plugins tools)
FILES=(app.json eas.json babel.config.js metro.config.js tailwind.config.js global.css jest.config.js eslint.config.js tsconfig.json
       package.json package-lock.json expo-env.d.ts nativewind-env.d.ts GoogleService-info.plist google-services.json .env.example)
# Not tracked by git, but part of the app's working folder: moved with plain mv so nothing has to be rebuilt.
LOCAL=(.expo dist dist-web credentials .redesign-assets)

echo "Will move into mobile/:"
printf '  %s\n' "${DIRS[@]}" "${FILES[@]}"
echo "and, if present and untracked: ${LOCAL[*]}"
$CHECK && exit 0

mkdir mobile
for p in "${DIRS[@]}" "${FILES[@]}"; do
  if [ -e "$p" ]; then git mv "$p" "mobile/$p"; fi
done
for p in "${LOCAL[@]}"; do
  if [ -e "$p" ] && [ -z "$(git ls-files "$p" | head -1)" ]; then mv "$p" "mobile/$p"; fi
done

# node_modules is rebuilt (or moved by hand): its install belongs next to package.json now.
echo "Note: delete the old root node_modules and run 'npm ci' inside mobile/."

# --- Imports of the shared folder, and the config files (tsconfig, jest, metro, eslint): see restructure-edits.cjs ---
node scripts/restructure-edits.cjs

echo
echo "Done. Next, inside mobile/:  npm ci && npm run typecheck && npm test"
echo "Then commit. EAS builds and 'expo start' now run from mobile/."
