#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${SVETOPLAVCI_BACKUP_ROOT:-/data/backups/svetoplavci/postgres}"
ARTIFACT_ROOT="${SVETOPLAVCI_ARTIFACT_ROOT:-/data/projects/svetoplavci-app/artifacts/restore-drills}"
TMP_ROOT="${SVETOPLAVCI_TMP_ROOT:-/data/tmp/svetoplavci}"
RESTORE_IMAGE="${SVETOPLAVCI_RESTORE_IMAGE:-postgres:16-alpine}"
RESTORE_DB="${SVETOPLAVCI_RESTORE_DB:-svetoplavci_restore}"

latest_dir="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
if [[ -z "$latest_dir" ]]; then
  echo "[restore-drill] No backup directories found under $BACKUP_ROOT" >&2
  exit 1
fi

dump_file="$(find "$latest_dir" -maxdepth 1 -type f -name '*.dump' | sort | tail -n 1)"
if [[ -z "$dump_file" ]]; then
  echo "[restore-drill] No dump file found in $latest_dir" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
container="svetoplavci-restore-drill-$timestamp"
run_dir="$ARTIFACT_ROOT/$timestamp"
report_file="$run_dir/report.json"

mkdir -p "$run_dir" "$TMP_ROOT"
chmod 0750 "$run_dir" "$TMP_ROOT"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[restore-drill] dump=$dump_file"
echo "[restore-drill] container=$container"

docker run -d \
  --name "$container" \
  -e POSTGRES_PASSWORD=restore-drill \
  -v "$latest_dir:/backup:ro" \
  "$RESTORE_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$container" pg_isready -U postgres >/dev/null
docker exec "$container" createdb -U postgres "$RESTORE_DB"
docker exec "$container" pg_restore -U postgres -d "$RESTORE_DB" --no-owner --no-acl "/backup/$(basename "$dump_file")"

summary="$(docker exec "$container" psql -U postgres -d "$RESTORE_DB" -Atc "
SELECT 'database_size_bytes=' || pg_database_size(current_database())
UNION ALL
SELECT 'public_table_count=' || count(*) FROM information_schema.tables WHERE table_schema = 'public'
UNION ALL
SELECT 'm01_osobni_lodicka_present=' || (to_regclass('public.app_m01_osobni_lodicka') IS NOT NULL)::text
UNION ALL
SELECT 'm01_osobni_lodicka_event_present=' || (to_regclass('public.app_m01_osobni_lodicka_event') IS NOT NULL)::text;
")"

python3 - "$report_file" <<PY
import json
import sys
from datetime import datetime, timezone

summary = {}
for line in """$summary""".splitlines():
    if "=" in line:
        key, value = line.split("=", 1)
        summary[key] = value

report = {
    "schema_version": 1,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "status": "ok",
    "backup_dir": "$latest_dir",
    "dump_file": "$dump_file",
    "restore_image": "$RESTORE_IMAGE",
    "restore_database": "$RESTORE_DB",
    "checks": summary,
}
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=2, ensure_ascii=False)
    fh.write("\\n")
PY
chmod 0640 "$report_file"

echo "[restore-drill] OK report=$report_file"
