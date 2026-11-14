import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createImportantQuestionsDependencies } from '@/lib/study-studio/important-questions-v2';
import { validateUpload, MAX_FILE_BYTES } from '@/lib/study-studio/important-questions-v2/types';
import { createDocumentRecord, processDocument } from '@/lib/document-processing/pipeline';
import { DocumentStatus } from '@prisma/client';
import { uploadFile, fileExists, deleteFile } from '@/lib/storage/client';

export async function GET() {
  try {
    const user = await requireAuth();

    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));
    const documents = await deps.repository.listDocuments(user.id, []);

    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Documents GET error:', error);
    if (error instanceof Error) {
      console.error('[ImportantQuestionsV2] Documents GET error stack:', error.stack);
      console.error('[ImportantQuestionsV2] Documents GET error name:', error.name);
      console.error('[ImportantQuestionsV2] Documents GET error message:', error.message);
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list documents', detail: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();

    const files = formData.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json(
        { error: { code: 'NO_FILES', message: 'At least one file is required' } },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_FILES', message: 'Maximum 10 files per request' } },
        { status: 400 }
      );
    }

    // Get client upload IDs for reliable matching
    const uploadIds = formData.getAll('uploadIds') as string[];

    // Validate each file
    const validationErrors: string[] = [];
    for (const file of files) {
      try {
        validateUpload({ name: file.name, type: file.type, size: file.size });
      } catch (e) {
        validationErrors.push(e instanceof Error ? e.message : `Invalid file: ${file.name}`);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'File validation failed', details: validationErrors } },
        { status: 400 }
      );
    }

    // Parse optional metadata (can be global or per-file)
    const globalPaperType = (formData.get('paperType') as string) || 'QB';
    const globalSubjectId = (formData.get('subjectId') as string) || null;
    const globalSemester = (formData.get('semester') as string) || null;
    const globalUnit = (formData.get('unit') as string) || null;
    const globalAcademicYear = (formData.get('academicYear') as string) || null;
    const globalExaminationYear = formData.get('examinationYear') ? parseInt(formData.get('examinationYear') as string) : null;
    const globalMarks = formData.get('marks') ? parseInt(formData.get('marks') as string) : null;
    const additionalInstructions = (formData.get('additionalInstructions') as string) || null;

    // Parse per-file metadata if provided
    const perFileMetadata: Record<string, { paperType?: string; subjectId?: string; semester?: string; unit?: string; academicYear?: string; examinationYear?: number; marks?: number }> = {}
    try {
      const metadataJson = formData.get('fileMetadata') as string
      if (metadataJson) {
        Object.assign(perFileMetadata, JSON.parse(metadataJson))
      }
    } catch {
      // Ignore metadata parse errors
    }

    // Create dependencies
    const deps = createImportantQuestionsDependencies(async () => ({ id: user.id }));

    const results: Array<{ id: string; uploadId: string; fileName: string; status: string; error?: string }> = [];

    // Process each file through the Research Notebook pipeline
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = uploadIds[i] || `upload-${Date.now()}-${i}`;
      const fileMetadata = perFileMetadata[uploadId] || {}
      let documentId: string | null = null;

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const buffer = Buffer.from(bytes);

        // Upload to storage using the existing pipeline
        const { document, buffer: docBuffer } = await createDocumentRecord(
          user.id,
          file,
          fileMetadata.subjectId || globalSubjectId || undefined,
          undefined, // projectId
          undefined, // notebookId
          file.name, // customTitle
          undefined // description
        );

        // Store Important Questions metadata in document metadata (merge with existing)
        const iqMetadata = {
          v2StorageKey: document.storagePath,
          v2CreatedAt: new Date().toISOString(),
          paperType: (fileMetadata.paperType || globalPaperType) as 'QB' | 'PYQ',
          subjectId: fileMetadata.subjectId || globalSubjectId || null,
          semester: fileMetadata.semester || globalSemester || null,
          unit: fileMetadata.unit || globalUnit || null,
          academicYear: fileMetadata.academicYear || globalAcademicYear || null,
          examinationYear: (fileMetadata.examinationYear ?? globalExaminationYear) ?? null,
          marks: (fileMetadata.marks ?? globalMarks) ?? null,
        };

        // Merge Important Questions metadata into document metadata
        await prisma.document.update({
          where: { id: document.id },
          data: {
            metadata: {
              ...(document.metadata as Record<string, any> || {}),
              ...iqMetadata,
            },
          },
        });

        documentId = document.id;

        // Run the full document processing pipeline (extraction, chunking, embedding, indexing)
        // This ensures the document is READY and has chunks for retrieval
        const processingStats = await processDocument({
          documentId: document.id,
          userId: user.id,
          fileBuffer: buffer,
          fileName: file.name,
          mimeType: file.type,
          documentType: document.documentType,
          subjectId: fileMetadata.subjectId || globalSubjectId || undefined,
        });

        // Update document with processing stats
        await prisma.document.update({
          where: { id: document.id },
          data: {
            pageCount: processingStats.pageCount,
            status: processingStats.status,
            processedAt: new Date(),
            processorId: user.id,
          },
        });

        results.push({ id: document.id, uploadId, fileName: file.name, status: 'uploaded' });
      } catch (error) {
        console.error('[ImportantQuestionsV2] Upload error:', error);
        
        // Clean up storage ONLY if document creation failed (no documentId)
        // If document was created but processing failed, preserve the file and document
        if (!documentId && error instanceof Error) {
          // Document creation failed - we don't have a documentId, so no storage cleanup needed
          // The createDocumentRecord function handles its own storage cleanup on failure
        } else if (documentId && error instanceof Error) {
          // Document was created but processing failed - mark document as FAILED, preserve file
          try {
            await prisma.document.update({
              where: { id: documentId },
              data: {
                status: DocumentStatus.FAILED,
                errorMessage: error.message,
              },
            });
          } catch (updateError) {
            console.error('[ImportantQuestionsV2] Failed to mark document as FAILED:', updateError);
          }
        }

        results.push({
          id: documentId || '',
          uploadId,
          fileName: file.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    const failedCount = results.filter(r => r.status === 'failed').length;
    const status = failedCount === files.length ? 500 : failedCount > 0 ? 207 : 200;

    return NextResponse.json(
      { documents: results },
      { status }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    console.error('[ImportantQuestionsV2] Documents POST error:', error);
    if (error instanceof Error) {
      console.error('[ImportantQuestionsV2] Documents POST error stack:', error.stack);
      console.error('[ImportantQuestionsV2] Documents POST error name:', error.name);
      console.error('[ImportantQuestionsV2] Documents POST error message:', error.message);
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to upload documents', detail: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}