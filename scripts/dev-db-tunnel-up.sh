#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_PORT="${DB_TUNNEL_LOCAL_PORT:-5433}"
TMP_DIR="$ROOT_DIR/.tmp"
LOG_FILE="$TMP_DIR/db-tunnel-watch.log"
PID_FILE="$TMP_DIR/db-tunnel-watch.pid"

mkdir -p "$TMP_DIR"

if ! command -v nc >/dev/null 2>&1; then
  echo "[dev:db:tunnel:up] Missing dependency: nc (netcat)." >&2
  exit 1
fi

is_port_open() {
  nc -z 127.0.0.1 "$LOCAL_PORT" >/dev/null 2>&1
}

is_watchdog_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      local command
      command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$command" == *"scripts/db-tunnel-watch.mjs"* ]]; then
        return 0
      fi
    fi
  fi

  local existing_pid
  existing_pid="$(pgrep -f "node scripts/db-tunnel-watch.mjs" | head -n 1 || true)"
  if [[ -n "$existing_pid" ]]; then
    echo "$existing_pid" > "$PID_FILE"
    return 0
  fi

  return 1
}

start_watchdog() {
  echo "[dev:db:tunnel:up] Starting DB tunnel watchdog on localhost:$LOCAL_PORT ..."
  nohup npm run -s db:tunnel:watch >"$LOG_FILE" 2>&1 < /dev/null &
  local watchdog_pid=$!
  disown "$watchdog_pid" 2>/dev/null || true
  echo "$watchdog_pid" > "$PID_FILE"

  sleep 0.4
  if ! kill -0 "$watchdog_pid" >/dev/null 2>&1; then
    echo "[dev:db:tunnel:up] Watchdog process exited too early." >&2
    tail -n 40 "$LOG_FILE" >&2 || true
    exit 1
  fi
}

if is_watchdog_running; then
  echo "[dev:db:tunnel:up] DB tunnel watchdog already running."
else
  start_watchdog
fi

if is_port_open; then
  echo "[dev:db:tunnel:up] DB tunnel already available on localhost:$LOCAL_PORT."
  exit 0
fi

echo "[dev:db:tunnel:up] Waiting for DB tunnel to become available ..."
for _ in {1..30}; do
  if is_port_open; then
    echo "[dev:db:tunnel:up] DB tunnel is ready."
    exit 0
  fi
  sleep 0.5
done

echo "[dev:db:tunnel:up] Tunnel did not become ready in time." >&2
tail -n 60 "$LOG_FILE" >&2 || true
exit 1
