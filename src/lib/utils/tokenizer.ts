/**
 * Simple whitespace-based tokenizer for approximate token count.
 * Rule of thumb: ~4 characters per token for English text.
 */
export function countTokens(text: string): number {
  if (!text.trim()) return 0;

  const normalized = text.trim().replace(/\s+/g, ' ');
  return Math.max(1, Math.ceil(normalized.length / 4));
}

/**
 * More accurate tokenization using word boundaries.
 * Still approximate but closer to real tokenizers.
 */
export function countTokensAccurate(text: string): number {
  if (!text.trim()) return 0;

  const words = text.match(/\b\w+\b/g) || [];
  const punctuation = text.match(/[^\w\s]/g) || [];

  return words.length + Math.ceil(punctuation.length / 2);
}
