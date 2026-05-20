#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MAC_MOUNT_PREFIX="/Users/miroslav/Projects/gx10/"
GX10_RELEASE_TMP_ROOT="${GX10_RELEASE_TMP_ROOT:-/data/tmp/svetoplavci/release-checks}"
GX10_REUSE_CHECKOUT_ROOT="${GX10_REUSE_CHECKOUT_ROOT:-/data/tmp/svetoplavci/release-checks-reuse}"
GX10_NPM_CACHE_DIR="${GX10_NPM_CACHE_DIR:-/data/tmp/svetoplavci/npm-cache}"
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

run_clean_worktree_checks() {
  local revision
  revision="$(git rev-parse HEAD)"
  local short_revision
  short_revision="$(git rev-parse --short HEAD)"
  local tmp_dir="$GX10_RELEASE_TMP_ROOT/$short_revision-$(date +%Y%m%d%H%M%S)"
  CHECK_TMP_DIR="$tmp_dir"

  if [[ "${GX10_REUSE_CHECKOUT:-0}" == "1" ]]; then
    tmp_dir="$GX10_REUSE_CHECKOUT_ROOT"
    CHECK_TMP_DIR=""
    log "Running checks in reusable clean checkout: $tmp_dir"
    if [ ! -d "$tmp_dir/.git" ]; then
      rm -rf "$tmp_dir"
      mkdir -p "$tmp_dir"
      rmdir "$tmp_dir"
      git -C "$GX10_REPO_PATH" worktree add --detach "$tmp_dir" "$revision"
    else
      git -C "$tmp_dir" reset --hard "$revision"
      git -C "$tmp_dir" clean -fd -e node_modules
    fi
    cd "$tmp_dir"
    if [ -f "$GX10_ENV_FILE" ]; then
      cp "$GX10_ENV_FILE" .env.local
    fi
    npm ci --prefer-offline --cache "$GX10_NPM_CACHE_DIR"
    npm run lint
    npm run build
    return
  fi

  log "Running checks in clean temp checkout: $tmp_dir"
  cleanup() {
    git -C "$GX10_REPO_PATH" worktree remove --force "$CHECK_TMP_DIR" >/dev/null 2>&1 || rm -rf "$CHECK_TMP_DIR"
  }
  trap cleanup EXIT

  rm -rf "$tmp_dir"
  mkdir -p "$tmp_dir"
  rmdir "$tmp_dir"
  git -C "$GX10_REPO_PATH" worktree add --detach "$tmp_dir" "$revision"
  cd "$tmp_dir"
  if [ -f "$GX10_ENV_FILE" ]; then
    cp "$GX10_ENV_FILE" .env.local
  fi
  npm ci --prefer-offline --cache "$GX10_NPM_CACHE_DIR"
  npm run lint
  npm run build
}

run_gx10_checks() {
  ssh gx10 "cd '$GX10_REPO_PATH' && GX10_CLEAN_CHECKS=1 ./scripts/release-checks.sh"
}

if [[ "${GX10_CLEAN_CHECKS:-0}" == "1" || "$ROOT_DIR" == "$GX10_REPO_PATH" ]]; then
  run_clean_worktree_checks
elif [[ "$ROOT_DIR" == "$MAC_MOUNT_PREFIX"* ]] && ssh -o BatchMode=yes -o ConnectTimeout=4 gx10 "printf ok" >/dev/null 2>&1; then
  run_gx10_checks
else
  log "Running checks locally."
  run_local_checks
fi
