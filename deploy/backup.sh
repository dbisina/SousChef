#!/usr/bin/env bash
# Backs up the database: dump, encrypt with age, upload to a Cloudflare R2 bucket. Run nightly from cron:
#
#   17 3 * * *  cd /opt/souschef && ./backup.sh >> /var/log/souschef-backup.log 2>&1
#
# Needs on the server: docker, the aws CLI, age. Settings come from /opt/souschef/.env.backup:
#   BACKUP_BUCKET        a private R2 bucket used only for backups (not the media bucket)
#   BACKUP_ENDPOINT      https://<account id>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   a token limited to that bucket
#   AGE_RECIPIENT        the PUBLIC age key (age1...). The private key is kept offline, never on this server.
#   HEALTHCHECK_URL      optional: pinged on success (or /fail), e.g. a healthchecks.io link, so a missed backup alerts you
#
# Keep 30 days with an R2 lifecycle rule on the "daily/" prefix, and keep the first backup of each month under "monthly/".
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
set -a; . ./.env.backup; set +a
: "${BACKUP_BUCKET:?}" "${BACKUP_ENDPOINT:?}" "${AGE_RECIPIENT:?}"

compose=(docker compose -f docker-compose.prod.yml --env-file .env)
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail() { echo "backup FAILED: $1" >&2; [ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 "$HEALTHCHECK_URL/fail" >/dev/null || true; exit 1; }

file="$work/souschef-$stamp.dump.age"
# Custom format is compressed and lets a restore pick parts. Encrypted on the way out, so no plain copy touches the disk.
"${compose[@]}" exec -T db pg_dump -U souschef -d souschef -Fc --no-owner | age -r "$AGE_RECIPIENT" > "$file" || fail "dump or encryption"
size="$(stat -c %s "$file")"
[ "$size" -gt 1024 ] || fail "backup is suspiciously small ($size bytes)"

aws s3 cp "$file" "s3://$BACKUP_BUCKET/daily/$(basename "$file")" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors || fail "upload"
if [ "$(date -u +%d)" = "01" ]; then
  aws s3 cp "$file" "s3://$BACKUP_BUCKET/monthly/$(basename "$file")" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors || fail "monthly upload"
fi

echo "backup ok: souschef-$stamp.dump.age ($size bytes)"
[ -n "${HEALTHCHECK_URL:-}" ] && curl -fsS -m 10 "$HEALTHCHECK_URL" >/dev/null || true
