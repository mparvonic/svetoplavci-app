#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.tmp/next-dev.pid"

stopped=0

if [[ ! -f "$PID_FILE" ]]; then
  echo "[dev:down] Next dev PID file not found."
else
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    echo "[dev:down] Empty PID file removed."
  elif kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid"
    echo "[dev:down] Stopped Next dev PID $pid."
    stopped=1
  else
    echo "[dev:down] PID $pid is not running."
  fi
  rm -f "$PID_FILE"
fi

while IFS= read -r pid; do
  [[ -z "$pid" ]] && continue
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid"
    echo "[dev:down] Stopped Next dev process $pid for $ROOT_DIR."
    stopped=1
  fi
done < <(ps -axo pid=,command= | awk -v root="$ROOT_DIR" '/next dev/ && index($0, root) { print $1 }')

if [[ "$stopped" -eq 0 ]]; then
  echo "[dev:down] No Next dev process found for $ROOT_DIR."
fi
