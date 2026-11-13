/**
 * Repository Adapter for V2 Important Questions
 * Uses existing Prisma Document model (like Research Notebook) for uploads
 * Uses StudyMaterialJob for analysis persistence (avoids legacy question tables)
 * Stores Important Questions metadata in the Document's metadata JSON field
 */

import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage/client';
import crypto from 'node:crypto';
import type { RepositoryAdapter, AnalysisResult, SourceDocument } from './types';

/** Map MIME type to Prisma DocumentType */
function resolveDocumentTypeFromMime(mimeType: string) {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  const mimeToType: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'text/plain': 'TXT',
    'text/markdown': 'MARKDOWN',
    'text/x-markdown': 'MARKDOWN',
    'application/rtf': 'DOC',
    'application/vnd.oasis.opendocument.text': 'DOC',
  };
  return (mimeToType[normalized] as any) || 'OTHER';
}

/** Type for study material jobs - important_questions */
const IQ_JOB_TYPE = 'important_questions';

/**
 * Create repository adapter using existing Prisma Document model for uploads
 * and StudyMaterialJob for analysis persistence
 */
export function createRepositoryAdapter(): RepositoryAdapter {
  return {
    async createDocument(input) {
      const { ownerId, fileName, mimeType, sizeBytes, storageKey, paperType, subjectId, semester, unit, academicYear, examinationYear, marks } = input;

      // Compute checksum from fileName + size + timestamp for uniqueness
      const checksum = crypto.createHash('sha256').update(`${fileName}-${sizeBytes}-${Date.now()}`).digest('hex');

      const doc = await prisma.document.create({
        data: {
          owner: { connect: { id: ownerId } },
          title: fileName.replace(/\.[^/.]+$/, ''),
          fileName,
          fileSize: BigInt(sizeBytes),
          mimeType,
          documentType: resolveDocumentTypeFromMime(mimeType),
          storagePath: storageKey,
          storageBucket: 'documents',
          checksum,
          status: 'UPLOADED',
          pageCount: null,
          metadata: {
            v2StorageKey: storageKey,
            v2CreatedAt: new Date().toISOString(),
            paperType: paperType || 'QB',
            subjectId: subjectId || null,
            semester: semester || null,
            unit: unit || null,
            academicYear: academicYear || null,
            examinationYear: examinationYear || null,
            marks: marks || null,
          },
        },
        select: { id: true },
      });

      return { id: doc.id };
    },

    async listDocuments(ownerId, ids) {
      const whereClause = ids.length > 0 
        ? { id: { in: ids }, ownerId }
        : { ownerId };
      
      const docs = await prisma.document.findMany({
        where: whereClause,
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          storagePath: true,
          metadata: true,
          pageCount: true,
        },
      });

      return docs.map(d => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        storageKey: d.storagePath,
        academicYear: (d.metadata as any)?.academicYear ?? null,
        examYear: null,
        paperType: (d.metadata as any)?.paperType || 'QB',
        marks: (d.metadata as any)?.marks ?? null,
        unit: (d.metadata as any)?.unit ?? null,
        semester: (d.metadata as any)?.semester ?? null,
        pageCount: d.pageCount,
      }));
    },

    async saveAnalysis(input) {
      const { ownerId, title, result, documentIds } = input;

      // Calculate summary counts
      const totalQuestions = result.questions.length;
      const exactRepeats = result.summary.exactRepeatGroups;
      const semanticRepeats = result.summary.semanticRepeatGroups;

      // Prepare result JSON for StudyMaterialJob
      const jobResult = {
        ...result,
        // Ensure the result is serializable (remove circular references)
        questions: result.questions.map(q => ({
          ...q,
          occurrences: q.occurrences?.map(o => ({
            id: o.id,
            sourceDocumentId: o.sourceDocumentId,
            sourceFileName: o.sourceFileName,
            page: o.page,
            questionNumber: o.questionNumber,
            text: o.text,
            normalizedText: o.normalizedText,
            marks: o.marks,
            unit: o.unit,
            topic: o.topic,
            concept: o.concept,
            questionType: o.questionType,
            difficulty: o.difficulty,
            academicYear: o.academicYear,
            examYear: o.examYear,
            subQuestions: o.subQuestions,
            extractionConfidence: o.extractionConfidence,
            flags: o.flags,
          })) || [],
        })),
        repeatGroups: result.repeatGroups,
        rankedQuestions: result.rankedQuestions.map(rq => ({
          ...rq,
          occurrences: rq.occurrences?.map(o => ({
            id: o.id,
            sourceDocumentId: o.sourceDocumentId,
            sourceFileName: o.sourceFileName,
            page: o.page,
            questionNumber: o.questionNumber,
            text: o.text,
            normalizedText: o.normalizedText,
            marks: o.marks,
            unit: o.unit,
            topic: o.topic,
            concept: o.concept,
            questionType: o.questionType,
            difficulty: o.difficulty,
            academicYear: o.academicYear,
            examYear: o.examYear,
            subQuestions: o.subQuestions,
            extractionConfidence: o.extractionConfidence,
            flags: o.flags,
          })) || [],
        })),
      };

      // Create StudyMaterialJob for analysis persistence
      const job = await prisma.studyMaterialJob.create({
        data: {
          userId: ownerId,
          type: IQ_JOB_TYPE,
          status: 'completed',
          sourceDocId: documentIds[0] || null,
          subjectId: null,
          input: {
            documentIds,
            title,
          } as any,
          result: jobResult as any,
          errorMessage: null,
          startedAt: new Date(),
          completedAt: new Date(),
        },
        select: { id: true },
      });

      return { id: job.id };
    },

    async getAnalysis(ownerId, id) {
      const job = await prisma.studyMaterialJob.findFirst({
        where: { 
          id, 
          userId: ownerId,
          type: IQ_JOB_TYPE,
        },
      });

      if (!job) return null;

      // Convert stored job to V2 AnalysisResult format
      const jobResult = job.result as any;
      if (jobResult && jobResult.rankedQuestions) {
        return {
          ...jobResult,
          id: job.id,
          createdAt: job.createdAt.toISOString(),
        } as AnalysisResult;
      }

      // Fallback: reconstruct from stored data
      return {
        id: job.id,
        title: job.input?.title as string || 'Important Questions Analysis',
        createdAt: job.createdAt.toISOString(),
        documents: [],
        questions: [],
        repeatGroups: [],
        rankedQuestions: [],
        unitCoverage: [],
        topicFrequency: [],
        studyOrder: [],
        summary: {
          papersAnalyzed: 0,
          totalQuestions: 0,
          exactRepeatGroups: 0,
          semanticRepeatGroups: 0,
          conceptGroups: 0,
        },
        limitations: ['Analysis data incomplete'],
      };
    },

    async listAnalyses(ownerId) {
      const jobs = await prisma.studyMaterialJob.findMany({
        where: { 
          userId: ownerId,
          type: IQ_JOB_TYPE,
        },
        orderBy: { createdAt: 'desc' },
      });

      return jobs.map(job => {
        const jobResult = job.result as any;
        return {
          id: job.id,
          title: job.input?.title as string || jobResult?.title || 'Important Questions Analysis',
          createdAt: job.createdAt.toISOString(),
          summary: jobResult?.summary ?? {
            papersAnalyzed: 0,
            totalQuestions: 0,
            exactRepeats: 0,
            semanticRepeats: 0,
            conceptGroups: 0,
          },
        };
      });
    },

    async deleteDocument(ownerId, id) {
      // Check ownership
      const doc = await prisma.document.findFirst({
        where: { id, ownerId },
      });

      if (!doc) {
        throw new Error('Document not found or access denied');
      }

      // Delete from storage
      try {
        await deleteFile('documents', doc.storagePath);
      } catch (storageError) {
        console.warn('[ImportantQuestionsV2] Storage delete failed:', storageError);
      }

      // Delete document
      await prisma.document.delete({ where: { id } });
    },

    async deleteAnalysis(ownerId, id) {
      const job = await prisma.studyMaterialJob.findFirst({
        where: { 
          id, 
          userId: ownerId,
          type: IQ_JOB_TYPE,
        },
      });

      if (!job) {
        throw new Error('Analysis not found or access denied');
      }

      await prisma.studyMaterialJob.delete({ where: { id } });
    },
  };
}