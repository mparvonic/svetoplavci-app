#!/usr/bin/env bash
set -euo pipefail

# Refresh DEV database from PROD snapshot + anonymization.
#
# Required env vars:
#   ADMIN_DB_URL      - admin connection (typically .../postgres) with CREATE/DROP DB permissions
#   PROD_DB_URL       - source production database URL
#   DEV_DB_URL        - target dev database URL
#   DEV_TMP_DB_URL    - temporary database URL used during refresh
#
# Optional env vars:
#   ANONYMIZE_SALT    - deterministic salt for pseudonymization (recommended)
#   KEEP_TMP_DB       - if "1", keep temp DB after success
#
# Prerequisites: pg_dump, pg_restore, psql available in PATH.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANON_SQL="$ROOT_DIR/sql/anonymize_dev.sql"
VALIDATE_SQL="$ROOT_DIR/sql/validate_dev_refresh.sql"

for v in ADMIN_DB_URL PROD_DB_URL DEV_DB_URL DEV_TMP_DB_URL; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing required env var: $v" >&2
    exit 1
  fi
done

if [[ ! -f "$ANON_SQL" ]]; then
  echo "Missing anonymization SQL: $ANON_SQL" >&2
  exit 1
fi

if [[ ! -f "$VALIDATE_SQL" ]]; then
  echo "Missing validation SQL: $VALIDATE_SQL" >&2
  exit 1
fi

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

DEV_DB_NAME="$(dbname_from_url "$DEV_DB_URL")"
DEV_TMP_DB_NAME="$(dbname_from_url "$DEV_TMP_DB_URL")"

if [[ "$DEV_DB_NAME" == "svetoplavci" || "$DEV_TMP_DB_NAME" == "svetoplavci" ]]; then
  echo "Safety stop: DEV/DEV_TMP DB points to production DB name 'svetoplavci'." >&2
  exit 1
fi

if [[ "$DEV_DB_NAME" == "$DEV_TMP_DB_NAME" ]]; then
  echo "Safety stop: DEV_DB_URL and DEV_TMP_DB_URL must be different databases." >&2
  exit 1
fi

PSQL_ADMIN=(psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -X)

echo "[refresh-dev] Drop and recreate tmp DB: $DEV_TMP_DB_NAME"
"${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DEV_TMP_DB_NAME' AND pid <> pg_backend_pid();"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$DEV_TMP_DB_NAME\";"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$DEV_TMP_DB_NAME\";"

echo "[refresh-dev] Copy PROD -> TMP"
pg_dump --format=custom --no-owner --no-acl "$PROD_DB_URL" \
  | pg_restore --no-owner --no-acl --clean --if-exists --dbname="$DEV_TMP_DB_URL"

echo "[refresh-dev] Run anonymization"
if [[ -n "${ANONYMIZE_SALT:-}" ]]; then
  psql "$DEV_TMP_DB_URL" -v ON_ERROR_STOP=1 -X -c "SET app.anonymize_salt = '$ANONYMIZE_SALT';" -f "$ANON_SQL"
else
  psql "$DEV_TMP_DB_URL" -v ON_ERROR_STOP=1 -X -f "$ANON_SQL"
fi

echo "[refresh-dev] Validate anonymized TMP"
psql "$DEV_TMP_DB_URL" -v ON_ERROR_STOP=1 -X -f "$VALIDATE_SQL"

echo "[refresh-dev] Replace DEV DB: $DEV_DB_NAME"
"${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DEV_DB_NAME' AND pid <> pg_backend_pid();"
"${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$DEV_DB_NAME\";"
"${PSQL_ADMIN[@]}" -c "CREATE DATABASE \"$DEV_DB_NAME\";"

pg_dump --format=custom --no-owner --no-acl "$DEV_TMP_DB_URL" \
  | pg_restore --no-owner --no-acl --clean --if-exists --dbname="$DEV_DB_URL"

echo "[refresh-dev] Validate final DEV"
psql "$DEV_DB_URL" -v ON_ERROR_STOP=1 -X -f "$VALIDATE_SQL"

if [[ "${KEEP_TMP_DB:-0}" != "1" ]]; then
  echo "[refresh-dev] Drop TMP DB"
  "${PSQL_ADMIN[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DEV_TMP_DB_NAME' AND pid <> pg_backend_pid();"
  "${PSQL_ADMIN[@]}" -c "DROP DATABASE IF EXISTS \"$DEV_TMP_DB_NAME\";"
else
  echo "[refresh-dev] KEEP_TMP_DB=1 -> tmp DB left intact: $DEV_TMP_DB_NAME"
fi

echo "[refresh-dev] DONE"
