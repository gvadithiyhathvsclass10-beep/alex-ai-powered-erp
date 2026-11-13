import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies, createAnalysis } from '@/lib/study-studio/important-questions-v2';
import type { AnalysisRequest } from '@/lib/study-studio/important-questions-v2/types';

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
    console.error('[ImportantQuestionsV2] Analyses GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list analyses' } },
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
    console.error('[ImportantQuestionsV2] Analysis POST error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create analysis' } },
      { status: 500 }
    );
  }
}