# =============================================================================
# ALEX - Multi-stage Dockerfile for Next.js (static export) + Firebase Functions
# =============================================================================
# Build stage: install deps, generate Prisma, build Next.js static export + functions
# Runtime stage: nginx for Next.js static files, Node.js for Functions
# =============================================================================

# -----------------------------------------------------------------------------
# Base image with Node.js 20 (LTS) and pnpm
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# Install dependencies (cached layer)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY functions/package.json ./functions/
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
RUN pnpm --filter @alex/shared-types run build \
 && pnpm --filter @alex/shared-utils run build \
 && pnpm --filter @alex/validation-schemas run build

# -----------------------------------------------------------------------------
# Build Next.js (static export for Firebase Hosting)
# -----------------------------------------------------------------------------
FROM build-packages AS build-web
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter apps/web run build

# -----------------------------------------------------------------------------
# Build Firebase Functions
# -----------------------------------------------------------------------------
FROM build-packages AS build-functions
COPY functions ./functions
RUN pnpm --filter functions run build

# -----------------------------------------------------------------------------
# Production runtime: nginx serving Next.js static export
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runner-web
WORKDIR /usr/share/nginx/html

# Copy static export from Next.js build
COPY --from=build-web /app/apps/web/out/ ./

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Production runtime: Firebase Functions (optional separate image)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner-functions
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S functions -u 1001 -G nodejs

COPY --from=build-functions --chown=functions:nodejs /app/functions/lib ./lib
COPY --from=build-functions --chown=functions:nodejs /app/functions/package.json ./
COPY --from=build-functions --chown=functions:nodejs /app/node_modules ./node_modules

USER functions

CMD ["node", "lib/index.js"]