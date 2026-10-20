<#
.SYNOPSIS
    ALEX - Complete Setup & Run Script (SQLite + Demo Data) for Windows PowerShell
#>

$ErrorActionPreference = 'Stop'

Write-Host "🚀 ALEX - Complete Local Setup" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

function Log-Info { Write-Host "[INFO] $1" -ForegroundColor Green }
function Log-Warn { Write-Host "[WARN] $1" -ForegroundColor Yellow }
function Log-Error { Write-Host "[ERROR] $1" -ForegroundColor Red }

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Log-Error "Run this script from E:\Project_1\alex directory"
    exit 1
}

# 1. Install dependencies
Log-Info "Installing dependencies..."
npm install

# 2. Approve build scripts
Log-Info "Approving build scripts..."
try { npm run approve-builds } catch { }

# 3. Switch to SQLite schema
Log-Info "Switching to SQLite schema..."
Copy-Item "prisma\schema.sqlite.prisma" "prisma\schema.prisma" -Force

# 4. Set SQLite database URL
Log-Info "Configuring SQLite database..."
'DATABASE_URL="file:./dev.db"' | Out-File -Encoding utf8 .env

# 5. Generate Prisma client
Log-Info "Generating Prisma client..."
npx prisma generate

# 6. Push schema to SQLite
Log-Info "Creating SQLite database..."
npx prisma db push

# 7. Seed demo data
Log-Info "Seeding demo data (this may take a minute)..."
npx tsx prisma/seed.sqlite.ts

# 8. Start dev server
Log-Info "Starting development server..."
Write-Host ""
Write-Host "✅ Setup complete! Starting dev server..." -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Opening: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📋 Demo credentials will work after server starts" -ForegroundColor Cyan
Write-Host ""

# Start dev server
npm run dev