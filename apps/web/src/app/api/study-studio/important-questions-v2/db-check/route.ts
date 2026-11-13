import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireAuth();

    // Check database connection and required tables
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('question_analyses', 'question_priority_items', 'question_analysis_items', 'question_papers', 'extracted_questions', 'generated_practice_papers', 'users', 'subjects')
      ORDER BY table_name
    `;
    
    const existingTables = new Set(tables.map(t => t.table_name));
    const requiredTables = ['question_analyses', 'question_priority_items', 'question_analysis_items', 'question_papers', 'extracted_questions', 'generated_practice_papers'];
    const missingTables = requiredTables.filter(t => !existingTables.has(t));
    
    // Check migration history
    let migrationStatus: Array<{ migration_name: string; finished_at: Date | null }> = [];
    try {
      migrationStatus = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at FROM _prisma_migrations 
        WHERE migration_name LIKE '%important_questions%' OR migration_name LIKE '%20251113%'
        ORDER BY finished_at DESC
      `;
    } catch {
      // _prisma_migrations might not exist or be accessible
    }
    
    // Check DocumentStatus enum
    let documentStatusExists = false;
    try {
      const enumCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus'
        ) as exists
      `;
      documentStatusExists = enumCheck[0]?.exists ?? false;
    } catch {
      // ignore
    }

    return NextResponse.json({
      database: {
        connected: true,
        documentStatusEnum: documentStatusExists,
      },
      tables: {
        required: requiredTables,
        existing: Array.from(existingTables),
        missing: missingTables,
      },
      migrations: {
        importantQuestions: migrationStatus,
      },
      ready: missingTables.length === 0 && documentStatusExists,
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