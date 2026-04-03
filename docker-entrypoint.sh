#!/bin/sh
set -e

if [ "${RUN_PRISMA_MIGRATE_DEPLOY:-1}" = "1" ]; then
  if [ -n "${POSTGRES_PRISMA_URL:-}" ]; then
    echo "Running Prisma migrate deploy..."
    prisma migrate deploy --config=./prisma.config.ts --schema=./prisma/schema.prisma
  else
    echo "POSTGRES_PRISMA_URL is not set. Skipping Prisma migrate deploy."
  fi
else
  echo "RUN_PRISMA_MIGRATE_DEPLOY=${RUN_PRISMA_MIGRATE_DEPLOY}. Skipping Prisma migrate deploy."
fi

echo "Starting Next.js..."
exec node server.js
