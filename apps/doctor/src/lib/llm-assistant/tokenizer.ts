/**
 * Simple token estimator for GPT-4o-mini
 * Uses word count × 1.3 approximation to avoid heavy tiktoken dependency
 */

/**
 * Estimate token count for a string.
 * GPT models typically use ~1.3 tokens per word for mixed-language text.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length * 1.3);
}

/**
 * Truncate text to fit within a token budget.
 * Cuts at word boundaries.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return '';
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const maxWords = Math.floor(maxTokens / 1.3);

  if (words.length <= maxWords) return text;

  return words.slice(0, maxWords).join(' ') + '...';
}
