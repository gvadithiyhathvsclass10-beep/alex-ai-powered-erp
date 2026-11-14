/**
 * Analysis Service for V2 Important Questions
 * Orchestrates the full analysis pipeline using V2 modules and existing services
 */

import { analyzeQuestions } from './analysis-engine';
import { parseQuestions } from './question-parser';
import type { AnalysisRequest, AnalysisResult, ImportantQuestionsDependencies, ExtractedDocument, SourceDocument } from './types';

/**
 * Create a new analysis from uploaded documents
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

  // Extract text from each document
  const extracted = await Promise.all(docs.map(async (d) => {
    const bytes = await deps.storage.get(d.storageKey);
    return deps.extractor.extract({ bytes, fileName: d.fileName, mimeType: d.mimeType });
  }));

  // Parse questions from extracted text
  const questions = extracted.flatMap(x => parseQuestions(x.pages, x.document));

  if (!questions.length) {
    throw new Error('No questions could be extracted. Check document quality or OCR support, then try again.');
  }

  // Run V2 analysis - pass user.id to AI adapter for credential resolution
  const result = await analyzeQuestions(
    {
      id: crypto.randomUUID(),
      title: request.title,
      documents: extracted.map(x => x.document),
      questions,
      instructions: request.instructions,
    },
    deps.ai,
    request,
    user.id
  );

  // Persist analysis
  const saved = await deps.repository.saveAnalysis({
    ownerId: user.id,
    title: result.title,
    result,
    documentIds: request.documentIds,
  });

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