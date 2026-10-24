# =============================================================================
# ALEX - Multi-stage Dockerfile for Next.js (standalone) + Worker
# =============================================================================
# Targets:
#   - runner-api: Next.js standalone server (API routes + SSR)
#   - runner-worker: Background job worker (document processing, scheduled jobs)
# =============================================================================

# -----------------------------------------------------------------------------
# Base image with Node.js 20 (LTS) and pnpm
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Install dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/validation-schemas/package.json ./packages/validation-schemas/

RUN pnpm install --frozen-lockfile --ignore-scripts

# -----------------------------------------------------------------------------
# Generate Prisma Client
# -----------------------------------------------------------------------------
FROM deps AS prisma

COPY apps/web/prisma ./apps/web/prisma

RUN pnpm --filter apps/web run db:generate

# -----------------------------------------------------------------------------
# Build shared packages
# -----------------------------------------------------------------------------
FROM prisma AS build-packages

COPY packages ./packages

RUN pnpm --filter @alex/shared-types run build && pnpm --filter @alex/shared-utils run build && pnpm --filter @alex/validation-schemas run build

# -----------------------------------------------------------------------------
# Build Next.js
# -----------------------------------------------------------------------------
FROM build-packages AS build-web

COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter apps/web run build

# -----------------------------------------------------------------------------
# Build worker (compile TypeScript)
# -----------------------------------------------------------------------------
FROM build-web AS build-worker

WORKDIR /app/apps/web

RUN npx tsc --project tsconfig.json --outDir ../../dist/worker --noEmit false --module commonjs --target ES2022 --esModuleInterop true --skipLibCheck true --resolveJsonModule true --declaration false 2>/dev/null || true

# Copy compiled worker
RUN mkdir -p /app/dist && cp -r /app/apps/web/dist/worker /app/dist/worker 2>/dev/null || true

# -----------------------------------------------------------------------------
# Production runtime: Next.js API + SSR
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-api

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache openssl wget && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Copy standalone output
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build-web --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma

# Copy dependencies required by Prisma and other runtime features
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations and start server
# DATABASE_URL must be configured in Render.
# Use migrate deploy for production (requires migration files)
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma && node apps/web/server.js"]

# -----------------------------------------------------------------------------
# Production runtime: Background worker
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-worker

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache openssl tesseract-ocr && addgroup -g 1001 -S nodejs && adduser -S worker -u 1001 -G nodejs

# Copy built application
COPY --from=build-web --chown=worker:nodejs /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=worker:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=worker:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build-web --chown=worker:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=deps --chown=worker:nodejs /app/node_modules ./node_modules

# Copy compiled worker
COPY --from=build-worker --chown=worker:nodejs /app/dist/worker ./dist/worker

USER worker

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/web/prisma/schema.prisma && node dist/worker/index.js"]

# -----------------------------------------------------------------------------
# Default production target: API
# -----------------------------------------------------------------------------
FROM runner-api AS final