import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkDatabaseReadiness } from '@/lib/study-studio/important-questions-v2/db-readiness';

export async function GET() {
  try {
    await requireAuth();

    const result = await checkDatabaseReadiness();

    return NextResponse.json({
      database: {
        connected: result.databaseConnected,
        documentStatusEnum: result.documentStatusEnum,
      },
      tables: {
        required: Array.from(['documents', 'document_chunks', 'study_material_jobs']),
        existing: Array.from(new Set([
          ...Object.keys(result.missingColumns),
          ...(['documents', 'document_chunks', 'study_material_jobs'].filter(t => !result.missingTables.includes(t)))
        ])),
        missing: result.missingTables,
        missingColumns: result.missingColumns,
      },
      migrations: {
        recent: result.migrationStatus,
      },
      errors: result.errors,
      ready: result.ready,
    });
  } catch (error) {
    console.error('[ImportantQuestionsV2] DB check error:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: { 
            code: 'DB_CHECK_FAILED', 
            message: 'Database check failed', 
            detail: error.message 
          } 
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: { code: 'DB_CHECK_FAILED', message: 'Database check failed' } },
      { status: 500 }
    );
  }
}