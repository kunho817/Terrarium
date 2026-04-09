import { describe, it, expect } from 'vitest';
import { risuaiFormat } from '$lib/plugins/card-formats/risuai';
import type { CharacterCard } from '$lib/types';

function toBuffer(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function toJson(buffer: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(buffer));
}

const risuCard = {
  name: 'Alice',
  desc: 'A friendly elf from the forest',
  personality: 'Cheerful, curious, slightly mischievous',
  scenario: 'Alice is visiting the human village for the first time.',
  firstMessage: '*Alice waves excitedly* Hi there! I have never been to a human village before!',
  alternateGreetings: ['Hello, traveler!', '*Looks around curiously* So this is a village?'],
  exampleMessage: '<START>\n{{user}}: What brings you here?\n{{char}}: I wanted to see the human world!',
  systemPrompt: 'You are Alice, a curious elf.',
  postHistoryInstructions: 'Remember to stay in character.',
  creatorNotes: 'A test elf character',
  tags: ['fantasy', 'elf'],
  creator: 'TestCreator',
  characterVersion: '1.0',
  backgroundHTML: '<div class="bg"></div>',
  backgroundCSS: '.bg { background: forestgreen; }',
  virtualscript: 'setVar("elf_power", 100)',
  scriptstate: { elf_power: 100, visited: false },
  emotionImages: [['happy', 'happy.png'], ['sad', 'sad.png']],
  additionalAssets: [['asset1', 'type1', 'data1']],
  bias: 'some bias data',
  depth_prompt: { depth: 4, prompt: 'Alice is secretly a princess.' },
  globalLore: [
    {
      key: 'magic, spell, enchantment',
      secondkey: 'elf',
      insertorder: 10,
      comment: 'Magic System',
      content: 'Magic in this world draws from nature. Elves are naturally gifted.',
      mode: 'normal',
      alwaysActive: false,
      selective: true,
      activationPercent: 80,
      extententions: { risu_case_sensitive: false },
      useRegex: false,
      folder: 'worldbuilding',
    },
    {
      key: 'forest',
      secondkey: '',
      insertorder: 5,
      comment: 'Forest Lore',
      content: 'The forest is ancient and full of secrets.',
      mode: 'constant',
      alwaysActive: true,
      selective: false,
      activationPercent: 100,
      extententions: {},
    },
  ],
  customscript: [
    {
      scriptName: 'Replace {{user}}',
      findRegex: '{{user}}',
      replaceString: 'Traveler',
      placeHolder: 'sl000',
      trimString: false,
      onlyFirst: false,
    },
  ],
  triggerscript: [
    {
      name: 'On magic use',
      conditions: [{ type: 'on_message', value: '' }],
      script: 'if getVar("elf_power") > 50 then injectLore("magic") end',
    },
  ],
  sdData: { model: 'stable-diffusion' },
  newGenData: { preset: 'fantasy' },
  extentions: { somePlugin: { enabled: true } },
};

describe('RisuAI Card Format', () => {
  describe('properties', () => {
    it('has correct id and name', () => {
      expect(risuaiFormat.id).toBe('risuai');
      expect(risuaiFormat.name).toBe('RisuAI');
    });

    it('supports .json extension', () => {
      expect(risuaiFormat.supportedExtensions).toEqual(['.json']);
    });
  });

  describe('validate', () => {
    it('returns true for valid RisuAI card', () => {
      const data = toBuffer(risuCard);
      expect(risuaiFormat.validate(data)).toBe(true);
    });

    it('returns true for minimal RisuAI card with desc field', () => {
      const data = toBuffer({ name: 'Test', desc: 'A character' });
      expect(risuaiFormat.validate(data)).toBe(true);
    });

    it('returns false for non-JSON data', () => {
      const data = new TextEncoder().encode('not json').buffer;
      expect(risuaiFormat.validate(data)).toBe(false);
    });

    it('returns false for SillyTavern card', () => {
      const stCard = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: 'Test' } };
      expect(risuaiFormat.validate(toBuffer(stCard))).toBe(false);
    });
  });

  describe('parse', () => {
    it('maps basic fields correctly', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.name).toBe('Alice');
      expect(card.description).toBe('A friendly elf from the forest');
      expect(card.personality).toBe('Cheerful, curious, slightly mischievous');
      expect(card.scenario).toBe('Alice is visiting the human village for the first time.');
      expect(card.firstMessage).toBe('*Alice waves excitedly* Hi there! I have never been to a human village before!');
    });

    it('maps renamed fields', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.description).toBe(risuCard.desc);
      expect(card.exampleMessages).toBe(risuCard.exampleMessage);
    });

    it('maps alternateGreetings', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));
      expect(card.alternateGreetings).toEqual(['Hello, traveler!', '*Looks around curiously* So this is a village?']);
    });

    it('maps prompt fields', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.systemPrompt).toBe('You are Alice, a curious elf.');
      expect(card.postHistoryInstructions).toBe('Remember to stay in character.');
      expect(card.depthPrompt).toEqual({ depth: 4, prompt: 'Alice is secretly a princess.' });
    });

    it('maps creator metadata', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.creator).toBe('TestCreator');
      expect(card.characterVersion).toBe('1.0');
      expect(card.tags).toEqual(['fantasy', 'elf']);
      expect(card.creatorNotes).toBe('A test elf character');
    });

    it('maps UI customization fields', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.backgroundHTML).toBe('<div class="bg"></div>');
      expect(card.backgroundCSS).toBe('.bg { background: forestgreen; }');
    });

    it('maps script fields', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.virtualScript).toBe('setVar("elf_power", 100)');
      expect(card.scriptState).toEqual({ elf_power: 100, visited: false });
    });

    it('maps emotionImages and additionalAssets', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.emotionImages).toEqual([['happy', 'happy.png'], ['sad', 'sad.png']]);
      expect(card.additionalAssets).toEqual([['asset1', 'type1', 'data1']]);
    });

    it('maps lorebook entries', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.lorebook).toHaveLength(2);

      const magicEntry = card.lorebook[0];
      expect(magicEntry.name).toBe('Magic System');
      expect(magicEntry.keywords).toEqual(['magic', 'spell', 'enchantment']);
      expect(magicEntry.secondaryKeywords).toEqual(['elf']);
      expect(magicEntry.priority).toBe(10);
      expect(magicEntry.content).toBe('Magic in this world draws from nature. Elves are naturally gifted.');
      expect(magicEntry.mode).toBe('normal');
      expect(magicEntry.constant).toBe(false);
      expect(magicEntry.activationPercent).toBe(80);
      expect(magicEntry.caseSensitive).toBe(false);
      expect(magicEntry.folderName).toBe('worldbuilding');
      expect(magicEntry.id).toBeTruthy();
      expect(magicEntry.enabled).toBe(true);
      expect(magicEntry.scanDepth).toBe(5);
      expect(magicEntry.scope).toBe('global');
      expect(magicEntry.position).toBe('before_char');
    });

    it('maps lorebook constant entry', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      const forestEntry = card.lorebook[1];
      expect(forestEntry.name).toBe('Forest Lore');
      expect(forestEntry.constant).toBe(true);
      expect(forestEntry.mode).toBe('constant');
    });

    it('maps customscript to regexScripts', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.regexScripts).toHaveLength(1);
      const script = card.regexScripts[0];
      expect(script.name).toBe('Replace {{user}}');
      expect(script.pattern).toBe('{{user}}');
      expect(script.replacement).toBe('Traveler');
      expect(script.stage).toBe('modify_input');
      expect(script.flag).toBe('g');
      expect(script.enabled).toBe(true);
      expect(script.id).toBeTruthy();
    });

    it('maps triggerscript to triggers', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.triggers).toHaveLength(1);
      const trigger = card.triggers[0];
      expect(trigger.name).toBe('On magic use');
      expect(trigger.script).toContain('injectLore');
      expect(trigger.enabled).toBe(true);
      expect(trigger.id).toBeTruthy();
    });

    it('preserves unknown fields in metadata', () => {
      const card = risuaiFormat.parse(toBuffer(risuCard));

      expect(card.metadata.bias).toBe('some bias data');
      expect(card.metadata.sdData).toEqual({ model: 'stable-diffusion' });
      expect(card.metadata.newGenData).toEqual({ preset: 'fantasy' });
      expect(card.metadata.risuExtensions).toEqual({ somePlugin: { enabled: true } });
    });

    it('fills defaults for missing fields', () => {
      const minimal = { name: 'Bob', desc: 'Simple character' };
      const card = risuaiFormat.parse(toBuffer(minimal));

      expect(card.name).toBe('Bob');
      expect(card.description).toBe('Simple character');
      expect(card.alternateGreetings).toEqual([]);
      expect(card.lorebook).toEqual([]);
      expect(card.regexScripts).toEqual([]);
      expect(card.triggers).toEqual([]);
      // Internal roundtrip metadata is always present
      expect(card.metadata._risuRawLore).toEqual([]);
      expect(card.metadata._risuRawScripts).toEqual([]);
      expect(card.metadata._risuRawTriggers).toEqual([]);
    });
  });

  describe('export', () => {
    it('exports CharacterCard to RisuAI JSON format', () => {
      const parsed = risuaiFormat.parse(toBuffer(risuCard));
      const exported = toJson(risuaiFormat.export(parsed)) as Record<string, unknown>;

      expect(exported.name).toBe('Alice');
      expect(exported.desc).toBe('A friendly elf from the forest');
      expect(exported.exampleMessage).toBe(risuCard.exampleMessage);
      expect(exported.firstMessage).toBe(risuCard.firstMessage);
    });
  });

  describe('lossless roundtrip', () => {
    it('import → export preserves all RisuAI fields', () => {
      const original = risuCard;
      const imported = risuaiFormat.parse(toBuffer(original));
      const exported = toJson(risuaiFormat.export(imported)) as Record<string, unknown>;

      expect(exported.name).toBe(original.name);
      expect(exported.desc).toBe(original.desc);
      expect(exported.bias).toBe(original.bias);
      expect(exported.sdData).toEqual(original.sdData);
      expect(exported.newGenData).toEqual(original.newGenData);
      expect(exported.extentions).toEqual(original.extentions);
      expect(exported.backgroundHTML).toBe(original.backgroundHTML);
      expect(exported.backgroundCSS).toBe(original.backgroundCSS);
      expect(exported.virtualscript).toBe(original.virtualscript);
      expect(exported.scriptstate).toEqual(original.scriptstate);
      expect(exported.emotionImages).toEqual(original.emotionImages);
      expect(exported.additionalAssets).toEqual(original.additionalAssets);

      const exportedLore = exported.globalLore as Record<string, unknown>[];
      expect(exportedLore).toHaveLength(2);
      expect(exportedLore[0].comment).toBe('Magic System');
      expect(exportedLore[0].key).toBe('magic, spell, enchantment');
      expect(exportedLore[0].insertorder).toBe(10);
      expect(exportedLore[0].content).toBe('Magic in this world draws from nature. Elves are naturally gifted.');
      expect(exportedLore[0].extentions).toEqual({ risu_case_sensitive: false });

      const exportedScripts = exported.customscript as Record<string, unknown>[];
      expect(exportedScripts).toHaveLength(1);
      expect(exportedScripts[0].scriptName).toBe('Replace {{user}}');
      expect(exportedScripts[0].findRegex).toBe('{{user}}');
      expect(exportedScripts[0].placeHolder).toBe('sl000');

      const exportedTriggers = exported.triggerscript as Record<string, unknown>[];
      expect(exportedTriggers).toHaveLength(1);
      expect(exportedTriggers[0].name).toBe('On magic use');
    });
  });
});
