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
ARG APP_RUNTIME_MODE=app
ENV APP_RUNTIME_MODE=$APP_RUNTIME_MODE

# Generate Prisma client + push schema
RUN npx prisma generate
RUN if [ "$APP_RUNTIME_MODE" = "proto" ]; then \
      echo "Skipping prisma db push for proto build mode"; \
    else \
      npx prisma db push; \
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

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

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
