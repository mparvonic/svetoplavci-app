#!/usr/bin/env bash
set -euo pipefail

SOURCE_HOST="${SVETOPLAVCI_BACKUP_SOURCE_HOST:-vps}"
SOURCE_CONTAINER="${SVETOPLAVCI_BACKUP_SOURCE_CONTAINER:-svetoplavci-app-postgres}"
SOURCE_DB="${SVETOPLAVCI_BACKUP_SOURCE_DB:-svetoplavci}"
BACKUP_ROOT="${SVETOPLAVCI_BACKUP_ROOT:-/data/backups/svetoplavci/postgres}"
RESTORE_IMAGE="${SVETOPLAVCI_RESTORE_IMAGE:-postgres:16-alpine}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$BACKUP_ROOT/$timestamp"
dump_file="$backup_dir/${SOURCE_DB}_${timestamp}.dump"
list_file="$dump_file.list"
manifest_file="$backup_dir/manifest.json"
tmp_file="$dump_file.tmp"

mkdir -p "$backup_dir"
chmod 0750 "$backup_dir"

echo "[backup] source=${SOURCE_HOST}/${SOURCE_CONTAINER}/${SOURCE_DB}"
echo "[backup] target=$dump_file"

ssh -o BatchMode=yes "$SOURCE_HOST" \
  "docker exec \"$SOURCE_CONTAINER\" sh -lc 'pg_dump -U \"\$POSTGRES_USER\" -d \"$SOURCE_DB\" --format=custom --no-owner --no-acl'" \
  > "$tmp_file"

test -s "$tmp_file"
mv "$tmp_file" "$dump_file"
chmod 0640 "$dump_file"

docker run --rm \
  -v "$backup_dir:/backup:ro" \
  "$RESTORE_IMAGE" \
  pg_restore -l "/backup/$(basename "$dump_file")" \
  > "$list_file"
chmod 0640 "$list_file"

bytes="$(wc -c < "$dump_file" | tr -d ' ')"
sha256="$(sha256sum "$dump_file" | awk '{print $1}')"

python3 - "$manifest_file" <<PY
import json
import sys
from datetime import datetime, timezone

manifest = {
    "schema_version": 1,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "source_host": "$SOURCE_HOST",
    "source_container": "$SOURCE_CONTAINER",
    "source_database": "$SOURCE_DB",
    "backup_dir": "$backup_dir",
    "dump_file": "$dump_file",
    "dump_bytes": int("$bytes"),
    "dump_sha256": "$sha256",
    "pg_restore_list_file": "$list_file",
    "verification": {
        "pg_restore_list": "ok"
    }
}
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2, ensure_ascii=False)
    fh.write("\\n")
PY
chmod 0640 "$manifest_file"

echo "[backup] OK bytes=$bytes sha256=$sha256"
