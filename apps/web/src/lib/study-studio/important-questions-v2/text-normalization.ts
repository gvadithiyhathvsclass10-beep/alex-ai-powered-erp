/**
 * Conservative text normalization for question comparison
 * Removes formatting noise but preserves semantic content
 */

/** Normalize question text for exact matching */
export function normalizeQuestion(input: string): string {
  return input
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    // Remove question number prefixes
    .replace(/\b(question|q)[\s.#:-]*\d+[a-z]?\b/g, ' ')
    // Remove sub-question markers like (a), (b), etc.
    .replace(/\([a-z]\)/g, ' ')
    .replace(/\b[a-z][.):]\s*/g, ' ')
    // Remove marks annotations like "(10 marks)" or "[10 marks]"
    .replace(/\b\d+\s*(marks?|m)\b/g, ' ')
    .replace(/\[\s*\d+\s*marks?\s*\]/g, ' ')
    .replace(/\(\s*\d+\s*marks?\s*\)/g, ' ')
    // Remove punctuation except word characters, numbers, and spaces
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Create token set for similarity comparison */
export function tokenSet(input: string): Set<string> {
  const stop = new Set([
    'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or',
    'is', 'are', 'with', 'by', 'from', 'what', 'which', 'explain',
    'describe', 'define', 'discuss', 'write', 'short', 'note',
    'how', 'why', 'when', 'where', 'who', 'whom', 'whose',
    'give', 'state', 'list', 'name', 'identify', 'calculate',
    'derive', 'prove', 'show', 'demonstrate', 'illustrate',
    'compare', 'contrast', 'analyze', 'evaluate', 'differentiate',
    'distinguish', 'enumerate', 'outline', 'summarize', 'examine',
    'critically', 'comment', 'elaborate', 'elucidate', 'expound'
  ]);
  return new Set(
    normalizeQuestion(input)
      .split(' ')
      .filter((t) => t.length > 2 && !stop.has(t))
  );
}

/** Jaccard similarity between two token sets */
export function jaccardSimilarity(a: string, b: string): number {
  const aa = tokenSet(a);
  const bb = tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection++;
  return intersection / (aa.size + bb.size - intersection);
}

/** Extract potential unit references from text */
export function extractUnitReference(text: string): string | null {
  const patterns = [
    /\bunit\s*[-:]?\s*([ivx\d]+)\b/i,
    /\bchapter\s*[-:]?\s*(\d+)\b/i,
    /\bmodule\s*[-:]?\s*(\d+)\b/i,
    /\bsection\s*[-:]?\s*(\d+)\b/i,
    /\bpart\s*[-:]?\s*([ivx\d]+)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

/** Extract marks from text */
export function extractMarks(text: string): number | null {
  const patterns = [
    /\[\s*(\d+)\s*marks?\s*\]/i,
    /\(\s*(\d+)\s*marks?\s*\)/i,
    /\b(\d+)\s*marks?\b/i,
    /\b(\d+)\s*m\b/i,  // e.g., "10m"
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

/** Clean marks annotations from question text */
export function cleanMarksAnnotations(text: string): string {
  return text
    .replace(/\[\s*\d+\s*marks?\s*\]/gi, '')
    .replace(/\(\s*\d+\s*marks?\s*\)/gi, '')
    .replace(/\b\d+\s*marks?\b/gi, '')
    .replace(/\b\d+\s*m\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split text into sub-questions */
export function splitSubQuestions(text: string): string[] {
  return text
    .split(/\n\s*(?=\([a-z]\)|[a-z][.)])/i)
    .slice(1)
    .map(s => s.trim())
    .filter(Boolean);
}