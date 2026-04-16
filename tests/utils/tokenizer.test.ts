import { describe, it, expect } from 'vitest';
import { countTokens, countTokensAccurate } from '$lib/utils/tokenizer';

describe('tokenizer', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
    expect(countTokens('   ')).toBe(0);
  });

  it('counts tokens approximately by character count', () => {
    expect(countTokens('Hello')).toBeGreaterThanOrEqual(1);
    expect(countTokens('a'.repeat(40))).toBe(10);
  });

  it('normalizes whitespace', () => {
    const result1 = countTokens('hello world');
    const result2 = countTokens('hello    world');
    expect(result1).toBe(result2);
  });

  it('countTokensAccurate uses word boundaries', () => {
    expect(countTokensAccurate('Hello, world!')).toBe(3);
    expect(countTokensAccurate('The quick brown fox')).toBe(4);
  });
});
