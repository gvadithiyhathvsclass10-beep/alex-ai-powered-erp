import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { createImportantQuestionsDependencies, extractFromStorage } from '@/lib/study-studio/important-questions-v2';
import { parseQuestions } from '@/lib/study-studio/important-questions-v2/question-parser';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const paper = await prisma.questionPaper.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        questions: {
          orderBy: [{ year: 'asc' }, { questionNumber: 'asc' }],
        },
        _count: { select: { questions: true } },
      },
    });

    if (!paper) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 });
    }

    return NextResponse.json({ paper });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Document GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch document' } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const paper = await prisma.questionPaper.findFirst({
      where: { id, userId: user.id },
      include: { questions: true },
    });

    if (!paper) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 });
    }

    if (action === 'extract') {
      // Check if already has questions
      if (paper.questions && paper.questions.length > 0) {
        return NextResponse.json({
          success: true,
          extractedCount: 0,
          totalExtracted: paper.questions.length,
          questions: paper.questions,
          chunksProcessed: 0,
          message: 'Questions already extracted',
        });
      }

      try {
        // Extract text from stored document
        const extracted = await extractFromStorage(
          paper.storageBucket,
          paper.storagePath,
          paper.mimeType,
          paper.fileName
        );

        // Parse questions from extracted text
        const questions = parseQuestions(extracted.pages, {
          id: paper.id,
          fileName: paper.fileName,
          mimeType: paper.mimeType,
        });

        // Save extracted questions
        if (questions.length > 0) {
          await prisma.extractedQuestion.createMany({
            data: questions.map(q => ({
              questionPaperId: paper.id,
              questionNumber: q.questionNumber || null,
              text: q.text,
              subQuestions: q.subQuestions as any,
              marks: q.marks ?? null,
              unit: q.unit ?? null,
              topic: q.topic ?? null,
              concept: q.concept ?? null,
              questionType: q.questionType ?? null,
              difficulty: q.difficulty ?? null,
              year: q.examYear ?? null,
              pageReference: q.page ?? null,
              extractionConfidence: q.extractionConfidence ?? 0.8,
              flags: q.flags ?? [],
            })),
          });
        }

        // Update paper status
        await prisma.questionPaper.update({
          where: { id: paper.id },
          data: { status: 'READY', pageCount: extracted.pages.length },
        });

        return NextResponse.json({
          success: true,
          extractedCount: questions.length,
          totalExtracted: questions.length,
          questions,
          chunksProcessed: 1,
        });
      } catch (extractionError) {
        console.error('[ImportantQuestionsV2] Document extraction error:', extractionError);
        await prisma.questionPaper.update({
          where: { id: paper.id },
          data: { status: 'FAILED' },
        });
        throw extractionError;
      }
    }

    return NextResponse.json({ error: { code: 'INVALID_ACTION', message: 'Invalid action' } }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Document POST error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process document' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const paper = await prisma.questionPaper.findFirst({
      where: { id, userId: user.id },
    });

    if (!paper) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 });
    }

    // Delete questions first
    await prisma.extractedQuestion.deleteMany({
      where: { questionPaperId: id },
    });

    // Delete from storage
    try {
      await deleteFile('documents', paper.storagePath);
    } catch (storageError) {
      console.warn('[ImportantQuestionsV2] Storage delete failed:', storageError);
    }

    await prisma.questionPaper.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Document DELETE error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete document' } },
      { status: 500 }
    );
  }
}