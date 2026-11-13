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
  return {
    requireUser: getUserId,
    extractor: createDocumentExtractor(),
    ai: createAIAssistanceAdapter(),
    storage: createStorageAdapter(),
    repository: createRepositoryAdapter(),
  };
}