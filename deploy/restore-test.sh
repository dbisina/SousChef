#!/usr/bin/env bash
# Proves the backups work: downloads the newest one, decrypts it, restores it into a throwaway PostgreSQL, and checks the
# data is really there. A backup nobody has restored is only a hope. Run it monthly, and after changing the backup setup:
#
#   AGE_IDENTITY=/path/to/private-age-key.txt ./restore-test.sh
#
# The private age key lives offline; fetch it only for this test and remove it afterwards. Nothing here touches the live
# database: the restore goes into a temporary container that is deleted at the end.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck disable=SC1091
set -a; . ./.env.backup; set +a
: "${BACKUP_BUCKET:?}" "${BACKUP_ENDPOINT:?}" "${AGE_IDENTITY:?path to the private age key}"
[ -f "$AGE_IDENTITY" ] || { echo "no such file: $AGE_IDENTITY"; exit 1; }

work="$(mktemp -d)"
name="souschef-restore-test-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

latest="$(aws s3 ls "s3://$BACKUP_BUCKET/daily/" --endpoint-url "$BACKUP_ENDPOINT" | sort | tail -n 1 | awk '{print $4}')"
[ -n "$latest" ] || { echo "no backups found in s3://$BACKUP_BUCKET/daily/"; exit 1; }
echo "== newest backup: $latest"
aws s3 cp "s3://$BACKUP_BUCKET/daily/$latest" "$work/backup.age" --endpoint-url "$BACKUP_ENDPOINT" --only-show-errors
age -d -i "$AGE_IDENTITY" -o "$work/backup.dump" "$work/backup.age"

docker run -d --name "$name" -e POSTGRES_PASSWORD=restoretest -e POSTGRES_USER=souschef -e POSTGRES_DB=souschef postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$name" pg_isready -U souschef -d souschef >/dev/null 2>&1 && break; sleep 1; done
docker exec -i "$name" pg_restore -U souschef -d souschef --no-owner --exit-on-error < "$work/backup.dump"

q() { docker exec "$name" psql -U souschef -d souschef -tA -c "$1"; }
tables="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
users="$(q 'SELECT count(*) FROM "User"')"
migrations="$(q 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')"
newest="$(q 'SELECT max(finished_at) FROM _prisma_migrations')"
echo "== restored: $tables tables, $users users, $migrations migrations (latest applied: $newest)"

[ "$tables" -ge 20 ] || { echo "FAILED: too few tables"; exit 1; }
[ "$migrations" -ge 1 ] || { echo "FAILED: no migrations recorded"; exit 1; }
echo "== restore test passed"
