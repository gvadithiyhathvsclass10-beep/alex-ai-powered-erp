/**
 * V2 Important Questions - Main Export
 * Isolated module for Study Studio Important Questions V2 feature
 */

// Types
export * from './types';

// Core modules
export * from './text-normalization';
export * from './question-parser';
export * from './analysis-engine';

// Adapters
export { createAIAssistanceAdapter, getUserAIConfig } from './ai-adapter';
export { createDocumentExtractor, extractFromStorage } from './document-extractor';
export { createStorageAdapter, getImportantQuestionsBucket } from './storage';
export { createRepositoryAdapter } from './repository';

// Services
export { createAnalysis, getAnalysis, listAnalyses, deleteAnalysis, deleteDocument } from './analyze-service';
export { renderAnalysisPdf } from './pdf-export';
export { generateImportantQuestions, analyzeExistingQuestions } from './generation';

// Dependency factory for route handlers
import { createAIAssistanceAdapter } from './ai-adapter';
import { createDocumentExtractor } from './document-extractor';
import { createStorageAdapter } from './storage';
import { createRepositoryAdapter } from './repository';
import type { ImportantQuestionsDependencies } from './types';

/**
 * Create full dependency bundle for V2 services
 * Uses existing auth, storage, Prisma, and AI services
 */
export function createImportantQuestionsDependencies(getUserId: () => Promise<{ id: string }>): ImportantQuestionsDependencies {
  // Create a synchronous getter that returns the user ID from the async function
  let cachedUserId: string | undefined;
  const getUser = async () => {
    const user = await getUserId();
    cachedUserId = user.id;
    return user;
  };
  
  return {
    requireUser: getUser,
    extractor: createDocumentExtractor(),
    ai: createAIAssistanceAdapter(() => cachedUserId),
    storage: createStorageAdapter(),
    repository: createRepositoryAdapter(),
  };
}