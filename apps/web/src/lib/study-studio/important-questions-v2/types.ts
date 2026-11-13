/**
 * V2 Types for Important Questions Analysis
 * Adapted to align with existing Prisma models and repository conventions
 */

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type RepeatKind = 'EXACT' | 'SEMANTIC' | 'CONCEPT';
export type DocumentStatus = 'QUEUED' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

/**
 * Source document metadata - maps to existing QuestionPaper model
 */
export interface SourceDocument {
  id: string;
  fileName: string;
  mimeType: string;
  academicYear?: string | null;
  examYear?: number | null;
  pageCount?: number | null;
  paperType?: 'QB' | 'PYQ';
  marks?: number | null;
  unit?: string | null;
  semester?: string | null;
}

/**
 * Individual question occurrence with full provenance
 * Maps to existing ExtractedQuestion model
 */
export interface QuestionOccurrence {
  id: string;
  sourceDocumentId: string;
  sourceFileName: string;
  page?: number | null;
  questionNumber?: string | null;
  text: string;
  normalizedText: string;
  marks?: number | null;
  unit?: string | null;
  topic?: string | null;
  concept?: string | null;
  questionType?: string | null;
  difficulty?: string | null;
  academicYear?: string | null;
  examYear?: number | null;
  subQuestions?: Array<{ label: string; text: string; marks?: number }>;
  extractionConfidence?: number;
  flags?: string[];
}

/**
 * Repeat group - exact, semantic, or concept-level grouping
 */
export interface RepeatGroup {
  id: string;
  kind: RepeatKind;
  canonicalQuestion: string;
  occurrenceIds: string[];
  frequency: number;
  confidence: number;
  explanation: string;
}

/**
 * Ranked question with evidence-based priority
 */
export interface RankedQuestion {
  id: string;
  question: string;
  priority: Priority;
  score: number;
  rationale: string[];
  marks?: number | null;
  unit?: string | null;
  topic?: string | null;
  concept?: string | null;
  occurrences: QuestionOccurrence[];
  repeatGroupIds: string[];
  source?: 'historical' | 'web_research' | 'fundamental' | 'ai_enhanced';
}

/**
 * Unit coverage summary
 */
export interface UnitCoverage {
  unit: string;
  questionCount: number;
  totalMarks: number;
  topics: string[];
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  id: string;
  title: string;
  createdAt: string;
  documents: SourceDocument[];
  questions: QuestionOccurrence[];
  repeatGroups: RepeatGroup[];
  rankedQuestions: RankedQuestion[];
  unitCoverage: UnitCoverage[];
  topicFrequency: Array<{ topic: string; count: number }>;
  studyOrder: Array<{ rank: number; topic: string; reason: string; questionIds: string[] }>;
  summary: {
    papersAnalyzed: number;
    totalQuestions: number;
    exactRepeatGroups: number;
    semanticRepeatGroups: number;
    conceptGroups: number;
  };
  limitations: string[];
}

/**
 * Analysis request from client
 */
export interface AnalysisRequest {
  documentIds: string[];
  instructions?: string;
  title?: string;
  focusUnits?: string[];
  prioritizeMarks?: number[];
}

/**
 * Extracted document with page-level text
 */
export interface ExtractedDocument {
  document: SourceDocument;
  text: string;
  pages: Array<{ page: number; text: string; ocrUsed?: boolean }>;
}

/**
 * Document extractor port
 */
export interface DocumentExtractor {
  extract(input: { bytes: Uint8Array; fileName: string; mimeType: string; documentId?: string }): Promise<ExtractedDocument>;
}

/**
 * AI assistance port - implemented using existing AI service
 */
export interface AIAssistance {
  classifyQuestions(
    questions: QuestionOccurrence[],
    instructions?: string
  ): Promise<Array<{
    questionId: string;
    topic?: string;
    unit?: string;
    conceptLabel?: string;
    semanticGroupKey?: string;
  }>>;
  explainPriority(input: {
    question: QuestionOccurrence;
    frequency: number;
    repeatKind?: RepeatKind;
    instructions?: string;
  }): Promise<string[]>;
}

/**
 * Storage port
 */
export interface StorageAdapter {
  put(input: { ownerId: string; fileName: string; mimeType: string; bytes: Uint8Array }): Promise<{ storageKey: string }>;
  get(storageKey: string): Promise<Uint8Array>;
  remove(storageKey: string): Promise<void>;
}

/**
 * Repository port
 */
export interface RepositoryAdapter {
  createDocument(input: {
    ownerId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    paperType?: 'QB' | 'PYQ';
    subjectId?: string | null;
    semester?: string | null;
    unit?: string | null;
    academicYear?: string | null;
    examinationYear?: number | null;
    marks?: number | null;
  }): Promise<{ id: string }>;

  listDocuments(
    ownerId: string,
    ids: string[]
  ): Promise<Array<{
    id: string;
    fileName: string;
    mimeType: string;
    storageKey: string;
    academicYear?: string | null;
    examYear?: number | null;
    paperType?: string | null;
    marks?: number | null;
    unit?: string | null;
    semester?: string | null;
    pageCount?: number | null;
  }>>;

  saveAnalysis(input: {
    ownerId: string;
    title: string;
    result: AnalysisResult;
    documentIds: string[];
  }): Promise<{ id: string }>;

  getAnalysis(ownerId: string, id: string): Promise<AnalysisResult | null>;

  listAnalyses(ownerId: string): Promise<Array<{
    id: string;
    title: string;
    createdAt: string;
    summary: AnalysisResult['summary'];
  }>>;

  deleteDocument(ownerId: string, id: string): Promise<void>;
  deleteAnalysis(ownerId: string, id: string): Promise<void>;
}

/**
 * Full dependency bundle for V2 services
 */
export interface ImportantQuestionsDependencies {
  requireUser(): Promise<{ id: string }>;
  extractor: DocumentExtractor;
  ai: AIAssistance;
  storage: StorageAdapter;
  repository: RepositoryAdapter;
}

/**
 * Validation constants
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'application/rtf',
  'application/vnd.oasis.opendocument.text'
]);

export const ACCEPTED_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'txt', 'md', 'rtf', 'odt'
]);

export function validateUpload(file: { name: string; type: string; size: number }): void {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file format: ${file.name}`);
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} must be between 1 byte and 25 MB.`);
  }
  if (file.type && !ACCEPTED_MIME_TYPES.has(file.type) && file.type !== 'application/octet-stream') {
    throw new Error(`Unsupported MIME type for ${file.name}.`);
  }
}