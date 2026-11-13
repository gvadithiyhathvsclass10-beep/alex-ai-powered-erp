import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies, createAnalysis } from '@/lib/study-studio/important-questions-v2';
import type { AnalysisRequest } from '@/lib/study-studio/important-questions-v2/types';
import { quickDatabaseCheck } from '@/lib/study-studio/important-questions-v2/db-readiness';

export async function GET() {
  try {
    const user = await requireAuth();

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const analyses = await deps.repository.listAnalyses(user.id);

    return NextResponse.json({ analyses });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    // Check if it's a missing table error
    if (error instanceof Error && (error.message.includes('question_analyses') || error.message.includes('relation') || error.message.includes('does not exist'))) {
      const dbCheck = await quickDatabaseCheck();
      return NextResponse.json(
        { 
          error: { 
            code: 'DATABASE_NOT_READY', 
            message: 'Database schema not ready. Required tables are missing.',
            detail: dbCheck.error,
            missingTables: dbCheck.missingTables
          } 
        },
        { status: 503 }
      );
    }
    console.error('[ImportantQuestionsV2] Analyses GET error:', error);
    if (error instanceof Error) {
      console.error('[ImportantQuestionsV2] Analyses GET error stack:', error.stack);
      console.error('[ImportantQuestionsV2] Analyses GET error name:', error.name);
      console.error('[ImportantQuestionsV2] Analyses GET error message:', error.message);
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list analyses', detail: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const analysisRequest: AnalysisRequest = {
      documentIds: body.documentIds || [],
      instructions: body.instructions,
      title: body.title,
      focusUnits: body.focusUnits,
      prioritizeMarks: body.prioritizeMarks,
    };

    if (!analysisRequest.documentIds.length) {
      return NextResponse.json(
        { error: { code: 'NO_DOCUMENTS', message: 'At least one document ID is required' } },
        { status: 400 }
      );
    }

    // Check database readiness before attempting analysis
    const dbCheck = await quickDatabaseCheck();
    if (!dbCheck.ready) {
      console.error('[ImportantQuestionsV2] Database not ready:', dbCheck);
      return NextResponse.json(
        { 
          error: { 
            code: 'DATABASE_NOT_READY', 
            message: 'Database schema not ready. Required tables are missing.',
            detail: dbCheck.error,
            missingTables: dbCheck.missingTables
          } 
        },
        { status: 503 }
      );
    }

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const result = await createAnalysis(deps, analysisRequest);

    return NextResponse.json({ analysis: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'One or more documents not found' } }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes('No questions')) {
      return NextResponse.json(
        { error: { code: 'NO_QUESTIONS', message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message.includes('could not be extracted')) {
      return NextResponse.json(
        { error: { code: 'EXTRACTION_FAILED', message: error.message } },
        { status: 422 }
      );
    }
    // Check for missing table errors
    if (error instanceof Error && (error.message.includes('question_analyses') || error.message.includes('question_priority_items') || error.message.includes('relation') || error.message.includes('does not exist'))) {
      const dbCheck = await quickDatabaseCheck();
      return NextResponse.json(
        { 
          error: { 
            code: 'DATABASE_NOT_READY', 
            message: 'Database schema not ready. Required tables are missing.',
            detail: dbCheck.error,
            missingTables: dbCheck.missingTables
          } 
        },
        { status: 503 }
      );
    }
    console.error('[ImportantQuestionsV2] Analysis POST error:', error);
    if (error instanceof Error) {
      console.error('[ImportantQuestionsV2] Analysis POST error stack:', error.stack);
      console.error('[ImportantQuestionsV2] Analysis POST error name:', error.name);
      console.error('[ImportantQuestionsV2] Analysis POST error message:', error.message);
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create analysis', detail: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}