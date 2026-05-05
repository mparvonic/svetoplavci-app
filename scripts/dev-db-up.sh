#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

./scripts/dev-db-tunnel-up.sh

echo "[dev:db:up] Checking schema..."
npm run db:check:schema

echo "[dev:db:up] Applying migrations..."
sh -c 'set -a; . ./.env.local; set +a; npx prisma migrate deploy'

echo "[dev:db:up] OK - DB is ready for local development."
