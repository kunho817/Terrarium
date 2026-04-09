import { describe, it, expect } from 'vitest';
import { applyRegexScripts } from '$lib/core/chat/regex';
import type { RegexScript } from '$lib/types';

function makeScript(overrides: Partial<RegexScript> & { pattern: string; replacement: string }): RegexScript {
  return {
    id: crypto.randomUUID(),
    name: overrides.name || 'test',
    pattern: overrides.pattern,
    replacement: overrides.replacement,
    stage: overrides.stage || 'modify_input',
    enabled: overrides.enabled ?? true,
    flag: overrides.flag,
  };
}

describe('applyRegexScripts', () => {
  it('applies matching stage script', () => {
    const scripts = [makeScript({ pattern: 'hello', replacement: 'hi', stage: 'modify_input' })];
    const result = applyRegexScripts('hello world', scripts, 'modify_input');
    expect(result).toBe('hi world');
  });

  it('skips scripts at different stage', () => {
    const scripts = [makeScript({ pattern: 'hello', replacement: 'hi', stage: 'modify_input' })];
    const result = applyRegexScripts('hello world', scripts, 'modify_output');
    expect(result).toBe('hello world');
  });

  it('skips disabled scripts', () => {
    const scripts = [makeScript({ pattern: 'hello', replacement: 'hi', enabled: false })];
    const result = applyRegexScripts('hello world', scripts, 'modify_input');
    expect(result).toBe('hello world');
  });

  it('applies global flag by default', () => {
    const scripts = [makeScript({ pattern: 'a', replacement: 'b' })];
    const result = applyRegexScripts('banana', scripts, 'modify_input');
    expect(result).toBe('bbnbnb');
  });

  it('respects custom flag (no global)', () => {
    const scripts = [makeScript({ pattern: 'a', replacement: 'b', flag: '' })];
    const result = applyRegexScripts('banana', scripts, 'modify_input');
    expect(result).toBe('bbnana');
  });

  it('applies multiple scripts in order', () => {
    const scripts = [
      makeScript({ pattern: 'cat', replacement: 'dog' }),
      makeScript({ pattern: 'dog', replacement: 'bird' }),
    ];
    const result = applyRegexScripts('the cat sat', scripts, 'modify_input');
    expect(result).toBe('the bird sat');
  });

  it('skips invalid regex patterns gracefully', () => {
    const scripts = [makeScript({ pattern: '[invalid', replacement: 'x' })];
    const result = applyRegexScripts('hello world', scripts, 'modify_input');
    expect(result).toBe('hello world');
  });

  it('returns input unchanged when no scripts provided', () => {
    const result = applyRegexScripts('hello world', [], 'modify_input');
    expect(result).toBe('hello world');
  });
});
