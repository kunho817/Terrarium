import { describe, it, expect } from 'vitest';
import { matchLorebook } from '$lib/core/chat/lorebook';
import type { Message, LorebookEntry, LorebookSettings } from '$lib/types';

const defaultSettings: LorebookSettings = {
  tokenBudget: 2048,
  scanDepth: 5,
  recursiveScanning: false,
  fullWordMatching: false,
};

function makeEntry(overrides: Partial<LorebookEntry> & { keywords?: string[] }): LorebookEntry {
  return {
    id: crypto.randomUUID(),
    name: overrides.name || 'test entry',
    keywords: overrides.keywords || [],
    caseSensitive: overrides.caseSensitive ?? false,
    content: overrides.content || 'lore content',
    position: overrides.position || 'before_char',
    priority: overrides.priority ?? 0,
    enabled: overrides.enabled ?? true,
    scanDepth: overrides.scanDepth ?? 5,
    scope: overrides.scope || 'global',
    mode: overrides.mode || 'normal',
    constant: overrides.constant ?? false,
  };
}

function makeMessage(content: string): Message {
  return { role: 'user', content, type: 'dialogue', timestamp: Date.now() };
}

describe('matchLorebook', () => {
  it('matches entries by keyword', () => {
    const messages = [makeMessage('The dragon breathed fire')];
    const entries = [makeEntry({ keywords: ['dragon'], content: 'Dragon lore' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Dragon lore');
  });

  it('matches entries with any keyword (OR logic)', () => {
    const messages = [makeMessage('The elf drew her sword')];
    const entries = [makeEntry({ keywords: ['dragon', 'elf', 'wizard'], content: 'Fantasy lore' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
  });

  it('always includes constant entries', () => {
    const messages = [makeMessage('Hello there')];
    const entries = [makeEntry({ keywords: ['nevermatch'], constant: true, content: 'Always active' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Always active');
  });

  it('skips disabled entries', () => {
    const messages = [makeMessage('The dragon attacked')];
    const entries = [makeEntry({ keywords: ['dragon'], enabled: false, content: 'Disabled lore' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('respects scanDepth — only scans recent messages', () => {
    const messages = [
      makeMessage('A dragon appeared long ago'),   // index 0 — outside scanDepth
      makeMessage('The weather is nice'),           // index 1
      makeMessage('Nothing interesting'),           // index 2
      makeMessage('Just chatting'),                 // index 3
      makeMessage('Current topic'),                 // index 4
    ];
    const settings = { ...defaultSettings, scanDepth: 3 };
    const entries = [makeEntry({ keywords: ['dragon'], content: 'Dragon lore' })];

    const result = matchLorebook(messages, entries, settings);
    expect(result).toHaveLength(0); // 'dragon' is outside scanDepth
  });

  it('sorts by priority (higher first)', () => {
    const messages = [makeMessage('magic and dragons')];
    const entries = [
      makeEntry({ keywords: ['magic'], content: 'Low priority', priority: 1 }),
      makeEntry({ keywords: ['dragons'], content: 'High priority', priority: 10 }),
      makeEntry({ keywords: ['magic'], content: 'Mid priority', priority: 5 }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result.map((e) => e.priority)).toEqual([10, 5, 1]);
  });

  it('enforces token budget', () => {
    const messages = [makeMessage('alpha beta gamma')];
    const entries = [
      makeEntry({ keywords: ['alpha'], content: 'A'.repeat(4000), priority: 10 }), // ~1000 tokens
      makeEntry({ keywords: ['beta'], content: 'B'.repeat(4000), priority: 5 }),   // ~1000 tokens
      makeEntry({ keywords: ['gamma'], content: 'C'.repeat(4000), priority: 1 }),  // ~1000 tokens
    ];
    // Budget = 2048 tokens. First two entries = ~2000 tokens. Third won't fit.
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(2);
    expect(result[0].priority).toBe(10);
    expect(result[1].priority).toBe(5);
  });

  it('performs case-insensitive matching by default', () => {
    const messages = [makeMessage('THE DRAGON ROARED')];
    const entries = [makeEntry({ keywords: ['dragon'], caseSensitive: false, content: 'Dragon lore' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
  });

  it('performs case-sensitive matching when set', () => {
    const messages = [makeMessage('THE DRAGON ROARED')];
    const entries = [makeEntry({ keywords: ['dragon'], caseSensitive: true, content: 'Dragon lore' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty messages', () => {
    const entries = [makeEntry({ keywords: ['dragon'], content: 'Dragon lore' })];
    const result = matchLorebook([], entries, defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty entries', () => {
    const messages = [makeMessage('Hello world')];
    const result = matchLorebook(messages, [], defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('skips entries with empty keywords (non-constant)', () => {
    const messages = [makeMessage('Hello world')];
    const entries = [makeEntry({ keywords: [], content: 'No keywords' })];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });
});
