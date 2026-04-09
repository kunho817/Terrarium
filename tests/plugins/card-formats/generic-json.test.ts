import { describe, it, expect } from 'vitest';
import { genericJsonFormat } from '$lib/plugins/card-formats/generic-json';
import type { CharacterCard } from '$lib/types';

function toBuffer(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function toJson(buffer: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(buffer));
}

const fullCard: CharacterCard = {
  name: 'Alice',
  description: 'A friendly character',
  personality: 'Cheerful',
  scenario: 'A quiet room',
  firstMessage: 'Hi there!',
  alternateGreetings: ['Hello!', 'Hey!'],
  exampleMessages: '<START>\nUser: Hi\nAlice: Hello!',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: 'TestCreator',
  characterVersion: '1.0',
  tags: ['test'],
  creatorNotes: 'A test card',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

describe('Generic JSON Card Format', () => {
  describe('properties', () => {
    it('has correct id and name', () => {
      expect(genericJsonFormat.id).toBe('generic-json');
      expect(genericJsonFormat.name).toBe('Generic JSON');
    });

    it('supports .tcjson extension', () => {
      expect(genericJsonFormat.supportedExtensions).toEqual(['.tcjson']);
    });
  });

  describe('validate', () => {
    it('returns true for valid CharacterCard JSON', () => {
      const data = toBuffer(fullCard);
      expect(genericJsonFormat.validate(data)).toBe(true);
    });

    it('returns false for non-JSON data', () => {
      const data = new TextEncoder().encode('not json').buffer;
      expect(genericJsonFormat.validate(data)).toBe(false);
    });

    it('returns false for JSON missing required fields', () => {
      const data = toBuffer({ name: 'Alice' });
      expect(genericJsonFormat.validate(data)).toBe(false);
    });
  });

  describe('parse', () => {
    it('parses a full CharacterCard from JSON', () => {
      const data = toBuffer(fullCard);
      const card = genericJsonFormat.parse(data);

      expect(card.name).toBe('Alice');
      expect(card.description).toBe('A friendly character');
      expect(card.personality).toBe('Cheerful');
      expect(card.firstMessage).toBe('Hi there!');
      expect(card.alternateGreetings).toEqual(['Hello!', 'Hey!']);
      expect(card.tags).toEqual(['test']);
    });

    it('fills defaults for optional fields', () => {
      const minimal = {
        name: 'Bob',
        description: 'Test',
        personality: '',
        scenario: '',
        firstMessage: 'Hi',
      };
      const data = toBuffer(minimal);
      const card = genericJsonFormat.parse(data);

      expect(card.name).toBe('Bob');
      expect(card.alternateGreetings).toEqual([]);
      expect(card.lorebook).toEqual([]);
      expect(card.triggers).toEqual([]);
      expect(card.scriptState).toEqual({});
      expect(card.emotionImages).toEqual([]);
      expect(card.metadata).toEqual({});
    });
  });

  describe('export', () => {
    it('exports CharacterCard to JSON ArrayBuffer', () => {
      const data = genericJsonFormat.export(fullCard);
      const parsed = toJson(data) as CharacterCard;

      expect(parsed.name).toBe('Alice');
      expect(parsed.description).toBe('A friendly character');
      expect(parsed.tags).toEqual(['test']);
    });
  });

  describe('roundtrip', () => {
    it('lossless roundtrip: parse → export → parse', () => {
      const original = toBuffer(fullCard);
      const card = genericJsonFormat.parse(original);
      const exported = genericJsonFormat.export(card);
      const reParsed = genericJsonFormat.parse(exported);

      expect(reParsed).toEqual(card);
    });
  });
});
