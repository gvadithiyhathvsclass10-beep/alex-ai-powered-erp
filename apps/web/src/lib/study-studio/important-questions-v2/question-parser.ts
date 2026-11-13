/**
 * Question parser for extracting structured questions from document pages
 * Page-aware with provenance tracking
 */

import type { QuestionOccurrence, SourceDocument } from './types';
import { normalizeQuestion, extractMarks, extractUnitReference, cleanMarksAnnotations, splitSubQuestions } from './text-normalization';

/** Regex patterns for question detection */
const QUESTION_START = /(?:^|\n)\s*((?:Q(?:uestion)?[.\s]*)?\d{1,3}\s*[.)]|\([a-z]\)|[a-z][.)])\s+/gim;
const YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;

/**
 * Parse questions from extracted document pages
 */
export function parseQuestions(
  pages: Array<{ page: number; text: string; ocrUsed?: boolean }>,
  doc: SourceDocument
): QuestionOccurrence[] {
  const out: QuestionOccurrence[] = [];

  for (const page of pages) {
    const text = page.text.replace(/\r/g, '\n');
    const matches = [...text.matchAll(QUESTION_START)];

    if (!matches.length) {
      // Fallback: split by double newline and find question-like blocks
      const blocks = text
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 35 && /\?\s*$|^(explain|describe|define|discuss|derive|compare|write|what|how|state|list|identify|calculate|prove|show|analyze|evaluate)\b/i.test(s));

      for (const [i, block] of blocks.entries()) {
        out.push(makeQuestion(block, `${page.page}-b${i + 1}`, page.page, doc, page.ocrUsed));
      }
      continue;
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      const raw = text.slice(start, end).trim();
      const label = matches[i][1]?.trim();
      const body = raw.replace(QUESTION_START, '').trim();

      if (body.length > 8) {
        out.push(makeQuestion(body, `${page.page}-${label || i + 1}`, page.page, doc, page.ocrUsed, label));
      }
    }
  }

  return out;
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
  if (/\b(mcq|multiple.choice|choose|select|option)\b/i.test(lower)) return 'MCQ';
  if (/\b(true|false|t\/f)\b/i.test(lower)) return 'TRUE_FALSE';
  if (/\b(fill.in|blank)\b/i.test(lower)) return 'FILL_IN';
  if (/\b(short|brief|define|state|list|name)\b/i.test(lower) && text.length < 200) return 'SHORT_ANSWER';
  if (/\b(calculate|compute|solve|derive|find|determine)\b/i.test(lower)) return 'NUMERICAL';
  if (/\b(explain|describe|discuss|analyze|evaluate|compare|contrast|illustrate)\b/i.test(lower)) return 'LONG_ANSWER';
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