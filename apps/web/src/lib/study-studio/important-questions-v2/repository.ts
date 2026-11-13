/**
 * Repository Adapter for V2 Important Questions
 * Uses existing Prisma Document model (like Research Notebook)
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

/**
 * Create repository adapter using existing Prisma Document model
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

      const analysis = await prisma.questionAnalysis.create({
        data: {
          userId: ownerId,
          title,
          subjectId: null, // Could be derived from papers
          paperIds: documentIds,
          totalQuestions,
          exactRepeats,
          semanticRepeats,
          analysisData: result as any,
          priorityItems: {
            create: result.rankedQuestions.map(item => ({
              questionId: item.id,
              priority: item.priority,
              reason: item.rationale.join('; '),
              frequency: item.occurrences[0] ? result.repeatGroups
                .filter(g => g.occurrenceIds.includes(item.occurrences[0].id))
                .reduce((sum, g) => sum + g.frequency, 1) : 1,
              recencyScore: 0.5, // Could be calculated
              marksWeight: 0.5,
              unitRelevance: 0.5,
              papersCount: new Set(item.occurrences.map(o => o.sourceDocumentId)).size,
            })),
          },
        },
        select: { id: true },
      });

      return { id: analysis.id };
    },

    async getAnalysis(ownerId, id) {
      const analysis = await prisma.questionAnalysis.findFirst({
        where: { id, userId: ownerId },
        include: {
          priorityItems: true,
          // analysisData is JSON, already included
        },
      });

      if (!analysis) return null;

      // Convert stored analysis to V2 AnalysisResult format
      const analysisData = analysis.analysisData as any;
      if (analysisData && analysisData.rankedQuestions) {
        return analysisData as AnalysisResult;
      }

      // Fallback: reconstruct from stored data
      return {
        id: analysis.id,
        title: analysis.title,
        createdAt: analysis.createdAt.toISOString(),
        documents: [],
        questions: [],
        repeatGroups: [],
        rankedQuestions: analysis.priorityItems.map(item => ({
          id: item.questionId,
          question: '', // Would need to fetch from ExtractedQuestion
          priority: item.priority as any,
          score: 0,
          rationale: [item.reason],
          marks: null,
          unit: null,
          topic: null,
          occurrences: [],
          repeatGroupIds: [],
        })),
        unitCoverage: [],
        topicFrequency: [],
        studyOrder: [],
        summary: {
          papersAnalyzed: analysis.paperIds.length,
          totalQuestions: analysis.totalQuestions,
          exactRepeatGroups: analysis.exactRepeats,
          semanticRepeatGroups: analysis.semanticRepeats,
          conceptGroups: 0,
        },
        limitations: [],
      };
    },

    async listAnalyses(ownerId) {
      const analyses = await prisma.questionAnalysis.findMany({
        where: { userId: ownerId },
        orderBy: { createdAt: 'desc' },
        include: {
          priorityItems: true,
        },
      });

      return analyses.map(a => {
        const analysisData = a.analysisData as any;
        return {
          id: a.id,
          title: a.title,
          createdAt: a.createdAt.toISOString(),
          summary: analysisData?.summary ?? {
            papersAnalyzed: a.paperIds.length,
            totalQuestions: a.totalQuestions,
            exactRepeatGroups: a.exactRepeats,
            semanticRepeatGroups: a.semanticRepeats,
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
      const analysis = await prisma.questionAnalysis.findFirst({
        where: { id, userId: ownerId },
      });

      if (!analysis) {
        throw new Error('Analysis not found or access denied');
      }

      await prisma.questionAnalysis.delete({ where: { id } });
    },
  };
}