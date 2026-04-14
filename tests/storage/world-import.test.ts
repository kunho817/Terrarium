import { describe, it, expect } from 'vitest';
import { validateWorldCard, parseWorldCard, exportWorldCard } from '$lib/storage/world-import';
import { createDefaultWorldCard } from '$lib/types';
import type { WorldCard } from '$lib/types';

function toBuffer(data: unknown): ArrayBuffer {
  const json = JSON.stringify(data);
  return new TextEncoder().encode(json).buffer;
}

const validWorldData = {
  spec: 'tcworld',
  specVersion: '1.0',
  data: {
    name: 'Test World',
    description: 'A test world',
    scenario: 'Test scenario',
    firstMessage: 'Welcome',
    alternateGreetings: [],
    systemPrompt: '',
    postHistoryInstructions: '',
    lorebook: [],
    loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
    characters: [],
    regexScripts: [],
    triggers: [],
    scriptState: {},
    creator: '',
    tags: [],
    creatorNotes: '',
    metadata: {},
  },
};

describe('validateWorldCard', () => {
  it('returns true for valid .tcworld data', () => {
    expect(validateWorldCard(toBuffer(validWorldData))).toBe(true);
  });

  it('returns false for non-JSON data', () => {
    const buf = new TextEncoder().encode('not json').buffer;
    expect(validateWorldCard(buf)).toBe(false);
  });

  it('returns false for wrong spec', () => {
    const data = { ...validWorldData, spec: 'wrong' };
    expect(validateWorldCard(toBuffer(data))).toBe(false);
  });

  it('returns false for missing data field', () => {
    const data = { spec: 'tcworld', specVersion: '1.0' };
    expect(validateWorldCard(toBuffer(data))).toBe(false);
  });

  it('returns false for missing required fields in data', () => {
    const data = { spec: 'tcworld', specVersion: '1.0', data: { name: 'X' } };
    expect(validateWorldCard(toBuffer(data))).toBe(false);
  });
});

describe('parseWorldCard', () => {
  it('parses valid .tcworld data into WorldCard', () => {
    const result = parseWorldCard(toBuffer(validWorldData));
    expect(result.name).toBe('Test World');
    expect(result.description).toBe('A test world');
  });

  it('fills defaults for missing optional fields', () => {
    const minimal = {
      spec: 'tcworld',
      specVersion: '1.0',
      data: {
        name: 'Minimal',
        description: 'Min',
        scenario: '',
        firstMessage: '',
      },
    };
    const result = parseWorldCard(toBuffer(minimal));
    expect(result.alternateGreetings).toEqual([]);
    expect(result.lorebook).toEqual([]);
    expect(result.characters).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('throws for invalid data', () => {
    const buf = new TextEncoder().encode('bad').buffer;
    expect(() => parseWorldCard(buf)).toThrow();
  });
});

describe('exportWorldCard', () => {
  it('wraps WorldCard in spec envelope', () => {
    const card = createDefaultWorldCard();
    card.name = 'Export Test';
    const buf = exportWorldCard(card);
    const parsed = JSON.parse(new TextDecoder().decode(buf));
    expect(parsed.spec).toBe('tcworld');
    expect(parsed.specVersion).toBe('1.0');
    expect(parsed.data.name).toBe('Export Test');
  });

  it('roundtrips through export then parse', () => {
    const original = createDefaultWorldCard();
    original.name = 'Roundtrip';
    original.description = 'Test roundtrip';
    original.tags = ['tag1', 'tag2'];
    original.characters = [{ id: 'c1', name: 'Char', description: 'A character' }];

    const exported = exportWorldCard(original);
    const reimported = parseWorldCard(exported);
    expect(reimported.name).toBe('Roundtrip');
    expect(reimported.description).toBe('Test roundtrip');
    expect(reimported.tags).toEqual(['tag1', 'tag2']);
    expect(reimported.characters).toEqual([{ id: 'c1', name: 'Char', description: 'A character' }]);
  });
});
