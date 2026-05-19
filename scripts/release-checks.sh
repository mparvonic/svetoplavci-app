#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MAC_MOUNT_PREFIX="/Users/miroslav/Projects/gx10/"
GX10_RELEASE_TMP_ROOT="${GX10_RELEASE_TMP_ROOT:-/data/tmp/svetoplavci/release-checks}"
GX10_ENV_FILE="/data/projects/svetoplavci-app/secrets/env.local"
GX10_REPO_PATH="${GX10_REPO_PATH:-/srv/projects/svetoplavci-app}"

log() {
  echo "[release:checks] $*"
}

run_local_checks() {
  ./scripts/dev-down.sh
  npm run lint
  npm run build
}

run_gx10_checks() {
  local revision
  revision="$(git rev-parse HEAD)"
  local short_revision
  short_revision="$(git rev-parse --short HEAD)"
  local tmp_dir="$GX10_RELEASE_TMP_ROOT/$short_revision-$(date +%Y%m%d%H%M%S)"

  log "Running checks on GX10 in clean temp checkout: $tmp_dir"
  ssh gx10 "bash -lc 'set -euo pipefail
    tmp_dir=\"$tmp_dir\"
    repo_path=\"$GX10_REPO_PATH\"
    revision=\"$revision\"
    cleanup() {
      git -C \"\$repo_path\" worktree remove --force \"\$tmp_dir\" >/dev/null 2>&1 || rm -rf \"\$tmp_dir\"
    }
    rm -rf \"\$tmp_dir\"
    mkdir -p \"\$tmp_dir\"
    rmdir \"\$tmp_dir\"
    git -C \"\$repo_path\" worktree add --detach \"\$tmp_dir\" \"\$revision\"
    cd \"\$tmp_dir\"
    if [ -f \"$GX10_ENV_FILE\" ]; then
      cp \"$GX10_ENV_FILE\" .env.local
    fi
    npm ci
    npm run lint
    npm run build
    cleanup
  '"
}

if [[ "$ROOT_DIR" == "$MAC_MOUNT_PREFIX"* ]] && ssh -o BatchMode=yes -o ConnectTimeout=4 gx10 "printf ok" >/dev/null 2>&1; then
  run_gx10_checks
else
  log "Running checks locally."
  run_local_checks
fi
