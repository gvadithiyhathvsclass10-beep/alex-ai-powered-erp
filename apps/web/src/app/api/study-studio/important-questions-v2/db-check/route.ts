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
        required: Array.from(['question_analyses', 'question_priority_items', 'question_analysis_items', 'question_papers', 'extracted_questions', 'generated_practice_papers']),
        existing: Array.from(new Set([
          ...Object.keys(result.missingColumns),
          ...(['question_analyses', 'question_priority_items', 'question_analysis_items', 'question_papers', 'extracted_questions', 'generated_practice_papers'].filter(t => !result.missingTables.includes(t)))
        ])),
        missing: result.missingTables,
        missingColumns: result.missingColumns,
      },
      migrations: {
        importantQuestions: result.migrationStatus,
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