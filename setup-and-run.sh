#!/bin/bash
# ALEX - Complete Setup & Run Script (SQLite + Demo Data)
# Run this script to set up everything and start the dev server

set -e  # Exit on error

echo "🚀 ALEX - Complete Local Setup"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "Run this script from E:\\Project_1\\alex directory"
    exit 1
fi

# 1. Install dependencies
log_info "Installing dependencies..."
npm install

# 2. Approve build scripts (for Prisma, etc.)
log_info "Approving build scripts..."
npm run approve-builds 2>/dev/null || true

# 3. Switch to SQLite schema
log_info "Switching to SQLite schema..."
cp prisma/schema.sqlite.prisma prisma/schema.prisma

# 4. Set SQLite database URL
log_info "Configuring SQLite database..."
echo 'DATABASE_URL="file:./dev.db"' > .env

# 5. Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate

# 6. Push schema to SQLite
log_info "Creating SQLite database..."
npx prisma db push

# 7. Seed demo data
log_info "Seeding demo data (this may take a minute)..."
npx tsx prisma/seed.sqlite.ts

# 8. Start dev server
log_info "Starting development server..."
echo ""
echo "✅ Setup complete! Starting dev server..."
echo ""
echo "🌐 Opening: http://localhost:3000"
echo "📋 Demo credentials will work after server starts"
echo ""

# Start dev server
npm run dev