import { describe, it, expect } from 'vitest';
import { sillytavernFormat } from '$lib/plugins/card-formats/sillytavern';
import type { CharacterCard } from '$lib/types';

function toBuffer(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function toJson(buffer: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(buffer));
}

const stCard = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: 'Alice',
    description: 'A friendly elf from the forest',
    personality: 'Cheerful, curious, slightly mischievous',
    scenario: 'Alice is visiting the human village for the first time.',
    first_mes: '*Alice waves excitedly* Hi there!',
    mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello!',
    creator_notes: 'A test elf character',
    system_prompt: 'You are Alice, a curious elf.',
    post_history_instructions: 'Remember to stay in character.',
    alternate_greetings: ['Hello, traveler!'],
    tags: ['fantasy', 'elf'],
    creator: 'TestCreator',
    character_version: '1.0',
    extensions: { talkativeness: '0.5' },
    character_book: {
      name: 'World Lore',
      description: 'Background knowledge',
      scan_depth: 10,
      token_budget: 4096,
      recursive_scanning: true,
      extensions: {},
      entries: [
        {
          keys: ['magic', 'spell'],
          secondary_keys: ['elf'],
          comment: 'Magic System',
          content: 'Magic in this world draws from nature.',
          constant: false,
          selective: true,
          insertion_order: 100,
          enabled: true,
          position: 'before_char',
          extensions: { position: 0 },
        },
        {
          keys: ['forest'],
          secondary_keys: [],
          comment: 'Forest Lore',
          content: 'The forest is ancient and full of secrets.',
          constant: true,
          selective: false,
          insertion_order: 50,
          enabled: true,
          position: 'after_char',
          extensions: {},
        },
      ],
    },
  },
};

describe('SillyTavern Card Format', () => {
  describe('properties', () => {
    it('has correct id and name', () => {
      expect(sillytavernFormat.id).toBe('sillytavern');
      expect(sillytavernFormat.name).toBe('SillyTavern');
    });

    it('has no extension registration (accessed by id only)', () => {
      expect(sillytavernFormat.supportedExtensions).toEqual([]);
    });
  });

  describe('validate', () => {
    it('returns true for valid ST V2 card', () => {
      expect(sillytavernFormat.validate(toBuffer(stCard))).toBe(true);
    });

    it('returns true for card with spec_version only', () => {
      const card = { spec_version: '2.0', data: { name: 'Test' } };
      expect(sillytavernFormat.validate(toBuffer(card))).toBe(true);
    });

    it('returns false for non-JSON data', () => {
      expect(sillytavernFormat.validate(new TextEncoder().encode('not json').buffer)).toBe(false);
    });

    it('returns false for RisuAI card', () => {
      const risu = { name: 'Test', desc: 'A character' };
      expect(sillytavernFormat.validate(toBuffer(risu))).toBe(false);
    });
  });

  describe('parse', () => {
    it('maps basic fields correctly', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      expect(card.name).toBe('Alice');
      expect(card.description).toBe('A friendly elf from the forest');
      expect(card.personality).toBe('Cheerful, curious, slightly mischievous');
      expect(card.scenario).toBe('Alice is visiting the human village for the first time.');
      expect(card.firstMessage).toBe('*Alice waves excitedly* Hi there!');
    });

    it('maps renamed fields', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      expect(card.exampleMessages).toBe(stCard.data.mes_example);
      expect(card.creatorNotes).toBe(stCard.data.creator_notes);
      expect(card.systemPrompt).toBe(stCard.data.system_prompt);
      expect(card.postHistoryInstructions).toBe(stCard.data.post_history_instructions);
    });

    it('maps alternate_greetings', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));
      expect(card.alternateGreetings).toEqual(['Hello, traveler!']);
    });

    it('maps creator metadata', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      expect(card.creator).toBe('TestCreator');
      expect(card.characterVersion).toBe('1.0');
      expect(card.tags).toEqual(['fantasy', 'elf']);
    });

    it('maps character_book settings to loreSettings', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      expect(card.loreSettings.tokenBudget).toBe(4096);
      expect(card.loreSettings.scanDepth).toBe(10);
      expect(card.loreSettings.recursiveScanning).toBe(true);
    });

    it('maps character_book entries to lorebook', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      expect(card.lorebook).toHaveLength(2);

      const magicEntry = card.lorebook[0];
      expect(magicEntry.name).toBe('Magic System');
      expect(magicEntry.keywords).toEqual(['magic', 'spell']);
      expect(magicEntry.secondaryKeywords).toEqual(['elf']);
      expect(magicEntry.priority).toBe(100);
      expect(magicEntry.content).toBe('Magic in this world draws from nature.');
      expect(magicEntry.constant).toBe(false);
      expect(magicEntry.position).toBe('before_char');
      expect(magicEntry.enabled).toBe(true);
      expect(magicEntry.id).toBeTruthy();
    });

    it('maps constant lorebook entry correctly', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      const forestEntry = card.lorebook[1];
      expect(forestEntry.constant).toBe(true);
      expect(forestEntry.mode).toBe('constant');
      expect(forestEntry.position).toBe('after_char');
    });

    it('uses defaults when character_book is missing', () => {
      const minimal = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: { name: 'Bob', description: 'Simple' },
      };
      const card = sillytavernFormat.parse(toBuffer(minimal));

      expect(card.name).toBe('Bob');
      expect(card.lorebook).toEqual([]);
      expect(card.loreSettings.tokenBudget).toBe(2048);
      expect(card.alternateGreetings).toEqual([]);
    });

    it('preserves extensions in metadata', () => {
      const card = sillytavernFormat.parse(toBuffer(stCard));

      expect(card.metadata.stExtensions).toEqual({ talkativeness: '0.5' });
      expect(card.metadata._stRawCard).toBeDefined();
    });
  });

  describe('export', () => {
    it('exports CharacterCard to ST V2 JSON format', () => {
      const parsed = sillytavernFormat.parse(toBuffer(stCard));
      const exported = toJson(sillytavernFormat.export(parsed)) as Record<string, unknown>;

      expect(exported.spec).toBe('chara_card_v2');
      expect(exported.spec_version).toBe('2.0');

      const data = exported.data as Record<string, unknown>;
      expect(data.name).toBe('Alice');
      expect(data.description).toBe('A friendly elf from the forest');
      expect(data.first_mes).toBe('*Alice waves excitedly* Hi there!');
    });
  });

  describe('lossless roundtrip', () => {
    it('import → export preserves ST V2 structure', () => {
      const imported = sillytavernFormat.parse(toBuffer(stCard));
      const exported = toJson(sillytavernFormat.export(imported)) as Record<string, unknown>;

      expect(exported.spec).toBe('chara_card_v2');
      expect(exported.spec_version).toBe('2.0');

      const data = exported.data as Record<string, unknown>;
      expect(data.extensions).toEqual({ talkativeness: '0.5' });

      const book = data.character_book as Record<string, unknown>;
      expect(book.scan_depth).toBe(10);
      expect(book.token_budget).toBe(4096);
      expect(book.recursive_scanning).toBe(true);

      const entries = book.entries as Record<string, unknown>[];
      expect(entries).toHaveLength(2);
      expect(entries[0].comment).toBe('Magic System');
      expect(entries[0].keys).toEqual(['magic', 'spell']);
      expect(entries[0].insertion_order).toBe(100);
      expect(entries[0].extensions).toEqual({ position: 0 });
    });
  });
});
