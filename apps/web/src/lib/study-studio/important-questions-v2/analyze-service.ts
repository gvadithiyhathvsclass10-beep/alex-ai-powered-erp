/**
 * Analysis Service for V2 Important Questions
 * Orchestrates the full analysis pipeline using V2 modules and existing services
 * Uses Document chunks from processed documents (Research Notebook pipeline)
 */

import { prisma } from '@/lib/prisma';
import { analyzeQuestions } from './analysis-engine';
import { parseQuestions } from './question-parser';
import type { AnalysisRequest, AnalysisResult, ImportantQuestionsDependencies, ExtractedDocument, SourceDocument } from './types';

/**
 * Create a new analysis from uploaded documents
 * Uses existing Document chunks from processed documents
 */
export async function createAnalysis(
  deps: ImportantQuestionsDependencies,
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const user = await deps.requireUser();
  
  if (!request.documentIds.length) {
    throw new Error('Upload at least one document before analysis.');
  }

  // Fetch document metadata
  const docs = await deps.repository.listDocuments(user.id, request.documentIds);
  
  if (docs.length !== new Set(request.documentIds).size) {
    throw new Error('One or more documents were not found or are not accessible.');
  }

  console.log('[ImportantQuestionsV2] Starting analysis for', docs.length, 'documents');

  // For each document, get the chunks from the processed Document
  const extractionResults: Array<{
    document: SourceDocument;
    extracted?: ExtractedDocument;
    error?: string;
  }> = [];

  for (let index = 0; index < docs.length; index++) {
    const d = docs[index];
    console.log(`[ImportantQuestionsV2] Retrieving chunks for document ${index + 1}/${docs.length}: ${d.fileName}`);
    try {
      // Get chunks from the processed Document
      const docChunks = await prisma.documentChunk.findMany({
        where: { documentId: d.id },
        orderBy: { chunkIndex: 'asc' },
        select: {
          content: true,
          chunkIndex: true,
          pageNumber: true,
          sectionTitle: true,
        },
      });

      if (!docChunks.length) {
        throw new Error(`Document ${d.fileName} has no processed chunks. Please wait for processing to complete.`);
      }

      // Build ExtractedDocument from chunks
      const pages: Array<{ page: number; text: string; ocrUsed?: boolean }> = [];
      const pageMap = new Map<number, string[]>();
      
      for (const chunk of docChunks) {
        const pageNum = chunk.pageNumber || 1;
        const existing = pageMap.get(pageNum) || [];
        existing.push(chunk.content);
        pageMap.set(pageNum, existing);
      }

      for (const [pageNum, texts] of pageMap.entries()) {
        pages.push({
          page: pageNum,
          text: texts.join('\n\n'),
          ocrUsed: false,
        });
      }

      const extracted: ExtractedDocument = {
        document: {
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          pageCount: pages.length,
        },
        text: docChunks.map(c => c.content).join('\n\n'),
        pages,
      };

      console.log(`[ImportantQuestionsV2] Retrieved ${pages.length} pages with ${docChunks.length} chunks from ${d.fileName}`);
      extractionResults.push({ document: d, extracted });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ImportantQuestionsV2] Failed to retrieve chunks for document ${d.fileName}:`, error);
      extractionResults.push({ document: d, error: errorMsg });
    }
  }

  // Filter successful extractions
  const successfulExtractions = extractionResults.filter(r => r.extracted);
  const failedExtractions = extractionResults.filter(r => r.error);

  if (failedExtractions.length > 0) {
    console.warn('[ImportantQuestionsV2] Some documents failed extraction:', failedExtractions.map(f => `${f.document.fileName}: ${f.error}`));
  }

  if (!successfulExtractions.length) {
    throw new Error('No documents could be processed. Ensure documents are fully processed (READY status) before analysis.');
  }

  // Parse questions from successfully extracted text
  const questions = successfulExtractions.flatMap(x => parseQuestions(x.extracted!.pages, x.extracted!.document));
  console.log(`[ImportantQuestionsV2] Parsed ${questions.length} total questions from ${successfulExtractions.length} documents`);

  if (!questions.length) {
    throw new Error('No questions could be extracted from the uploaded documents. Check document quality or OCR support, then try again.');
  }

  // Run V2 analysis (deterministic + optional AI enrichment)
  console.log('[ImportantQuestionsV2] Running analysis...');
  const result = await analyzeQuestions(
    {
      id: crypto.randomUUID(),
      title: request.title,
      documents: successfulExtractions.map(x => x.extracted!.document),
      questions,
      instructions: request.instructions,
    },
    deps.ai,
    request
  );

  // Add extraction warnings to limitations
  if (failedExtractions.length > 0) {
    result.limitations.push(
      `${failedExtractions.length} document(s) could not be processed: ${failedExtractions.map(f => f.document.fileName).join(', ')}`
    );
  }

  console.log('[ImportantQuestionsV2] Analysis complete, saving...');

  // Persist analysis
  const saved = await deps.repository.saveAnalysis({
    ownerId: user.id,
    title: result.title,
    result,
    documentIds: successfulExtractions.map(x => x.document.id),
  });

  console.log('[ImportantQuestionsV2] Analysis saved with ID:', saved.id);

  return { ...result, id: saved.id };
}

/**
 * Get analysis by ID with ownership check
 */
export async function getAnalysis(
  deps: ImportantQuestionsDependencies,
  analysisId: string
): Promise<AnalysisResult | null> {
  const user = await deps.requireUser();
  return deps.repository.getAnalysis(user.id, analysisId);
}

/**
 * List all analyses for current user
 */
export async function listAnalyses(
  deps: ImportantQuestionsDependencies
): Promise<Array<{ id: string; title: string; createdAt: string; summary: AnalysisResult['summary'] }>> {
  const user = await deps.requireUser();
  return deps.repository.listAnalyses(user.id);
}

/**
 * Delete analysis with ownership check
 */
export async function deleteAnalysis(
  deps: ImportantQuestionsDependencies,
  analysisId: string
): Promise<void> {
  const user = await deps.requireUser();
  return deps.repository.deleteAnalysis(user.id, analysisId);
}

/**
 * Delete document with ownership check
 */
export async function deleteDocument(
  deps: ImportantQuestionsDependencies,
  documentId: string
): Promise<void> {
  const user = await deps.requireUser();
  return deps.repository.deleteDocument(user.id, documentId);
}