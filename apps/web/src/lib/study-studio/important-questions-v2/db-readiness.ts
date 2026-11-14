/**
 * Database Readiness Utility for Important Questions V2
 * Checks for the actual infrastructure used:
 * - Document model (for uploads)
 * - DocumentChunk model (for retrieval)
 * - StudyMaterialJob model (for analysis persistence)
 * - DocumentStatus enum
 */

import { prisma } from '@/lib/prisma'

export interface DatabaseReadinessResult {
  ready: boolean
  databaseConnected: boolean
  schema: string
  actualSchema: string
  documentStatusEnum: boolean
  missingTables: string[]
  tablesInWrongSchema: string[]
  missingColumns: Record<string, string[]>
  migrationStatus: Array<{
    migration_name: string
    finished_at: Date | null
    rolled_back_at: Date | null
  }>
  errors: string[]
}

/**
 * Required tables for Important Questions V2 feature (using existing infrastructure)
 */
const REQUIRED_TABLES = [
  'documents',
  'document_chunks',
  'study_material_jobs',
] as const

/**
 * Required columns per table (based on Prisma schema)
 */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  documents: [
    'id', 'title', 'description', 'fileName', 'fileSize', 'mimeType',
    'documentType', 'storagePath', 'storageBucket', 'checksum',
    'ownerId', 'subjectId', 'projectId', 'notebookId',
    'status', 'errorMessage', 'pageCount', 'metadata',
    'processorId', 'processedAt', 'createdAt', 'updatedAt'
  ],
  document_chunks: [
    'id', 'documentId', 'content', 'chunkIndex', 'pageNumber',
    'sectionTitle', 'tokenCount', 'embedding', 'metadata', 'createdAt'
  ],
  study_material_jobs: [
    'id', 'userId', 'type', 'status', 'sourceDocId', 'subjectId',
    'input', 'result', 'errorMessage', 'startedAt', 'completedAt',
    'createdAt', 'updatedAt'
  ],
}

/**
 * Check database readiness for Important Questions V2 feature
 */
export async function checkDatabaseReadiness(): Promise<DatabaseReadinessResult> {
  const result: DatabaseReadinessResult = {
    ready: false,
    databaseConnected: false,
    schema: 'public',
    actualSchema: 'public',
    documentStatusEnum: false,
    missingTables: [],
    tablesInWrongSchema: [],
    missingColumns: {},
    migrationStatus: [],
    errors: [],
  }

  try {
    // 1. Test database connection and get actual schema
    await prisma.$queryRaw`SELECT 1`
    result.databaseConnected = true

    // Get the current schema from the database connection
    try {
      const schemaCheck = await prisma.$queryRaw<Array<{ current_schema: string }>>`
        SELECT current_schema() as current_schema
      `
      result.actualSchema = schemaCheck[0]?.current_schema ?? 'public'
      result.schema = result.actualSchema
    } catch (e) {
      result.errors.push(`Failed to determine current schema: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    // 2. Check DocumentStatus enum
    try {
      const enumCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus'
        ) as exists
      `
      result.documentStatusEnum = enumCheck[0]?.exists ?? false
      if (!result.documentStatusEnum) {
        result.errors.push('DocumentStatus enum does not exist in database')
      }
    } catch (e) {
      result.errors.push(`Failed to check DocumentStatus enum: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }

    // 3. Check required tables exist in ANY schema (not just public)
    const tablesInAnySchema = await prisma.$queryRaw<Array<{ table_name: string; table_schema: string }>>`
      SELECT table_name, table_schema FROM information_schema.tables 
      WHERE table_name IN (
        'documents', 'document_chunks', 'study_material_jobs',
        'users', 'subjects'
      )
      ORDER BY table_schema, table_name
    `

    const tablesInPublicSchema = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'documents', 'document_chunks', 'study_material_jobs',
        'users', 'subjects'
      )
      ORDER BY table_name
    `

    const existingTablesInPublic = new Set(tablesInPublicSchema.map(t => t.table_name))
    const existingTablesInAnySchema = new Map(tablesInAnySchema.map(t => [t.table_name, t.table_schema]))

    // Check for missing tables
    result.missingTables = REQUIRED_TABLES.filter(t => !existingTablesInAnySchema.has(t))

    // Check for tables that exist but in wrong schema
    for (const table of REQUIRED_TABLES) {
      const schema = existingTablesInAnySchema.get(table)
      if (schema && schema !== 'public') {
        result.tablesInWrongSchema.push(`${table} (in schema: ${schema})`)
      }
    }

    // 4. Check columns for existing tables (in their actual schema)
    for (const table of REQUIRED_TABLES) {
      const tableSchema = existingTablesInAnySchema.get(table) || 'public'
      if (!existingTablesInAnySchema.has(table)) continue
      
      try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = ${tableSchema} AND table_name = ${table}
        `
        const existingColumns = new Set(columns.map(c => c.column_name))
        const requiredCols = REQUIRED_COLUMNS[table] || []
        const missingCols = requiredCols.filter(c => !existingColumns.has(c))
        
        if (missingCols.length > 0) {
          result.missingColumns[table] = missingCols
        }
      } catch (e) {
        result.errors.push(`Failed to check columns for ${table}: ${e instanceof Error ? e.message : 'Unknown error'}`)
      }
    }

    // 5. Check migration history (for reference)
    try {
      result.migrationStatus = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
        SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations 
        ORDER BY finished_at DESC
        LIMIT 10
      `
    } catch {
      // _prisma_migrations might not exist or be accessible
      result.errors.push('Could not read migration history from _prisma_migrations')
    }

    // 6. Determine overall readiness
    result.ready = result.databaseConnected &&
      result.documentStatusEnum &&
      result.missingTables.length === 0 &&
      result.tablesInWrongSchema.length === 0 &&
      Object.keys(result.missingColumns).length === 0

  } catch (error) {
    result.errors.push(`Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result.databaseConnected = false
  }

  return result
}

/**
 * Quick check - just verify tables exist (for API pre-flight)
 */
export async function quickDatabaseCheck(): Promise<{ ready: boolean; missingTables: string[]; error?: string; details?: any }> {
  try {
    // Check in ANY schema first
    const tablesInAnySchema = await prisma.$queryRaw<Array<{ table_name: string; table_schema: string }>>`
      SELECT table_name, table_schema FROM information_schema.tables 
      WHERE table_name IN ('documents', 'document_chunks', 'study_material_jobs')
    `
    
    const tablesInPublicSchema = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'document_chunks', 'study_material_jobs')
    `
    
    const existingInAny = new Map(tablesInAnySchema.map(t => [t.table_name, t.table_schema]))
    const existingInPublic = new Set(tablesInPublicSchema.map(t => t.table_name))
    const missingTables = REQUIRED_TABLES.filter(t => !existingInAny.has(t))
    const inWrongSchema = REQUIRED_TABLES.filter(t => existingInAny.has(t) && existingInAny.get(t) !== 'public')
    
    let error: string | undefined
    if (missingTables.length > 0) {
      error = `Missing tables: ${missingTables.join(', ')}`
    } else if (inWrongSchema.length > 0) {
      const details = inWrongSchema.map(t => `${t} (in schema: ${existingInAny.get(t)})`).join(', ')
      error = `Required tables exist but in wrong schema (expected 'public'): ${details}`
    }
    
    return { 
      ready: missingTables.length === 0 && inWrongSchema.length === 0, 
      missingTables,
      error,
      details: {
        tablesInPublic: Array.from(existingInPublic),
        tablesInAnySchema: Array.from(existingInAny.entries()),
      }
    }
  } catch (error) {
    return { 
      ready: false, 
      missingTables: [], 
      error: error instanceof Error ? error.message : 'Database connection failed' 
    }
  }
}