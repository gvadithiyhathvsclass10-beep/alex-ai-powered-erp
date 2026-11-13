/**
 * Question parser for extracting structured questions from document pages
 * Page-aware with provenance tracking
 * Supports multiple question paper formats from universities
 */

import type { QuestionOccurrence, SourceDocument } from './types';
import { normalizeQuestion, extractMarks, extractUnitReference, cleanMarksAnnotations, splitSubQuestions } from './text-normalization';

/** 
 * Comprehensive regex patterns for question detection
 * Handles various university question paper formats:
 * - 1. Explain ...
 * - 1) Explain ...
 * - Q1. Explain ...
 * - Q1: Explain ...
 * - Question 1: Explain ...
 * - 1(a) Explain ...
 * - (a) Explain ...
 * - 2. (a) Explain ...
 * - Questions split across multiple lines
 * - Questions with marks at the end
 * - Questions with unit/year references
 */
const QUESTION_PATTERNS = [
  // Pattern 1: Numbered questions - "1. ", "1) ", "1: "
  /(?:^|\n)\s*(\d{1,3})\s*[.):]\s+/gim,
  // Pattern 2: Q-prefixed - "Q1. ", "Q1) ", "Q1: ", "Question 1. "
  /(?:^|\n)\s*(?:Q(?:uestion)?[\s.#:-]*)(\d{1,3})\s*[.):]\s+/gim,
  // Pattern 3: Sub-questions - "(a) ", "a) ", "(a). ", "a. "
  /(?:^|\n)\s*\(([a-z])\)\s+/gim,
  /(?:^|\n)\s*([a-z])[.):]\s+/gim,
  // Pattern 4: Combined - "1(a) ", "1. (a) "
  /(?:^|\n)\s*(\d{1,3})\s*\(([a-z])\)\s+/gim,
  /(?:^|\n)\s*(\d{1,3})\.\s*\(([a-z])\)\s+/gim,
] as const;

/** Fallback patterns for question-like content */
const FALLBACK_QUESTION_INDICATORS = [
  /\?\s*$/,
  /^(explain|describe|define|discuss|derive|compare|write|what|how|state|list|identify|calculate|prove|show|analyze|evaluate|illustrate|differentiate|distinguish|enumerate|outline|summarize|examine|critically|comment)\b/i,
  /\b(short note|long answer|brief note)\b/i,
];

const YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;
const MARKS_PATTERN = /\[\s*(\d+)\s*marks?\s*\]|\(\s*(\d+)\s*marks?\s*\)|\b(\d+)\s*marks?\b/gi;

/**
 * Parse questions from extracted document pages
 */
export function parseQuestions(
  pages: Array<{ page: number; text: string; ocrUsed?: boolean }>,
  doc: SourceDocument
): QuestionOccurrence[] {
  const out: QuestionOccurrence[] = [];
  const seenTexts = new Set<string>();

  for (const page of pages) {
    const text = page.text.replace(/\r/g, '\n');
    
    // Try each pattern in order
    let allMatches: Array<{ start: number; end: number; label: string; fullMatch: string }> = [];
    
    for (const pattern of QUESTION_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const fullMatch = match[0];
        const label = match[1] ? (match[2] ? `${match[1]}(${match[2]})` : match[1]) : fullMatch.trim();
        
        // Avoid duplicate matches at same position
        const existing = allMatches.find(m => m.start === start);
        if (!existing || fullMatch.length > existing.fullMatch.length) {
          allMatches.push({ start, end: start + fullMatch.length, label, fullMatch });
        }
        
        // Prevent infinite loop on zero-width matches
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    }

    // Sort matches by position
    allMatches.sort((a, b) => a.start - b.start);

    // If no structured patterns found, use fallback
    if (allMatches.length === 0) {
      const fallbackQuestions = parseWithFallback(text, page, doc, seenTexts);
      out.push(...fallbackQuestions);
      continue;
    }

    // Extract questions between matches
    for (let i = 0; i < allMatches.length; i++) {
      const current = allMatches[i];
      const next = allMatches[i + 1];
      const end = next ? next.start : text.length;
      const raw = text.slice(current.start, end).trim();
      const body = raw.replace(current.fullMatch, '').trim();

      // Filter out too-short matches and headers/page numbers
      if (body.length > 15 && !isLikelyHeader(body)) {
        const normalized = normalizeQuestion(body);
        // Generate globally unique ID incorporating document ID
        const dedupeKey = `${doc.id}-${page.page}-${normalized.slice(0, 100)}`;
        if (!seenTexts.has(dedupeKey)) {
          seenTexts.add(dedupeKey);
          // Generate globally unique ID incorporating document ID and page
          const uniqueId = `${doc.id}-${page.page}-${current.label}`;
          out.push(makeQuestion(body, uniqueId, page.page, doc, page.ocrUsed, current.label));
        }
      }
    }
  }

  return out;
}

/**
 * Fallback parser for documents without clear question numbering
 */
function parseWithFallback(
  text: string,
  page: { page: number; text: string; ocrUsed?: boolean },
  doc: SourceDocument,
  seenTexts: Set<string>
): QuestionOccurrence[] {
  const out: QuestionOccurrence[] = [];
  
  // Split by double newline (paragraphs)
  const blocks = text
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 30);

  for (const [i, block] of blocks.entries()) {
    // Check if block looks like a question
    const isQuestion = FALLBACK_QUESTION_INDICATORS.some(pattern => pattern.test(block));
    
    // Also accept blocks that are substantial and contain academic keywords
    const hasAcademicContent = /\b(theorem|algorithm|function|structure|mechanism|principle|method|technique|approach|model|framework|architecture|protocol|standard|specification|implementation|analysis|design|optimization|complexity|performance|security|reliability|scalability|maintainability)\b/i.test(block);
    
    if (isQuestion || (block.length > 50 && hasAcademicContent)) {
      const normalized = normalizeQuestion(block);
      // Generate globally unique ID incorporating document ID
      const dedupeKey = `${doc.id}-${page.page}-b-${normalized.slice(0, 100)}`;
      if (!seenTexts.has(dedupeKey)) {
        seenTexts.add(dedupeKey);
        // Generate globally unique ID incorporating document ID
        const uniqueId = `${doc.id}-${page.page}-b${i + 1}`;
        out.push(makeQuestion(block, uniqueId, page.page, doc, page.ocrUsed));
      }
    }
  }
  
  return out;
}

/**
 * Filter out likely headers, footers, page numbers, etc.
 */
function isLikelyHeader(text: string): boolean {
  const trimmed = text.trim();
  // Very short lines
  if (trimmed.length < 20) return true;
  // Page numbers
  if (/^page\s*\d+$/i.test(trimmed)) return true;
  if (/^\d+\s*$/.test(trimmed) && trimmed.length <= 4) return true;
  // Common headers
  if (/^(question\s+paper|examination|university|college|subject|code|semester|year|marks?|total|time|duration|instructions?|note:|notes:)\b/i.test(trimmed)) return true;
  // All caps short lines (likely headers)
  if (trimmed === trimmed.toUpperCase() && trimmed.length < 60 && !/[.?]/.test(trimmed)) return true;
  // Table of contents patterns
  if (/^\d+(\.\d+)*\s+.{5,}\.{3,}\s*\d+$/.test(trimmed)) return true;
  return false;
}

/**
 * Create a QuestionOccurrence from raw question text
 */
function makeQuestion(
  text: string,
  id: string,
  page: number,
  doc: SourceDocument,
  ocrUsed?: boolean,
  questionNumber?: string
): QuestionOccurrence {
  // Extract marks before cleaning
  const marks = extractMarks(text);
  const unit = extractUnitReference(text);
  const yearMatch = text.match(YEAR_PATTERN);

  // Clean marks annotations from text
  const cleanText = cleanMarksAnnotations(text);

  // Extract sub-questions
  const subQuestions = splitSubQuestions(cleanText);

  return {
    id,
    sourceDocumentId: doc.id,
    sourceFileName: doc.fileName,
    page,
    questionNumber: questionNumber ?? null,
    text: cleanText,
    normalizedText: normalizeQuestion(cleanText),
    marks,
    unit,
    topic: null, // Will be populated by AI classification
    concept: null, // Will be populated by AI classification
    questionType: classifyQuestionType(cleanText),
    difficulty: null,
    academicYear: doc.academicYear ?? null,
    examYear: yearMatch ? Number(yearMatch[0]) : (doc.examYear ?? null),
    subQuestions: subQuestions.length > 0 ? subQuestions.map(s => ({ label: '', text: s })) : undefined,
    extractionConfidence: ocrUsed ? 0.7 : 0.9,
    flags: ocrUsed ? ['OCR_EXTRACTED'] : [],
  };
}

/** Classify question type from text */
function classifyQuestionType(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(mcq|multiple.choice|choose|select|option|pick)\b/i.test(lower)) return 'MCQ';
  if (/\b(true|false|t\/f)\b/i.test(lower)) return 'TRUE_FALSE';
  if (/\b(fill.in|blank|complete)\b/i.test(lower)) return 'FILL_IN';
  if (/\b(short|brief|define|state|list|name)\b/i.test(lower) && text.length < 200) return 'SHORT_ANSWER';
  if (/\b(calculate|compute|solve|derive|find|determine|evaluate)\b/i.test(lower)) return 'NUMERICAL';
  if (/\b(explain|describe|discuss|analyze|evaluate|compare|contrast|illustrate|elaborate|elucidate|expound)\b/i.test(lower)) return 'LONG_ANSWER';
  if (/\?\s*$/.test(text.trim())) return 'SHORT_ANSWER';
  return 'UNCLASSIFIED';
}

/** Chunk array into batches */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}