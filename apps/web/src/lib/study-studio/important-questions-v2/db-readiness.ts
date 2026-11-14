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
  documentStatusEnum: boolean
  missingTables: string[]
  missingColumns: Record<string, string[]>
  migrationStatus: Array<{
    migration_name: string
    finished_at: Date | null
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
    documentStatusEnum: false,
    missingTables: [],
    missingColumns: {},
    migrationStatus: [],
    errors: [],
  }

  try {
    // 1. Test database connection
    await prisma.$queryRaw`SELECT 1`
    result.databaseConnected = true

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

    // 3. Check required tables exist
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'documents', 'document_chunks', 'study_material_jobs',
        'users', 'subjects'
      )
      ORDER BY table_name
    `

    const existingTables = new Set(tables.map(t => t.table_name))
    result.missingTables = REQUIRED_TABLES.filter(t => !existingTables.has(t))

    // 4. Check columns for existing tables
    for (const table of REQUIRED_TABLES) {
      if (!existingTables.has(table)) continue
      
      try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = ${table}
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
      result.migrationStatus = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at FROM _prisma_migrations 
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
export async function quickDatabaseCheck(): Promise<{ ready: boolean; missingTables: string[]; error?: string }> {
  try {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'document_chunks', 'study_material_jobs')
    `
    
    const existingTables = new Set(tables.map(t => t.table_name))
    const missingTables = REQUIRED_TABLES.filter(t => !existingTables.has(t))
    
    return { 
      ready: missingTables.length === 0, 
      missingTables,
      error: missingTables.length > 0 ? `Missing tables: ${missingTables.join(', ')}` : undefined
    }
  } catch (error) {
    return { 
      ready: false, 
      missingTables: [], 
      error: error instanceof Error ? error.message : 'Database connection failed' 
    }
  }
}