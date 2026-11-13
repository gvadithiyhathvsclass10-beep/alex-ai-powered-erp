/**
 * Repository Adapter for V2 Important Questions
 * Wraps existing Prisma models (QuestionPaper, ExtractedQuestion, QuestionAnalysis, etc.)
 * Uses existing models instead of creating new V2 tables
 */

import { prisma } from '@/lib/prisma';
import { serializeBigInt } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage/client';
import type { RepositoryAdapter, AnalysisResult, SourceDocument } from './types';

/**
 * Create repository adapter using existing Prisma models
 */
export function createRepositoryAdapter(): RepositoryAdapter {
  return {
    async createDocument(input) {
      const { ownerId, fileName, mimeType, sizeBytes, storageKey, paperType, subjectId, semester, unit, academicYear, examinationYear, marks } = input;

      const paper = await prisma.questionPaper.create({
        data: {
          userId: ownerId,
          title: fileName.replace(/\.[^/.]+$/, ''),
          fileName,
          fileSize: BigInt(sizeBytes),
          mimeType,
          storagePath: storageKey,
          storageBucket: 'documents',
          paperType: paperType || 'QB',
          subjectId: subjectId || null,
          semester: semester || null,
          unit: unit || null,
          academicYear: academicYear || null,
          examinationYear: examinationYear || null,
          marks: marks || null,
          status: 'UPLOADED',
          pageCount: null,
          metadata: {
            v2StorageKey: storageKey,
            v2CreatedAt: new Date().toISOString(),
          },
        },
        select: { id: true },
      });

      return { id: paper.id };
    },

    async listDocuments(ownerId, ids) {
      const papers = await prisma.questionPaper.findMany({
        where: {
          id: { in: ids },
          userId: ownerId,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          storagePath: true,
          academicYear: true,
          examinationYear: true,
          paperType: true,
          marks: true,
          unit: true,
          semester: true,
          pageCount: true,
        },
      });

      return papers.map(p => ({
        id: p.id,
        fileName: p.fileName,
        mimeType: p.mimeType,
        storageKey: p.storagePath,
        academicYear: p.academicYear,
        examYear: p.examinationYear,
        paperType: p.paperType,
        marks: p.marks,
        unit: p.unit,
        semester: p.semester,
        pageCount: p.pageCount,
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
      const paper = await prisma.questionPaper.findFirst({
        where: { id, userId: ownerId },
      });

      if (!paper) {
        throw new Error('Document not found or access denied');
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

      // Delete paper
      await prisma.questionPaper.delete({ where: { id } });
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