#!/usr/bin/env bash
# Puts a new version live on the server and checks it came up. Run from /opt/souschef:
#
#   ./deploy.sh <image tag>        e.g. ./deploy.sh 2026-11-15-a1b2c3d
#
# Order: pull the images, apply database migrations, start the API, wait until it reports ready. If it does not become
# ready in time, the previous version is put back. Database migrations are written to be compatible with the version
# before (add, don't remove), so putting the old API back is safe.
set -euo pipefail
cd "$(dirname "$0")"

tag="${1:?usage: ./deploy.sh <image tag>}"
compose=(docker compose -f docker-compose.prod.yml --env-file .env)
previous="$(cat .current-tag 2>/dev/null || true)"

[ -f .env ] || { echo "missing .env (see .env.example)"; exit 1; }
[ -f .env.production ] || { echo "missing .env.production (see .env.production.example)"; exit 1; }
[ -f certs/origin.pem ] && [ -f certs/origin.key ] || { echo "missing certs/origin.pem or certs/origin.key (Cloudflare Origin certificate)"; exit 1; }

echo "== deploying $tag (was: ${previous:-nothing})"
export TAG="$tag"
"${compose[@]}" pull api migrate

# A backup right before changing the database is cheap insurance.
if [ -x ./backup.sh ] && "${compose[@]}" ps --status running db 2>/dev/null | grep -q db; then
  ./backup.sh || echo "warning: pre-deploy backup failed, continuing"
fi

"${compose[@]}" up -d db
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d api caddy

echo "== waiting for the API to report ready"
for _ in $(seq 1 30); do
  state="$("${compose[@]}" ps --format '{{.Service}} {{.Health}}' api 2>/dev/null | awk '{print $2}')"
  if [ "$state" = "healthy" ]; then
    echo "$tag" > .current-tag
    [ -n "$previous" ] && echo "$previous" > .previous-tag
    echo "== live: $tag"
    exit 0
  fi
  sleep 3
done

echo "== $tag did not become healthy; last logs:"
"${compose[@]}" logs --tail 60 api || true
if [ -n "$previous" ]; then
  echo "== putting $previous back"
  export TAG="$previous"
  "${compose[@]}" up -d api caddy
fi
exit 1
