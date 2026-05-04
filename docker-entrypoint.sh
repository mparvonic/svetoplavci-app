#!/bin/sh
set -e

if [ "${NODE_ENV:-}" = "production" ]; then
  if [ -z "${AUTH_SECRET:-}" ] && [ -z "${NEXTAUTH_SECRET:-}" ]; then
    echo "ERROR: AUTH_SECRET (nebo NEXTAUTH_SECRET) není nastaven. Produkci nelze bezpečně spustit."
    exit 1
  fi
fi

if [ "${RUN_PRISMA_MIGRATE_DEPLOY:-1}" = "1" ]; then
  if [ -n "${POSTGRES_PRISMA_URL:-}" ]; then
    echo "Running Prisma migrate deploy..."
    prisma migrate deploy --config=./prisma.config.mjs
  else
    echo "POSTGRES_PRISMA_URL is not set. Skipping Prisma migrate deploy."
  fi
else
  echo "RUN_PRISMA_MIGRATE_DEPLOY=${RUN_PRISMA_MIGRATE_DEPLOY}. Skipping Prisma migrate deploy."
fi

echo "Starting Next.js..."
exec node server.js
