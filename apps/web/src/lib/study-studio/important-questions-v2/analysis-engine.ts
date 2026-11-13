/**
 * Analysis Engine for Important Questions V2
 * Combines deterministic statistical analysis with AI-powered insights
 */

import type {
  AIAssistance,
  AnalysisRequest,
  AnalysisResult,
  QuestionOccurrence,
  RepeatGroup,
  RankedQuestion,
  SourceDocument,
  Priority,
  RepeatKind,
} from './types';
import { jaccardSimilarity, normalizeQuestion } from './text-normalization';

export interface AnalysisInput {
  id: string;
  title?: string;
  createdAt?: Date;
  documents: SourceDocument[];
  questions: QuestionOccurrence[];
  instructions?: string;
}

/**
 * Main analysis function - analyzes questions with deterministic + AI analysis
 */
export async function analyzeQuestions(
  input: AnalysisInput,
  ai: AIAssistance | undefined,
  request?: AnalysisRequest
): Promise<AnalysisResult> {
  // Ensure all questions have normalized text
  const questions = input.questions.map(q => ({
    ...q,
    normalizedText: q.normalizedText || normalizeQuestion(q.text),
  }));

  // AI classification (topic, unit, concept, semantic grouping) - BATCHED
  let annotations: Array<{
    questionId: string;
    topic?: string;
    unit?: string;
    conceptLabel?: string;
    semanticGroupKey?: string;
  }> = [];
  
  let aiClassificationSuccess = false;
  if (ai) {
    try {
      // Process in batches of 40 to avoid token limits and timeouts
      const batches = chunk(questions, 40);
      const classificationResults = await Promise.allSettled(
        batches.map(batch => ai.classifyQuestions(batch, input.instructions))
      );
      
      for (const result of classificationResults) {
        if (result.status === 'fulfilled') {
          annotations.push(...result.value);
        } else {
          console.warn('[ImportantQuestionsV2] AI classification batch failed:', result.reason);
        }
      }
      aiClassificationSuccess = annotations.length > 0;
    } catch (error) {
      console.warn('[ImportantQuestionsV2] AI classification failed entirely:', error);
    }
  }

  // Apply AI annotations to questions
  for (const a of annotations) {
    const q = questions.find(x => x.id === a.questionId);
    if (q) {
      q.topic = a.topic ?? q.topic;
      q.unit = a.unit ?? q.unit;
      // conceptLabel and semanticGroupKey used for grouping
    }
  }

  // Build repeat groups (exact, semantic, concept)
  const groups = buildRepeatGroups(questions, annotations);

  // Rank questions by priority - DETERMINISTIC FIRST, then optional AI enrichment
  const ranked = await rankQuestions(questions, groups, ai, input.instructions, request, annotations, aiClassificationSuccess);

  // Build unit coverage
  const unitMap = new Map<string, { count: number; marks: number; topics: Set<string> }>();
  for (const q of questions) {
    const key = q.unit || 'Unclassified';
    const x = unitMap.get(key) ?? { count: 0, marks: 0, topics: new Set<string>() };
    x.count++;
    x.marks += q.marks ?? 0;
    if (q.topic) x.topics.add(q.topic);
    unitMap.set(key, x);
  }

  // Build topic frequency
  const topicMap = new Map<string, number>();
  for (const q of questions) {
    if (q.topic) topicMap.set(q.topic, (topicMap.get(q.topic) ?? 0) + 1);
  }
  const topicFrequency = [...topicMap]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // Build study order
  const studyOrder = topicFrequency.map((x, i) => ({
    rank: i + 1,
    topic: x.topic,
    reason: `Appears in ${x.count} extracted question(s); review alongside the cited questions.`,
    questionIds: questions.filter(q => q.topic === x.topic).map(q => q.id),
  }));

  // Collect limitations
  const limitations: string[] = [];
  if (questions.some(q => !q.marks)) {
    limitations.push('Some questions have no confidently extracted marks; those marks were not inferred.');
  }
  if (questions.some(q => q.flags?.includes('OCR_EXTRACTED'))) {
    limitations.push('Some text was extracted via OCR; accuracy may be lower for scanned documents.');
  }
  if (!ai) {
    limitations.push('AI classification was not available; topic/unit/concept grouping is limited to extracted metadata.');
  } else if (!aiClassificationSuccess) {
    limitations.push('AI classification was attempted but failed; deterministic analysis used instead.');
  }

  return {
    id: input.id,
    title: input.title ?? 'Important Questions Analysis',
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    documents: input.documents,
    questions,
    repeatGroups: groups,
    rankedQuestions: ranked,
    unitCoverage: [...unitMap]
      .map(([unit, v]) => ({ unit, questionCount: v.count, totalMarks: v.marks, topics: [...v.topics] }))
      .sort((a, b) => a.unit.localeCompare(b.unit)),
    topicFrequency,
    studyOrder,
    summary: {
      papersAnalyzed: input.documents.length,
      totalQuestions: questions.length,
      exactRepeatGroups: groups.filter(g => g.kind === 'EXACT').length,
      semanticRepeatGroups: groups.filter(g => g.kind === 'SEMANTIC').length,
      conceptGroups: groups.filter(g => g.kind === 'CONCEPT').length,
    },
    limitations,
  };
}

/**
 * Build repeat groups: exact, semantic (lexical), and concept (AI)
 */
export function buildRepeatGroups(
  questions: QuestionOccurrence[],
  annotations: Array<{
    questionId: string;
    conceptLabel?: string;
    semanticGroupKey?: string;
  }> = []
): RepeatGroup[] {
  const groups: RepeatGroup[] = [];
  const used = new Set<string>();

  // 1. Exact normalized matches
  const exact = new Map<string, QuestionOccurrence[]>();
  for (const q of questions) {
    const key = q.normalizedText || normalizeQuestion(q.text);
    if (key.length < 8) continue; // Skip too-short normalized text
    exact.set(key, [...(exact.get(key) ?? []), q]);
  }

  for (const [key, items] of exact) {
    if (items.length > 1) {
      const id = `exact-${groups.length + 1}`;
      groups.push({
        id,
        kind: 'EXACT',
        canonicalQuestion: items[0].text,
        occurrenceIds: items.map(x => x.id),
        frequency: items.length,
        confidence: 1,
        explanation: 'The normalized question text matches exactly across source occurrences.',
      });
      items.forEach(x => used.add(x.id));
    }
  }

  // 2. Semantic similarity (lexical Jaccard) - candidate groups
  const remaining = questions.filter(q => !used.has(q.id));
  const pairs = new Map<string, QuestionOccurrence[]>();

  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const a = remaining[i];
      const b = remaining[j];
      const sim = jaccardSimilarity(a.text, b.text);
      if (sim >= 0.72) {
        const key = [a.id, b.id].sort().join('|');
        pairs.set(key, [a, b]);
      }
    }
  }

  // Build connected components from pairs
  const adjacency = new Map<string, Set<string>>();
  for (const pair of pairs.values()) {
    const [a, b] = pair;
    adjacency.set(a.id, new Set([...(adjacency.get(a.id) ?? []), b.id]));
    adjacency.set(b.id, new Set([...(adjacency.get(b.id) ?? []), a.id]));
  }

  const seen = new Set<string>();
  for (const q of remaining) {
    if (seen.has(q.id) || !adjacency.has(q.id)) continue;
    const stack = [q.id];
    const ids: string[] = [];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      for (const n of adjacency.get(id) ?? []) stack.push(n);
    }
    if (ids.length > 1) {
      const items = ids.map(id => questions.find(x => x.id === id)!);
      groups.push({
        id: `semantic-${groups.length + 1}`,
        kind: 'SEMANTIC',
        canonicalQuestion: items[0].text,
        occurrenceIds: ids,
        frequency: ids.length,
        confidence: Math.min(...items.slice(1).map(x => jaccardSimilarity(items[0].text, x.text))),
        explanation:
          'Wording differs, but substantial content-word overlap suggests a related question. ' +
          'Review the original wording before treating these as equivalent.',
      });
    }
  }

  // 3. Concept groups from AI classification
  const conceptMap = new Map<string, QuestionOccurrence[]>();
  for (const a of annotations) {
    if (!a.conceptLabel) continue;
    const q = questions.find(x => x.id === a.questionId);
    if (q) conceptMap.set(a.conceptLabel, [...(conceptMap.get(a.conceptLabel) ?? []), q]);
  }

  for (const [concept, items] of conceptMap) {
    if (items.length < 2) continue;
    groups.push({
      id: `concept-${groups.length + 1}`,
      kind: 'CONCEPT',
      canonicalQuestion: concept,
      occurrenceIds: items.map(x => x.id),
      frequency: items.length,
      confidence: 0.75,
      explanation:
        `AI classified these as testing the concept "${concept}". ` +
        `This is a concept-level grouping, not a claim that the questions are interchangeable.`,
    });
  }

  return groups;
}

/**
 * Rank questions by priority score with evidence-based rationale
 * Uses BATCHED AI calls for priority explanations (max 20 questions enriched)
 */
async function rankQuestions(
  questions: QuestionOccurrence[],
  groups: RepeatGroup[],
  ai: AIAssistance | undefined,
  instructions?: string,
  request?: AnalysisRequest,
  annotations: Array<{ questionId: string; conceptLabel?: string }> = [],
  aiClassificationSuccess: boolean = false
): Promise<RankedQuestion[]> {
  const result: RankedQuestion[] = [];

  // First pass: deterministic scoring for ALL questions
  // Store related groups for each question for later use
  const questionRelatedGroups = new Map<string, RepeatGroup[]>();
  
  for (const q of questions) {
    const related = groups.filter(g => g.occurrenceIds.includes(q.id));
    questionRelatedGroups.set(q.id, related);
    
    const exact = related.filter(g => g.kind === 'EXACT').reduce((n, g) => Math.max(n, g.frequency), 1);
    const semantic = related.some(g => g.kind === 'SEMANTIC');
    const concept = related.some(g => g.kind === 'CONCEPT');
    const marks = q.marks ?? 0;
    const focus = request?.focusUnits?.some(u => u.toLowerCase() === q.unit?.toLowerCase()) ?? false;
    const markFocus = request?.prioritizeMarks?.includes(marks) ?? false;

    // Deterministic priority scoring (0-100)
    const score = Math.min(
      100,
      Math.round(
        20 + // Base score
        Math.min(35, (exact - 1) * 15) + // Exact repeat bonus
        (semantic ? 12 : 0) + // Semantic group bonus
        (concept ? 8 : 0) + // Concept group bonus
        (marks >= 10 ? 12 : marks >= 5 ? 6 : 0) + // Marks weight
        (focus ? 8 : 0) + // Unit focus bonus
        (markFocus ? 5 : 0) // Mark focus bonus
      )
    );

    const priority: Priority = score >= 65 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

    const rationale: string[] = [];
    if (exact > 1) rationale.push(`Exact normalized match found ${exact} times across the uploaded material.`);
    if (semantic) rationale.push('Part of a semantic-similarity group; verify each original variation.');
    if (concept) rationale.push('AI grouped this with other questions testing the same concept.');
    if (marks) rationale.push(`Explicitly carries ${marks} marks in the source.`);
    if (focus) rationale.push(`Matches requested focus unit ${q.unit}.`);
    if (!rationale.length) rationale.push('Included as a distinct question from the uploaded papers; no repeat evidence was found.');

    result.push({
      id: q.id,
      question: q.text,
      priority,
      score,
      rationale: [...rationale], // deterministic rationale only for now
      marks: q.marks,
      unit: q.unit,
      topic: q.topic,
      concept: annotations.find(a => a.questionId === q.id)?.conceptLabel ?? null,
      occurrences: [q],
      repeatGroupIds: related.map(g => g.id),
    });
  }

  // Sort by priority then score
  const priorityOrder: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || b.score - a.score);

  // Second pass: OPTIONAL AI enrichment for top questions only (batched, max 20)
  if (ai && aiClassificationSuccess) {
    try {
      // Only enrich top 20 questions to avoid excessive AI calls
      const topQuestions = result.slice(0, 20);
      const enrichmentPromises = topQuestions.map(rq => {
        const q = questions.find(x => x.id === rq.id);
        if (!q) return Promise.resolve({ id: rq.id, rationale: [] as string[] });
        const related = questionRelatedGroups.get(q.id) || [];
        return ai.explainPriority({ question: q, frequency: rq.repeatGroupIds.length > 0 ? related.filter(g => g.kind === 'EXACT').reduce((n, g) => Math.max(n, g.frequency), 1) : 1, repeatKind: related[0]?.kind, instructions })
          .catch(err => {
            console.warn('[ImportantQuestionsV2] AI enrichment failed for question', q.id, ':', err);
            return [];
          });
      });

      const enrichmentResults = await Promise.allSettled(enrichmentPromises);
      
      for (let i = 0; i < enrichmentResults.length; i++) {
        const rq = topQuestions[i];
        const enrichmentResult = enrichmentResults[i];
        if (enrichmentResult.status === 'fulfilled') {
          const value = enrichmentResult.value;
          // Handle both string[] and { id: string; rationale: string[] } formats
          const rationaleItems = Array.isArray(value) ? value : (value && 'rationale' in value ? value.rationale : []);
          if (rationaleItems.length > 0) {
            rq.rationale.push(...rationaleItems);
            rq.source = 'ai_enhanced';
          }
        }
      }
    } catch (error) {
      console.warn('[ImportantQuestionsV2] AI priority enrichment failed:', error);
    }
  }

  return result;
}

/** Chunk array into batches */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}