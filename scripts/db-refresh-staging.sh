#!/usr/bin/env bash
set -euo pipefail

# Refresh STAGING database from PROD snapshot (no anonymization).
#
# Required env vars:
#   ADMIN_DB_URL         - admin connection (typically .../postgres)
#   PROD_DB_URL          - source production database URL
#   STAGING_DB_URL       - target staging/test database URL
#   STAGING_TMP_DB_URL   - temporary database URL used during refresh
#
# Optional env vars:
#   KEEP_TMP_DB=1        - keep tmp DB after success
#
# Prerequisites: pg_dump, pg_restore, psql available in PATH.

for v in ADMIN_DB_URL PROD_DB_URL STAGING_DB_URL STAGING_TMP_DB_URL; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing required env var: $v" >&2
    exit 1
  fi
done

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required binary: $1" >&2
    exit 1
  }
}

require_bin psql
require_bin pg_dump
require_bin pg_restore

dbname_from_url() {
  local url="$1"
  local tail="${url##*/}"
  echo "${tail%%\?*}"
}

STAGING_DB_NAME="$(dbname_from_url "$STAGING_DB_URL")"
STAGING_TMP_DB_NAME="$(dbname_from_url "$STAGING_TMP_DB_URL")"

if [[ "$STAGING_DB_NAME" == "svetoplavci" || "$STAGING_TMP_DB_NAME" == "svetoplavci" ]]; then
  echo "Safety stop: STAGING/STAGING_TMP points to production DB name 'svetoplavci'." >&2
  exit 1
fi

if [[ "$STAGING_DB_NAME" == "$STAGING_TMP_DB_NAME" ]]; then
  echo "Safety stop: STAGING_DB_URL and STAGING_TMP_DB_URL must be different databases." >&2
  exit 1
fi

PSQL_ADMIN=(psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -X)

echo "[refresh-staging] Drop and recreate tmp DB: $STAGING_TMP_DB_NAME"
"${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$STAGING_TMP_DB_NAME' AND pid <> pg_backend_pid();"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$STAGING_TMP_DB_NAME\";"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$STAGING_TMP_DB_NAME\";"

echo "[refresh-staging] Copy PROD -> STAGING_TMP"
pg_dump --format=custom --no-owner --no-acl "$PROD_DB_URL" \
  | pg_restore --no-owner --no-acl --clean --if-exists --dbname="$STAGING_TMP_DB_URL"

echo "[refresh-staging] Replace STAGING DB: $STAGING_DB_NAME"
"${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$STAGING_DB_NAME' AND pid <> pg_backend_pid();"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$STAGING_DB_NAME\";"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$STAGING_DB_NAME\";"

pg_dump --format=custom --no-owner --no-acl "$STAGING_TMP_DB_URL" \
  | pg_restore --no-owner --no-acl --clean --if-exists --dbname="$STAGING_DB_URL"

if [[ "${KEEP_TMP_DB:-0}" != "1" ]]; then
  echo "[refresh-staging] Drop STAGING_TMP DB"
  "${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$STAGING_TMP_DB_NAME' AND pid <> pg_backend_pid();"
  "${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$STAGING_TMP_DB_NAME\";"
else
  echo "[refresh-staging] KEEP_TMP_DB=1 -> tmp DB left intact: $STAGING_TMP_DB_NAME"
fi

echo "[refresh-staging] DONE"

