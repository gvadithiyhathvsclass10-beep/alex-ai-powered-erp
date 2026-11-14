/**
 * Important Questions Generation Service
 * Generates new important questions from study material using the same AI pipeline as Quiz/Flashcards
 * Uses generateStructuredOutput with proper schema validation
 */

import { generateStructuredOutput, type GenerateStructuredOutputInput } from '@/lib/ai/service';
import { prisma } from '@/lib/prisma';
import { canAccessDocument } from '@/lib/document-processing/access';
import type { QuestionOccurrence, SourceDocument, RankedQuestion, AnalysisResult, RepeatGroup, UnitCoverage } from './types';

export interface GenerationInput {
  userId: string;
  documentIds: string[];
  instructions?: string;
  title?: string;
  targetCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  focusUnits?: string[];
  prioritizeMarks?: number[];
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  topic?: string;
  unit?: string;
  concept?: string;
  questionType?: string;
  difficulty?: string;
  marks?: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string[];
  sourceDocumentId?: string;
  page?: number;
}

export interface GenerationResult {
  success: boolean;
  questions?: GeneratedQuestion[];
  analysis?: AnalysisResult;
  error?: string;
  errorCode?: string;
  provider?: string;
  model?: string;
}

/**
 * Generate important questions from study material
 * This mirrors the Quiz generation approach but produces a ranked question paper
 */
export async function generateImportantQuestions(input: GenerationInput): Promise<GenerationResult> {
  try {
    const { userId, documentIds, instructions, title, targetCount = 30, difficulty = 'medium', focusUnits, prioritizeMarks } = input;

    if (!documentIds.length) {
      return { success: false, error: 'At least one document ID is required', errorCode: 'NO_DOCUMENTS' };
    }

    // Fetch and validate documents
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 50 } },
    });

    if (documents.length !== new Set(documentIds).size) {
      return { success: false, error: 'One or more documents not found', errorCode: 'DOCUMENT_NOT_FOUND' };
    }

    // Verify access
    for (const doc of documents) {
      const hasAccess = await canAccessDocument({ id: userId, role: 'STUDENT' }, doc);
      if (!hasAccess) {
        return { success: false, error: 'Access denied to one or more documents', errorCode: 'FORBIDDEN' };
      }
    }

    // Check processing status
    const unprocessedDocs = documents.filter(d => d.status !== 'READY' || !d.chunks?.length);
    if (unprocessedDocs.length > 0) {
      return { 
        success: false, 
        error: `${unprocessedDocs.length} document(s) not ready: ${unprocessedDocs.map(d => d.title).join(', ')}`, 
        errorCode: 'DOCUMENTS_NOT_READY' 
      };
    }

    // Combine document content
    const sourceChunks = documents.flatMap((doc, docIdx) => 
      doc.chunks!.map((chunk, chunkIdx) => 
        `[Source ${docIdx + 1}.${chunkIdx + 1}] (${doc.title}${chunk.pageNumber ? `, p.${chunk.pageNumber}` : ''}${chunk.sectionTitle ? `, ${chunk.sectionTitle}` : ''}):\n${chunk.content.trim()}`
      )
    );

    const combinedContent = sourceChunks.join('\n\n---\n\n').slice(0, 25000);

    // Build generation prompt
    const priorityGuidance = `
PRIORITY CRITERIA:
- HIGH: Core concepts, fundamental principles, frequently tested topics, high-mark questions, prerequisite knowledge
- MEDIUM: Important but secondary concepts, application questions, standard problems
- LOW: Peripheral topics, rarely tested, very specific/niche questions

${instructions ? `USER INSTRUCTIONS: ${instructions}` : ''}
${focusUnits?.length ? `FOCUS UNITS: ${focusUnits.join(', ')}` : ''}
${prioritizeMarks?.length ? `PRIORITIZE MARKS: ${prioritizeMarks.join(', ')}` : ''}
`;

    const schemaDescription = `{
  "questions": [
    {
      "id": "q-1",
      "question": "Clear, specific question text",
      "topic": "Topic name (e.g., Binary Search Trees)",
      "unit": "Unit name if identifiable (e.g., Unit 3)",
      "concept": "Core concept being tested (e.g., Tree Traversal)",
      "questionType": "LONG_ANSWER | SHORT_ANSWER | NUMERICAL | MCQ",
      "difficulty": "easy | medium | hard",
      "marks": 10,
      "priority": "HIGH | MEDIUM | LOW",
      "rationale": ["Reason 1 based on source material", "Reason 2"],
      "sourceDocumentId": "doc-id-if-known",
      "page": 1
    }
  ]
}`;

    const prompt = `Generate ${targetCount} important exam questions from the provided study material.

${priorityGuidance}

DIFFICULTY: ${difficulty}

SOURCE MATERIAL:
${combinedContent}

REQUIREMENTS:
- Questions must be grounded in the provided source material
- Cover key concepts, theorems, algorithms, principles from the material
- Distribute priorities: ~40% HIGH, ~40% MEDIUM, ~20% LOW
- Include marks where appropriate (based on question complexity)
- Each rationale must cite specific source content
- If source doesn't contain enough for ${targetCount} questions, generate fewer but high quality
`;

    const structuredInput: GenerateStructuredOutputInput<{ questions: GeneratedQuestion[] }> = {
      userId,
      systemPrompt: 'You are ALEX, an expert academic examiner. Generate high-quality exam questions strictly from the provided study material. Every question must be answerable from the source. Do not invent concepts.',
      schemaDescription,
      prompt,
      temperature: 0.3,
      maxTokens: 8000,
      validate: (parsed) => {
        const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
        if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
          throw new Error('Model did not return a non-empty questions array');
        }

        const maxSourceId = documents.length;
        const validated = rawQuestions.slice(0, targetCount).map((q: any, idx: number) => {
          // Validate priority
          const priority = (q.priority === 'HIGH' || q.priority === 'MEDIUM' || q.priority === 'LOW') ? q.priority : 'MEDIUM';
          
          // Validate question type
          const questionType = ['LONG_ANSWER', 'SHORT_ANSWER', 'NUMERICAL', 'MCQ'].includes(q.questionType) 
            ? q.questionType 
            : 'LONG_ANSWER';
          
          // Validate difficulty
          const difficulty = ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium';

          return {
            id: q.id || `q-${idx + 1}`,
            question: String(q.question || q.prompt || '').trim(),
            topic: q.topic ? String(q.topic).trim() : undefined,
            unit: q.unit ? String(q.unit).trim() : undefined,
            concept: q.concept ? String(q.concept).trim() : undefined,
            questionType,
            difficulty,
            marks: typeof q.marks === 'number' && q.marks > 0 ? q.marks : undefined,
            priority,
            rationale: Array.isArray(q.rationale) 
              ? q.rationale.map(r => String(r).trim()).filter(Boolean).slice(0, 3)
              : [String(q.rationale || 'Generated from study material').trim()],
            sourceDocumentId: q.sourceDocumentId || undefined,
            page: typeof q.page === 'number' && q.page > 0 ? q.page : undefined,
          };
        });

        return { questions: validated };
      },
    };

    const structured = await generateStructuredOutput(structuredInput);

    // Convert to RankedQuestion format for persistence
    const rankedQuestions: RankedQuestion[] = structured.data.questions.map((q, idx) => ({
      id: q.id,
      question: q.question,
      priority: q.priority,
      score: q.priority === 'HIGH' ? 90 - idx : q.priority === 'MEDIUM' ? 60 - idx : 30 - idx,
      rationale: q.rationale,
      marks: q.marks,
      unit: q.unit,
      topic: q.topic,
      concept: q.concept,
      occurrences: [{
        id: q.id,
        sourceDocumentId: q.sourceDocumentId || documents[0]?.id || '',
        sourceFileName: documents.find(d => d.id === q.sourceDocumentId)?.title || documents[0]?.title || '',
        page: q.page,
        questionNumber: null,
        text: q.question,
        normalizedText: q.question.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim(),
        marks: q.marks,
        unit: q.unit,
        topic: q.topic,
        concept: q.concept,
        questionType: q.questionType,
        difficulty: q.difficulty,
        extractionConfidence: 0.95,
        flags: [],
      }],
      repeatGroupIds: [],
      source: 'ai_generated',
    }));

    // Build minimal AnalysisResult for persistence
    const analysisResult: AnalysisResult = {
      id: crypto.randomUUID(),
      title: title || 'Generated Important Questions',
      createdAt: new Date().toISOString(),
      documents: documents.map(d => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        pageCount: d.pageCount,
        paperType: 'QB' as const,
      })),
      questions: [],
      repeatGroups: [],
      rankedQuestions,
      unitCoverage: [],
      topicFrequency: [],
      studyOrder: [],
      summary: {
        papersAnalyzed: documents.length,
        totalQuestions: rankedQuestions.length,
        exactRepeatGroups: 0,
        semanticRepeatGroups: 0,
        conceptGroups: 0,
      },
      limitations: [
        'Questions were AI-generated from study material, not extracted from existing question papers',
        'Repeat analysis not applicable for generated questions',
      ],
    };

    return { 
      success: true, 
      questions: structured.data.questions,
      analysis: analysisResult,
      provider: structured.provider,
      model: structured.model,
    };

  } catch (error) {
    console.error('[ImportantQuestionsV2] Generation error:', error);
    
    // Handle specific AI service errors
    if (error instanceof Error) {
      if (error.message.includes('MISSING_API_KEY') || error.message.includes('No AI provider')) {
        return { success: false, error: 'AI provider not configured. Please add your API key in AI Settings.', errorCode: 'AI_NOT_CONFIGURED' };
      }
      if (error.message.includes('INVALID_API_KEY') || error.message.includes('401')) {
        return { success: false, error: 'Invalid AI API key. Please check your credentials in AI Settings.', errorCode: 'AI_INVALID_KEY' };
      }
      if (error.message.includes('RATE_LIMIT') || error.message.includes('429')) {
        return { success: false, error: 'AI rate limit exceeded. Please wait and try again.', errorCode: 'AI_RATE_LIMITED' };
      }
      if (error.message.includes('TIMEOUT') || error.message.includes('timeout')) {
        return { success: false, error: 'AI request timed out. Please try again with fewer documents.', errorCode: 'AI_TIMEOUT' };
      }
      if (error.message.includes('non-empty') || error.message.includes('validation') || error.message.includes('JSON')) {
        return { success: false, error: 'AI returned invalid response. Please try again.', errorCode: 'AI_INVALID_RESPONSE' };
      }
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate important questions', 
      errorCode: 'GENERATION_FAILED' 
    };
  }
}

/**
 * Legacy analysis function (extraction + ranking) - kept for backward compatibility
 */
export async function analyzeExistingQuestions(input: GenerationInput): Promise<GenerationResult> {
  // This would call the existing analyze-service.ts logic
  // For now, return not implemented
  return { success: false, error: 'Use generateImportantQuestions for new analysis', errorCode: 'NOT_IMPLEMENTED' };
}