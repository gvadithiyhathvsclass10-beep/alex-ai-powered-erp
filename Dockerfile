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

RUN pnpm --filter @alex/web run db:generate

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

RUN pnpm --filter @alex/web run build

# -----------------------------------------------------------------------------
# Build Worker bundle using esbuild
# -----------------------------------------------------------------------------
FROM build-web AS build-worker

# Install esbuild for bundling
RUN pnpm add -w -D esbuild

# Create worker bundle entrypoint
RUN cat > /app/worker-bundle-entry.ts << 'EOF'
// Worker bundle entrypoint - imports all modules needed by the worker
import { PrismaClient } from '@prisma/client'
import { summarizeAndAnalyzeDocument, generateStructuredOutput } from './apps/web/src/lib/ai/service'
import { saveDiagram } from './apps/web/src/lib/diagrams/generator'
import { decrypt, encrypt, generateKeyHash } from './apps/web/src/lib/encryption'
import { prisma } from './apps/web/src/lib/prisma'
import { cn } from './apps/web/src/lib/utils'

// Re-export for the worker entrypoint
export { 
  PrismaClient,
  summarizeAndAnalyzeDocument,
  generateStructuredOutput,
  saveDiagram,
  decrypt,
  encrypt,
  generateKeyHash,
  prisma,
  cn
}
EOF

# Bundle the worker modules
RUN cd /app && npx esbuild worker-bundle-entry.ts \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --bundle \
    --external:@prisma/client \
    --external:bcryptjs \
    --external:@aws-sdk/* \
    --outfile=worker-bundle.js \
    --packages=external

# -----------------------------------------------------------------------------
# Production runtime: Next.js API + SSR
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-api

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache \
    openssl \
    tesseract-ocr \
    poppler-utils \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001 -G nodejs

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health || exit 1

# Start the Next.js standalone server
CMD ["node", "apps/web/server.js"]

# -----------------------------------------------------------------------------
# Production runtime: Background worker
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-worker

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache \
    openssl \
    tesseract-ocr \
    poppler-utils \
    && addgroup -g 1001 -S nodejs \
    && adduser -S worker -u 1001 -G nodejs

# Copy built application (standalone Next.js server for Prisma client, etc.)
COPY --from=build-web --chown=worker:nodejs /app/apps/web/.next/standalone ./
COPY --from=build-web --chown=worker:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web --chown=worker:nodejs /app/apps/web/public ./apps/web/public
COPY --from=build-web --chown=worker:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=deps --chown=worker:nodejs /app/node_modules ./node_modules

# Copy esbuild worker bundle
COPY --from=build-worker --chown=worker:nodejs /app/worker-bundle.js ./worker-bundle.js

# Copy worker entry point
COPY --chown=worker:nodejs docker/worker-entrypoint.js ./worker-entrypoint.js

USER worker

CMD ["node", "worker-entrypoint.js"]

# -----------------------------------------------------------------------------
# Default production target: API
# -----------------------------------------------------------------------------
FROM runner-api AS final