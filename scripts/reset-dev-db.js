#!/usr/bin/env node
// ALEX Database Reset Script - Cross-platform
// Resets the local PostgreSQL database and seeds demo data

<<<<<<< HEAD
const { execSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function run(cmd, options = {}) {
  console.log(`[CMD] ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: options.cwd || process.cwd(), shell: true })
  } catch {
=======
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function run(cmd: string, options: { cwd?: string } = {}) {
  console.log(`[CMD] ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: options.cwd || process.cwd(), shell: true })
  } catch (error) {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    console.error(`[ERROR] Command failed: ${cmd}`)
    process.exit(1)
  }
}

function main() {
  const projectRoot = join(__dirname, '..')
  
  // Read DATABASE_URL from .env.local
  let databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    try {
      const envContent = readFileSync(join(projectRoot, '.env.local'), 'utf-8')
      const match = envContent.match(/^DATABASE_URL=["']?(.+?)["']?$/m)
      if (match) databaseUrl = match[1]
    } catch {
      // Ignore
    }
  }

  if (!databaseUrl || !databaseUrl.includes('localhost:5432/alex')) {
    console.error('[ERROR] DATABASE_URL must target localhost:5432/alex')
    process.exit(1)
  }

  console.log('[INFO] Resetting the local ALEX database...')

  const schemaPath = join(projectRoot, 'apps', 'web', 'prisma', 'schema.prisma')
  const seedPath = join(projectRoot, 'apps', 'web', 'prisma', 'seed.ts')
  const prismaCmd = join(projectRoot, 'node_modules', '.bin', 'prisma')
  const tsxCmd = join(projectRoot, 'node_modules', '.bin', 'tsx')

  // Reset database
  run(`${prismaCmd} db push --schema=${schemaPath} --force-reset`)
  
  // Seed demo data
  run(`${tsxCmd} ${seedPath}`)

  console.log('[INFO] Database reset complete!')
}

<<<<<<< HEAD
if (require.main === module) {
  main()
}

module.exports = { main }
=======
main()
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
