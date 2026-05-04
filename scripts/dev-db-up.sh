#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_PORT="${DB_TUNNEL_LOCAL_PORT:-5433}"
TMP_DIR="$ROOT_DIR/.tmp"
LOG_FILE="$TMP_DIR/db-tunnel.log"
PID_FILE="$TMP_DIR/db-tunnel.pid"

mkdir -p "$TMP_DIR"

if ! command -v nc >/dev/null 2>&1; then
  echo "[dev:db:up] Missing dependency: nc (netcat)." >&2
  exit 1
fi

is_port_open() {
  nc -z 127.0.0.1 "$LOCAL_PORT" >/dev/null 2>&1
}

start_tunnel() {
  echo "[dev:db:up] Starting DB tunnel on localhost:$LOCAL_PORT ..."
  nohup npm run db:tunnel >"$LOG_FILE" 2>&1 < /dev/null &
  local tunnel_pid=$!
  disown "$tunnel_pid" 2>/dev/null || true
  echo "$tunnel_pid" > "$PID_FILE"

  for _ in {1..20}; do
    if is_port_open; then
      echo "[dev:db:up] DB tunnel is ready (pid $tunnel_pid)."
      return 0
    fi
    sleep 0.5
  done

  echo "[dev:db:up] Tunnel did not become ready in time." >&2
  if [[ -f "$LOG_FILE" ]]; then
    echo "[dev:db:up] Last tunnel log lines:" >&2
    tail -n 20 "$LOG_FILE" >&2 || true
  fi
  exit 1
}

if is_port_open; then
  echo "[dev:db:up] DB tunnel already available on localhost:$LOCAL_PORT."
else
  start_tunnel
fi

echo "[dev:db:up] Checking schema..."
npm run db:check:schema

echo "[dev:db:up] Applying migrations..."
sh -c 'set -a; . ./.env.local; set +a; npx prisma migrate deploy'

echo "[dev:db:up] OK - DB is ready for local development."
