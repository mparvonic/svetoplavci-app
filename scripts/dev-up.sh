#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${DEV_HOST:-127.0.0.1}"
PORT="${PORT:-3000}"
TMP_DIR="$ROOT_DIR/.tmp"
LOG_FILE="$TMP_DIR/next-dev.log"
PID_FILE="$TMP_DIR/next-dev.pid"
MAC_ENV_FILE="/Users/miroslav/Projects/gx10/data/projects/svetoplavci-app/secrets/env.local"
GX10_ENV_FILE="/data/projects/svetoplavci-app/secrets/env.local"

mkdir -p "$TMP_DIR"

log() {
  echo "[dev:up] $*"
}

fail() {
  echo "[dev:up] $*" >&2
  exit 1
}

is_port_open() {
  local port="$1"
  nc -z "$HOST" "$port" >/dev/null 2>&1
}

is_dev_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

running_next_command() {
  ps -axo command= | grep "next dev" | grep "$ROOT_DIR" | grep -v grep | head -n 1 || true
}

port_from_next_command() {
  local command="$1"
  local parsed
  parsed="$(printf '%s\n' "$command" | sed -nE 's/.*(--port|-p)[ =]([0-9]+).*/\2/p' | head -n 1)"
  if [[ -n "$parsed" ]]; then
    printf '%s\n' "$parsed"
  else
    printf '%s\n' "$PORT"
  fi
}

choose_port() {
  local candidate="$PORT"
  for _ in {1..40}; do
    if ! is_port_open "$candidate"; then
      printf '%s\n' "$candidate"
      return
    fi
    candidate=$((candidate + 1))
  done
  fail "No free local port found starting at $PORT."
}

load_runtime_env() {
  local env_file=""
  if [[ -f "$ROOT_DIR/.env.local" ]]; then
    env_file="$ROOT_DIR/.env.local"
  elif [[ -f "$GX10_ENV_FILE" ]]; then
    env_file="$GX10_ENV_FILE"
  elif [[ -f "$MAC_ENV_FILE" ]]; then
    env_file="$MAC_ENV_FILE"
  fi

  if [[ -n "$env_file" ]]; then
    local display_env_file="${env_file/#$HOME/~}"
    log "Loading runtime env from $display_env_file"
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  else
    log "Runtime env not found; continuing, but DB-backed pages may fail."
  fi
}

check_mount_context() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return
  fi

  if [[ "$ROOT_DIR" == /Users/miroslav/Projects/gx10/* ]]; then
    if mount | grep -q "/Users/miroslav/Projects/gx10"; then
      log "GX10 mount is available."
    else
      fail "GX10 mount is not available at /Users/miroslav/Projects/gx10."
    fi
  fi
}

ensure_dependencies() {
  if [[ ! -d node_modules ]]; then
    log "node_modules missing; running npm ci."
    npm ci
  elif [[ package-lock.json -nt node_modules/.package-lock.json ]]; then
    log "package-lock.json is newer than installed dependencies; running npm ci."
    npm ci
  else
    log "Dependencies are present."
  fi
}

start_next() {
  local existing_next
  existing_next="$(running_next_command)"
  if [[ -n "$existing_next" ]]; then
    local existing_port
    existing_port="$(port_from_next_command "$existing_next")"
    log "Next dev for this checkout is already available at http://${HOST}:${existing_port}"
    return
  fi

  local selected_port
  selected_port="$(choose_port)"
  if [[ "$selected_port" != "$PORT" ]]; then
    log "Port $PORT is busy; using http://${HOST}:${selected_port}"
  fi

  if is_dev_running; then
    log "Next dev PID exists but port is not ready yet; see $LOG_FILE"
  else
    log "Starting Next dev at http://${HOST}:${selected_port}"
    log "Keep this process running while using the browser; stop it with Ctrl-C."
    exec ./node_modules/.bin/next dev --hostname "$HOST" --port "$selected_port"
  fi
}

if ! command -v nc >/dev/null 2>&1; then
  fail "Missing dependency: nc (netcat)."
fi

check_mount_context
load_runtime_env
ensure_dependencies
./scripts/dev-db-tunnel-up.sh
start_next
