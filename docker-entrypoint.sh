#!/bin/sh
set -e

if [ "${RUN_PRISMA_MIGRATE_DEPLOY:-1}" = "1" ]; then
  if [ -n "${POSTGRES_PRISMA_URL:-}" ]; then
    echo "Running Prisma migrate deploy..."
    tmp_schema="/tmp/prisma-migrate.schema.prisma"
    awk '
      { print }
      $0 ~ /^[[:space:]]*provider[[:space:]]*=[[:space:]]*"postgresql"[[:space:]]*$/ && !injected {
        print "  url      = env(\"POSTGRES_PRISMA_URL\")"
        injected=1
      }
    ' ./prisma/schema.prisma > "${tmp_schema}"
    if ! grep -q 'url[[:space:]]*=.*POSTGRES_PRISMA_URL' "${tmp_schema}"; then
      echo "Failed to prepare runtime schema with datasource url." >&2
      exit 1
    fi
    prisma migrate deploy --schema="${tmp_schema}"
  else
    echo "POSTGRES_PRISMA_URL is not set. Skipping Prisma migrate deploy."
  fi
else
  echo "RUN_PRISMA_MIGRATE_DEPLOY=${RUN_PRISMA_MIGRATE_DEPLOY}. Skipping Prisma migrate deploy."
fi

echo "Starting Next.js..."
exec node server.js
