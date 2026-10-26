#!/bin/bash
set -e

echo "🔨 Building ALEX for deployment..."

echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🔧 Building shared packages..."
pnpm --filter @alex/shared-types run build
pnpm --filter @alex/shared-utils run build
pnpm --filter @alex/validation-schemas run build

echo "🌐 Building web application..."
pnpm --filter @alex/web run build

echo "⚡ No Firebase Functions package is configured in this workspace; skipping the functions build step."

echo "✅ Build completed successfully!"