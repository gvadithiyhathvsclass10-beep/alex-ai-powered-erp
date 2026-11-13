/**
 * AI Adapter for V2 Important Questions
 * Wraps existing ALEX AI service (resolveAIConfig, generateStructuredOutput, generateText)
 * No second key store - uses existing user configuration
 */

import { generateStructuredOutput, generateText, resolveAIConfig } from '@/lib/ai/service';
import type { AIAssistance, QuestionOccurrence, RepeatKind } from './types';

/**
 * Create AI assistance adapter using existing ALEX AI service
 */
export function createAIAssistanceAdapter(getUserId?: () => string | undefined): AIAssistance {
  const getUser = getUserId || (() => undefined);
  return {
    async classifyQuestions(questions: QuestionOccurrence[], instructions?: string) {
      if (!questions.length) return [];

      // Prepare question summaries for classification
      const questionSummaries = questions.map(q => ({
        id: q.id,
        text: q.text.slice(0, 500),
        marks: q.marks,
        unit: q.unit,
        topic: q.topic,
      }));

      try {
        const result = await generateStructuredOutput<{
          classifications: Array<{
            questionId: string;
            topic?: string;
            unit?: string;
            conceptLabel?: string;
            semanticGroupKey?: string;
          }>;
        }>({
          userId: getUser(),
          systemPrompt: `You are ALEX, an expert academic question classifier. 
Given a list of extracted questions from question papers, classify each question by:
1. Topic - the specific subject topic (e.g., "Binary Search Trees", "Newton's Laws")
2. Unit - the curriculum unit if identifiable (e.g., "Unit 3", "Chapter 5")
3. Concept Label - the fundamental concept being tested (e.g., "Tree Traversal", "Force and Motion")
4. Semantic Group Key - a short key for grouping semantically similar questions (e.g., "tree-traversal", "newton-second-law")

Guidelines:
- Be specific and academic
- Use standard curriculum terminology
- Concept labels should be reusable across similar questions
- Semantic group keys should be lowercase, hyphenated
- Only assign when confident; omit uncertain fields
${instructions ? `\nUser instructions: ${instructions}` : ''}`,
          schemaDescription: `{
  "classifications": [
    {
      "questionId": "q1",
      "topic": "Binary Search Trees",
      "unit": "Unit 3",
      "conceptLabel": "Tree Traversal",
      "semanticGroupKey": "tree-traversal"
    }
  ]
}`,
          prompt: `Classify the following questions:\n\n${JSON.stringify(questionSummaries, null, 2)}`,
          validate: (parsed) => {
            if (!parsed || !Array.isArray(parsed.classifications)) {
              throw new Error('Model did not return valid classifications array');
            }
            return {
              classifications: parsed.classifications.map((c: any) => ({
                questionId: String(c.questionId || '').trim(),
                topic: c.topic ? String(c.topic).trim() : undefined,
                unit: c.unit ? String(c.unit).trim() : undefined,
                conceptLabel: c.conceptLabel ? String(c.conceptLabel).trim() : undefined,
                semanticGroupKey: c.semanticGroupKey ? String(c.semanticGroupKey).trim() : undefined,
              })).filter((c: any) => c.questionId),
            };
          },
        });

        return result.data.classifications;
      } catch (error) {
        console.warn('[ImportantQuestionsV2] AI classification failed:', error);
        return [];
      }
    },

    async explainPriority(input: {
      question: QuestionOccurrence;
      frequency: number;
      repeatKind?: RepeatKind;
      instructions?: string;
    }) {
      try {
        const result = await generateText({
          userId: getUser(),
          systemPrompt: `You are ALEX, an expert academic analyst.
Explain WHY a question should be prioritized for study based on the evidence provided.
Return 1-3 concise bullet-point reasons. Each reason should be specific and evidence-based.
Do not invent evidence. Only use the provided data.`,
          prompt: `Question: "${input.question.text}"
Frequency (exact matches): ${input.frequency}
Repeat type: ${input.repeatKind || 'none'}
Marks: ${input.question.marks ?? 'not specified'}
Unit: ${input.question.unit ?? 'not specified'}
Topic: ${input.question.topic ?? 'not specified'}
${input.instructions ? `User instructions: ${input.instructions}` : ''}

Generate 1-3 specific reasons why this question deserves study priority. Focus on evidence from the data above.`,
          temperature: 0.3,
          maxTokens: 200,
        });

        // Parse bullet points from response
        const lines = result.text
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.startsWith('-') || l.startsWith('•') || l.startsWith('*') || /^\d+\./.test(l))
          .map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''))
          .filter(Boolean);

        return lines.length > 0 ? lines : [result.text.slice(0, 200)];
      } catch (error) {
        console.warn('[ImportantQuestionsV2] AI explanation failed:', error);
        return [];
      }
    },
  };
}

/**
 * Helper to get AI config for a specific user (for use in route handlers)
 */
export async function getUserAIConfig(userId: string) {
  return resolveAIConfig({ userId, taskType: 'structured' });
}