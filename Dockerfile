FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build the application
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG POSTGRES_PRISMA_URL
ENV POSTGRES_PRISMA_URL=$POSTGRES_PRISMA_URL
ARG RUN_PRISMA_DB_PUSH=0

# Generate Prisma client + push schema
RUN npx prisma generate
RUN if [ "$RUN_PRISMA_DB_PUSH" = "1" ]; then \
      npx prisma db push; \
    else \
      echo "Skipping prisma db push during image build"; \
    fi

# Build Next.js standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Production image
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG PRISMA_CLI_VERSION=7.3.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Prisma CLI for runtime migrate deploy
RUN npm install -g prisma@${PRISMA_CLI_VERSION}

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Prisma client (generated)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
