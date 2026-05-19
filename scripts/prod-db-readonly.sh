#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAC_MOUNT_PREFIX="/Users/miroslav/Projects/gx10/"
GX10_REPO_PATH="${GX10_REPO_PATH:-/srv/projects/svetoplavci-app}"

quote_args() {
  local quoted=""
  for arg in "$@"; do
    printf -v q "%q" "$arg"
    quoted+=" $q"
  done
  printf "%s" "$quoted"
}

if [[ "${PROD_DB_ON_GX10:-0}" != "1" && "$ROOT_DIR" == "$MAC_MOUNT_PREFIX"* ]]; then
  args="$(quote_args "$@")"
  exec ssh -o BatchMode=yes gx10 "cd '$GX10_REPO_PATH' && PROD_DB_ON_GX10=1 ./scripts/prod-db-readonly.sh$args"
fi

cd "$ROOT_DIR"
exec node scripts/prod-db-readonly.mjs "$@"
