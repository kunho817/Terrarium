# Card Formats + Prompt Builder — Implementation Plan 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement built-in card format plugins (Generic JSON, RisuAI, SillyTavern) for import/export and a default prompt builder plugin for assembling system prompts and message context.

**Architecture:** Three `CardFormatPlugin` implementations handle parsing/exporting character cards. RisuAI is the priority format with lossless roundtrip via `metadata` preservation. SillyTavern V2 JSON is also supported. A `PromptBuilderPlugin` assembles prompts using card fields and template substitution (`{{char}}`, `{{user}}`, `{{scene.*}}`).

**Tech Stack:** TypeScript, Vitest, native TextEncoder/TextDecoder for ArrayBuffer ↔ JSON conversion

---

## Prerequisites

- Plan 1 completed (types + PluginRegistry)
- Plan 2 completed (storage + stores)
- Plan 3 completed (AI providers)
- Working directory: `D:/Project/TextChatbot`

---

## File Structure (created by this plan)

```
D:/Project/TextChatbot/
├── src/lib/plugins/card-formats/
│   ├── generic-json.ts                [NEW] Generic JSON card format
│   ├── risuai.ts                      [NEW] RisuAI card format (lossless roundtrip)
│   ├── sillytavern.ts                 [NEW] SillyTavern V2 card format
│   └── builtin.ts                     [NEW] Register all built-in card formats
├── src/lib/plugins/prompt-builder/
│   ├── default.ts                     [NEW] Default prompt builder
│   └── builtin.ts                     [NEW] Register built-in prompt builder
├── tests/plugins/card-formats/
│   ├── generic-json.test.ts           [NEW]
│   ├── risuai.test.ts                 [NEW]
│   ├── sillytavern.test.ts            [NEW]
│   └── builtin.test.ts               [NEW]
├── tests/plugins/prompt-builder/
│   ├── default.test.ts                [NEW]
│   └── builtin.test.ts               [NEW]
```

**Key type references (already exist, do NOT modify):**
- `CardFormatPlugin` — `src/lib/types/plugin.ts:34-42`
- `PromptBuilderPlugin` — `src/lib/types/plugin.ts:79-87`
- `CharacterCard` — `src/lib/types/character.ts`
- `LorebookEntry` / `LorebookSettings` — `src/lib/types/lorebook.ts`
- `RegexScript` — `src/lib/types/script.ts`
- `Trigger` — `src/lib/types/trigger.ts`
- `Message` — `src/lib/types/message.ts`
- `SceneState` — `src/lib/types/scene.ts`
- `PluginRegistry` — `src/lib/plugins/registry.ts`

**Important:** Both JSON formats (RisuAI and SillyTavern) use `.json` extension. To avoid registry conflicts, only RisuAI registers `.json` by extension. SillyTavern uses `supportedExtensions: []` and is accessed by id (`'sillytavern'`). Generic JSON uses `.tcjson`.

---

### Task 1: Generic JSON Card Format (TDD)

**Files:**
- Create: `src/lib/plugins/card-formats/generic-json.ts`
- Create: `tests/plugins/card-formats/generic-json.test.ts`

- [ ] **Step 1: Write failing tests for Generic JSON format**

Write `tests/plugins/card-formats/generic-json.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/generic-json.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement Generic JSON card format**

Write `src/lib/plugins/card-formats/generic-json.ts`:
```typescript
/**
 * Generic JSON card format — direct serialization of CharacterCard.
 * Uses .tcjson extension to avoid conflicts with other JSON formats.
 */

import type { CardFormatPlugin } from '$lib/types/plugin';
import type { CharacterCard } from '$lib/types';

const REQUIRED_FIELDS: (keyof CharacterCard)[] = [
  'name',
  'description',
  'personality',
  'scenario',
  'firstMessage',
];

const DEFAULTS: Partial<CharacterCard> = {
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

export const genericJsonFormat: CardFormatPlugin = {
  id: 'generic-json',
  name: 'Generic JSON',
  supportedExtensions: ['.tcjson'],

  validate(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return false;
      return REQUIRED_FIELDS.every((field) => field in parsed);
    } catch {
      return false;
    }
  },

  parse(data: ArrayBuffer): CharacterCard {
    const text = new TextDecoder().decode(data);
    const raw = JSON.parse(text) as Partial<CharacterCard>;
    return { ...DEFAULTS, ...raw } as CharacterCard;
  },

  export(card: CharacterCard): ArrayBuffer {
    const json = JSON.stringify(card, null, 2);
    return new TextEncoder().encode(json).buffer;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/generic-json.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/card-formats/generic-json.ts tests/plugins/card-formats/generic-json.test.ts
git commit -m "feat: add Generic JSON card format plugin"
```

---

### Task 2: RisuAI Card Format Plugin (TDD)

**Files:**
- Create: `src/lib/plugins/card-formats/risuai.ts`
- Create: `tests/plugins/card-formats/risuai.test.ts`

**Spec reference:** Section 9 — RisuAI Card Compatibility (field mapping tables in 9.1, 9.2, 9.3)

- [ ] **Step 1: Write failing tests for RisuAI format**

Write `tests/plugins/card-formats/risuai.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { risuaiFormat } from '$lib/plugins/card-formats/risuai';
import type { CharacterCard } from '$lib/types';

function toBuffer(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function toJson(buffer: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(buffer));
}

// Full RisuAI card with all mapped fields
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

      // First entry
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
      expect(card.metadata).toEqual({});
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

      // All original fields should be present
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

      // Lorebook roundtrip
      const exportedLore = exported.globalLore as Record<string, unknown>[];
      expect(exportedLore).toHaveLength(2);
      expect(exportedLore[0].comment).toBe('Magic System');
      expect(exportedLore[0].key).toBe('magic, spell, enchantment');
      expect(exportedLore[0].insertorder).toBe(10);
      expect(exportedLore[0].content).toBe('Magic in this world draws from nature. Elves are naturally gifted.');
      expect(exportedLore[0].extentions).toEqual({ risu_case_sensitive: false });

      // Script roundtrip
      const exportedScripts = exported.customscript as Record<string, unknown>[];
      expect(exportedScripts).toHaveLength(1);
      expect(exportedScripts[0].scriptName).toBe('Replace {{user}}');
      expect(exportedScripts[0].findRegex).toBe('{{user}}');
      expect(exportedScripts[0].placeHolder).toBe('sl000');

      // Trigger roundtrip
      const exportedTriggers = exported.triggerscript as Record<string, unknown>[];
      expect(exportedTriggers).toHaveLength(1);
      expect(exportedTriggers[0].name).toBe('On magic use');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/risuai.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement RisuAI card format plugin**

Write `src/lib/plugins/card-formats/risuai.ts`:
```typescript
/**
 * RisuAI card format plugin — lossless roundtrip import/export.
 * Spec reference: Section 9 — RisuAI Card Compatibility
 */

import type { CardFormatPlugin } from '$lib/types/plugin';
import type {
  CharacterCard,
  LorebookEntry,
  LorebookSettings,
  LorebookMode,
  RegexScript,
  RegexStage,
  Trigger,
} from '$lib/types';

// === Raw format interfaces (internal) ===

interface RisuLoreEntry {
  key: string;
  secondkey?: string;
  insertorder: number;
  comment: string;
  content: string;
  mode: LorebookMode;
  alwaysActive: boolean;
  selective: boolean;
  activationPercent?: number;
  extententions?: Record<string, unknown>;
  useRegex?: boolean;
  folder?: string;
  [key: string]: unknown;
}

interface RisuRegexScript {
  scriptName: string;
  findRegex: string;
  replaceString: string;
  placeHolder: string;
  trimString: boolean;
  onlyFirst: boolean;
  [key: string]: unknown;
}

interface RisuTrigger {
  name?: string;
  conditions?: Array<{ type: string; value: string }>;
  script?: string;
  [key: string]: unknown;
}

const RISU_STAGE_MAP: Record<string, RegexStage> = {
  sl000: 'modify_input',
  sl001: 'modify_output',
  sl002: 'modify_request',
  sl003: 'modify_display',
};

const STAGE_TO_RISU: Record<RegexStage, string> = {
  modify_input: 'sl000',
  modify_output: 'sl001',
  modify_request: 'sl002',
  modify_display: 'sl003',
};

const DEFAULT_LORE_SETTINGS: LorebookSettings = {
  tokenBudget: 2048,
  scanDepth: 5,
  recursiveScanning: false,
  fullWordMatching: false,
};

// === Lorebook mapping ===

function parseRisuLore(entries: RisuLoreEntry[], defaultScanDepth: number): LorebookEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: crypto.randomUUID(),
    name: entry.comment || '',
    keywords: typeof entry.key === 'string' ? entry.key.split(',').map((k) => k.trim()).filter(Boolean) : [],
    secondaryKeywords: entry.secondkey
      ? entry.secondkey.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined,
    caseSensitive: (entry.extententions as Record<string, unknown>)?.risu_case_sensitive === true,
    content: entry.content || '',
    position: 'before_char' as const,
    priority: entry.insertorder ?? 0,
    enabled: true,
    scanDepth: defaultScanDepth,
    scope: 'global' as const,
    activationPercent: entry.activationPercent,
    mode: entry.mode || 'normal',
    constant: !!entry.alwaysActive,
    folderName: entry.folder || undefined,
  }));
}

function exportRisuLore(entries: LorebookEntry[]): RisuLoreEntry[] {
  return entries.map((entry) => {
    const result: RisuLoreEntry = {
      key: entry.keywords.join(', '),
      secondkey: entry.secondaryKeywords?.join(', ') || '',
      insertorder: entry.priority,
      comment: entry.name,
      content: entry.content,
      mode: entry.mode,
      alwaysActive: entry.constant,
      selective: entry.mode === 'selective',
      activationPercent: entry.activationPercent,
      extententions: {
        ...(entry.caseSensitive ? { risu_case_sensitive: true } : {}),
      },
      folder: entry.folderName || '',
    };
    return result;
  });
}

// === Regex script mapping ===

function parseRisuScripts(scripts: RisuRegexScript[]): RegexScript[] {
  if (!Array.isArray(scripts)) return [];
  return scripts.map((s) => ({
    id: crypto.randomUUID(),
    name: s.scriptName || '',
    pattern: s.findRegex || '',
    replacement: s.replaceString || '',
    stage: RISU_STAGE_MAP[s.placeHolder] || 'modify_input',
    enabled: true,
    flag: s.onlyFirst ? '' : 'g',
  }));
}

function exportRisuScripts(scripts: RegexScript[], rawScripts: RisuRegexScript[]): RisuRegexScript[] {
  return scripts.map((s, i) => {
    const raw = rawScripts?.[i] || {};
    return {
      ...raw,
      scriptName: s.name,
      findRegex: s.pattern,
      replaceString: s.replacement,
      placeHolder: STAGE_TO_RISU[s.stage] || 'sl000',
      trimString: (raw as RisuRegexScript).trimString ?? false,
      onlyFirst: s.flag !== 'g',
    };
  });
}

// === Trigger mapping ===

function parseRisuTriggers(triggers: RisuTrigger[]): Trigger[] {
  if (!Array.isArray(triggers)) return [];
  return triggers.map((t) => ({
    id: crypto.randomUUID(),
    name: t.name || '',
    enabled: true,
    event: 'on_manual' as const,
    script: t.script || '',
  }));
}

function exportRisuTriggers(triggers: Trigger[], rawTriggers: RisuTrigger[]): RisuTrigger[] {
  return triggers.map((t, i) => {
    const raw = rawTriggers?.[i] || {};
    return {
      ...raw,
      name: t.name,
      script: t.script,
    };
  });
}

// === Plugin ===

export const risuaiFormat: CardFormatPlugin = {
  id: 'risuai',
  name: 'RisuAI',
  supportedExtensions: ['.json'],

  validate(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return false;
      // RisuAI cards have "desc" field (our format uses "description")
      // SillyTavern V2 has "spec" field — exclude those
      if (parsed.spec === 'chara_card_v2') return false;
      return 'name' in parsed && 'desc' in parsed;
    } catch {
      return false;
    }
  },

  parse(data: ArrayBuffer): CharacterCard {
    const text = new TextDecoder().decode(data);
    const raw = JSON.parse(text) as Record<string, unknown>;

    // Extract known fields, put the rest in metadata
    const knownKeys = new Set([
      'name', 'desc', 'personality', 'scenario', 'firstMessage',
      'alternateGreetings', 'exampleMessage', 'systemPrompt',
      'postHistoryInstructions', 'creatorNotes', 'tags', 'creator',
      'characterVersion', 'backgroundHTML', 'backgroundCSS',
      'virtualscript', 'scriptstate', 'emotionImages',
      'additionalAssets', 'bias', 'depth_prompt', 'globalLore',
      'customscript', 'triggerscript', 'sdData', 'newGenData',
      'extentions',
    ]);

    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!knownKeys.has(key)) {
        metadata[key] = value;
      }
    }

    // Preserve RisuAI-specific fields in metadata
    if (raw.bias !== undefined) metadata.bias = raw.bias;
    if (raw.sdData !== undefined) metadata.sdData = raw.sdData;
    if (raw.newGenData !== undefined) metadata.newGenData = raw.newGenData;
    if (raw.extentions !== undefined) metadata.risuExtensions = raw.extentions;

    // Store raw nested arrays for lossless roundtrip
    metadata._risuRawLore = raw.globalLore || [];
    metadata._risuRawScripts = raw.customscript || [];
    metadata._risuRawTriggers = raw.triggerscript || [];

    const scanDepth = DEFAULT_LORE_SETTINGS.scanDepth;

    return {
      name: (raw.name as string) || '',
      description: (raw.desc as string) || '',
      personality: (raw.personality as string) || '',
      scenario: (raw.scenario as string) || '',
      firstMessage: (raw.firstMessage as string) || '',
      alternateGreetings: Array.isArray(raw.alternateGreetings)
        ? raw.alternateGreetings as string[]
        : [],
      exampleMessages: (raw.exampleMessage as string) || '',
      systemPrompt: (raw.systemPrompt as string) || '',
      postHistoryInstructions: (raw.postHistoryInstructions as string) || '',
      depthPrompt: raw.depth_prompt as { depth: number; prompt: string } | undefined,
      creator: (raw.creator as string) || '',
      characterVersion: (raw.characterVersion as string) || '1.0',
      tags: Array.isArray(raw.tags) ? raw.tags as string[] : [],
      creatorNotes: (raw.creatorNotes as string) || '',
      backgroundHTML: raw.backgroundHTML as string | undefined,
      backgroundCSS: raw.backgroundCSS as string | undefined,
      virtualScript: raw.virtualscript as string | undefined,
      scriptState: (raw.scriptstate as Record<string, string | number | boolean>) || {},
      emotionImages: Array.isArray(raw.emotionImages) ? raw.emotionImages as [string, string][] : [],
      additionalAssets: Array.isArray(raw.additionalAssets) ? raw.additionalAssets as [string, string, string][] : [],
      lorebook: parseRisuLore(raw.globalLore as RisuLoreEntry[], scanDepth),
      loreSettings: DEFAULT_LORE_SETTINGS,
      regexScripts: parseRisuScripts(raw.customscript as RisuRegexScript[]),
      triggers: parseRisuTriggers(raw.triggerscript as RisuTrigger[]),
      metadata,
    };
  },

  export(card: CharacterCard): ArrayBuffer {
    const rawLore = (card.metadata._risuRawLore as RisuLoreEntry[]) || [];
    const rawScripts = (card.metadata._risuRawScripts as RisuRegexScript[]) || [];
    const rawTriggers = (card.metadata._risuRawTriggers as RisuTrigger[]) || [];

    // Start with preserved extras
    const result: Record<string, unknown> = {};

    // Copy unknown metadata keys (excluding our internal keys)
    const internalKeys = new Set([
      'bias', 'sdData', 'newGenData', 'risuExtensions',
      '_risuRawLore', '_risuRawScripts', '_risuRawTriggers',
    ]);
    for (const [key, value] of Object.entries(card.metadata)) {
      if (!internalKeys.has(key)) {
        result[key] = value;
      }
    }

    // Map known fields to RisuAI format
    result.name = card.name;
    result.desc = card.description;
    result.personality = card.personality;
    result.scenario = card.scenario;
    result.firstMessage = card.firstMessage;
    result.alternateGreetings = card.alternateGreetings;
    result.exampleMessage = card.exampleMessages;
    result.systemPrompt = card.systemPrompt;
    result.postHistoryInstructions = card.postHistoryInstructions;
    result.creatorNotes = card.creatorNotes;
    result.tags = card.tags;
    result.creator = card.creator;
    result.characterVersion = card.characterVersion;
    result.backgroundHTML = card.backgroundHTML || '';
    result.backgroundCSS = card.backgroundCSS || '';
    result.virtualscript = card.virtualScript || '';
    result.scriptstate = card.scriptState;
    result.emotionImages = card.emotionImages;
    result.additionalAssets = card.additionalAssets;
    result.depth_prompt = card.depthPrompt || { depth: 4, prompt: '' };

    // Lorebook — use raw entries as base, update mapped fields
    result.globalLore = card.lorebook.length > 0
      ? exportRisuLore(card.lorebook)
      : rawLore;

    // Scripts — use raw entries as base if available
    result.customscript = card.regexScripts.length > 0
      ? exportRisuScripts(card.regexScripts, rawScripts)
      : rawScripts;

    // Triggers — use raw entries as base if available
    result.triggerscript = card.triggers.length > 0
      ? exportRisuTriggers(card.triggers, rawTriggers)
      : rawTriggers;

    // Preserved RisuAI-specific fields
    if (card.metadata.bias !== undefined) result.bias = card.metadata.bias;
    if (card.metadata.sdData !== undefined) result.sdData = card.metadata.sdData;
    if (card.metadata.newGenData !== undefined) result.newGenData = card.metadata.newGenData;
    if (card.metadata.risuExtensions !== undefined) result.extentions = card.metadata.risuExtensions;

    const json = JSON.stringify(result, null, 2);
    return new TextEncoder().encode(json).buffer;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/risuai.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/card-formats/risuai.ts tests/plugins/card-formats/risuai.test.ts
git commit -m "feat: add RisuAI card format plugin with lossless roundtrip"
```

---

### Task 3: SillyTavern Card Format Plugin (TDD)

**Files:**
- Create: `src/lib/plugins/card-formats/sillytavern.ts`
- Create: `tests/plugins/card-formats/sillytavern.test.ts`

**Spec reference:** Section 3.2 — CardFormatPlugin, Section 9.1 — mapping table

- [ ] **Step 1: Write failing tests for SillyTavern format**

Write `tests/plugins/card-formats/sillytavern.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sillytavernFormat } from '$lib/plugins/card-formats/sillytavern';
import type { CharacterCard } from '$lib/types';

function toBuffer(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function toJson(buffer: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(buffer));
}

// Full SillyTavern V2 card
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
      // Preserved extensions
      expect(data.extensions).toEqual({ talkativeness: '0.5' });

      // Lorebook roundtrip
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/sillytavern.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement SillyTavern card format plugin**

Write `src/lib/plugins/card-formats/sillytavern.ts`:
```typescript
/**
 * SillyTavern V2 card format plugin.
 * Handles the chara_card_v2 spec JSON format.
 */

import type { CardFormatPlugin } from '$lib/types/plugin';
import type {
  CharacterCard,
  LorebookEntry,
  LorebookSettings,
  LorebookPosition,
} from '$lib/types';

// === Raw format interfaces (internal) ===

interface STLoreEntry {
  keys: string[];
  secondary_keys?: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  enabled: boolean;
  position: string;
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

interface STCharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: STLoreEntry[];
}

interface STRawCard {
  spec?: string;
  spec_version?: string;
  data: {
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, unknown>;
    character_book?: STCharacterBook;
    [key: string]: unknown;
  };
}

// === Lorebook mapping ===

function parseSTLore(entries: STLoreEntry[], defaultScanDepth: number): LorebookEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: crypto.randomUUID(),
    name: entry.comment || '',
    keywords: Array.isArray(entry.keys) ? entry.keys : [],
    secondaryKeywords: Array.isArray(entry.secondary_keys) && entry.secondary_keys.length > 0
      ? entry.secondary_keys
      : undefined,
    caseSensitive: false,
    content: entry.content || '',
    position: (entry.position || 'before_char') as LorebookPosition,
    priority: entry.insertion_order ?? 0,
    enabled: entry.enabled !== false,
    scanDepth: defaultScanDepth,
    scope: 'global' as const,
    mode: entry.constant ? 'constant' : entry.selective ? 'selective' : 'normal',
    constant: !!entry.constant,
  }));
}

function exportSTLore(entries: LorebookEntry[], rawEntries: STLoreEntry[]): STLoreEntry[] {
  return entries.map((entry, i) => {
    const raw = rawEntries?.[i] || {};
    return {
      ...raw,
      keys: entry.keywords,
      secondary_keys: entry.secondaryKeywords || [],
      comment: entry.name,
      content: entry.content,
      constant: entry.constant,
      selective: entry.mode === 'selective',
      insertion_order: entry.priority,
      enabled: entry.enabled,
      position: entry.position,
    };
  });
}

// === Plugin ===

const DEFAULT_LORE_SETTINGS: LorebookSettings = {
  tokenBudget: 2048,
  scanDepth: 5,
  recursiveScanning: false,
  fullWordMatching: false,
};

export const sillytavernFormat: CardFormatPlugin = {
  id: 'sillytavern',
  name: 'SillyTavern',
  supportedExtensions: [],

  validate(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return false;
      return parsed.spec === 'chara_card_v2' || parsed.spec_version === '2.0';
    } catch {
      return false;
    }
  },

  parse(data: ArrayBuffer): CharacterCard {
    const text = new TextDecoder().decode(data);
    const raw = JSON.parse(text) as STRawCard;
    const d = raw.data;

    const book = d.character_book;
    const loreSettings: LorebookSettings = {
      tokenBudget: book?.token_budget ?? DEFAULT_LORE_SETTINGS.tokenBudget,
      scanDepth: book?.scan_depth ?? DEFAULT_LORE_SETTINGS.scanDepth,
      recursiveScanning: book?.recursive_scanning ?? DEFAULT_LORE_SETTINGS.recursiveScanning,
      fullWordMatching: DEFAULT_LORE_SETTINGS.fullWordMatching,
    };

    // Store raw card for lossless roundtrip
    const metadata: Record<string, unknown> = {
      _stRawCard: JSON.parse(JSON.stringify(raw)),
    };
    if (d.extensions) metadata.stExtensions = d.extensions;

    return {
      name: d.name || '',
      description: d.description || '',
      personality: d.personality || '',
      scenario: d.scenario || '',
      firstMessage: d.first_mes || '',
      alternateGreetings: d.alternate_greetings || [],
      exampleMessages: d.mes_example || '',
      systemPrompt: d.system_prompt || '',
      postHistoryInstructions: d.post_history_instructions || '',
      creator: d.creator || '',
      characterVersion: d.character_version || '1.0',
      tags: d.tags || [],
      creatorNotes: d.creator_notes || '',
      lorebook: parseSTLore(book?.entries || [], loreSettings.scanDepth),
      loreSettings,
      regexScripts: [],
      triggers: [],
      scriptState: {},
      emotionImages: [],
      additionalAssets: [],
      metadata,
    };
  },

  export(card: CharacterCard): ArrayBuffer {
    const rawCard = (card.metadata._stRawCard as STRawCard) || null;
    const rawEntries = rawCard?.data?.character_book?.entries || [];

    const result: STRawCard = rawCard
      ? JSON.parse(JSON.stringify(rawCard))
      : { spec: 'chara_card_v2', spec_version: '2.0', data: {} as STRawCard['data'] };

    result.spec = 'chara_card_v2';
    result.spec_version = '2.0';

    const data = result.data;
    data.name = card.name;
    data.description = card.description;
    data.personality = card.personality;
    data.scenario = card.scenario;
    data.first_mes = card.firstMessage;
    data.mes_example = card.exampleMessages;
    data.creator_notes = card.creatorNotes;
    data.system_prompt = card.systemPrompt;
    data.post_history_instructions = card.postHistoryInstructions;
    data.alternate_greetings = card.alternateGreetings;
    data.tags = card.tags;
    data.creator = card.creator;
    data.character_version = card.characterVersion;
    data.extensions = (card.metadata.stExtensions as Record<string, unknown>) || {};

    // Character book
    if (card.lorebook.length > 0 || card.loreSettings.tokenBudget !== 2048 || card.loreSettings.scanDepth !== 5) {
      data.character_book = {
        name: rawCard?.data?.character_book?.name || '',
        description: rawCard?.data?.character_book?.description || '',
        scan_depth: card.loreSettings.scanDepth,
        token_budget: card.loreSettings.tokenBudget,
        recursive_scanning: card.loreSettings.recursiveScanning,
        extensions: rawCard?.data?.character_book?.extensions || {},
        entries: exportSTLore(card.lorebook, rawEntries),
      };
    }

    const json = JSON.stringify(result, null, 2);
    return new TextEncoder().encode(json).buffer;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/sillytavern.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/card-formats/sillytavern.ts tests/plugins/card-formats/sillytavern.test.ts
git commit -m "feat: add SillyTavern V2 card format plugin with lossless roundtrip"
```

---

### Task 4: Built-in Card Format Registration (TDD)

**Files:**
- Create: `src/lib/plugins/card-formats/builtin.ts`
- Create: `tests/plugins/card-formats/builtin.test.ts`

- [ ] **Step 1: Write failing tests for builtin registration**

Write `tests/plugins/card-formats/builtin.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { registerBuiltinCardFormats } from '$lib/plugins/card-formats/builtin';
import { PluginRegistry } from '$lib/plugins/registry';

describe('registerBuiltinCardFormats', () => {
  it('registers all 3 built-in card formats', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const formats = registry.listCardFormats();
    expect(formats).toHaveLength(3);

    const ids = formats.map((f) => f.id).sort();
    expect(ids).toEqual(['generic-json', 'risuai', 'sillytavern']);
  });

  it('registers risuai with .json extension', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const byExt = registry.getCardFormat('.json');
    expect(byExt.id).toBe('risuai');
  });

  it('registers generic-json with .tcjson extension', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const byExt = registry.getCardFormat('.tcjson');
    expect(byExt.id).toBe('generic-json');
  });

  it('retrieves sillytavern by id', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const st = registry.getCardFormat('sillytavern');
    expect(st.name).toBe('SillyTavern');
  });

  it('throws on duplicate registration', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    expect(() => registerBuiltinCardFormats(registry)).toThrow('already registered');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/builtin.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement built-in card format registration**

Write `src/lib/plugins/card-formats/builtin.ts`:
```typescript
/**
 * Registers all built-in card format plugins with a PluginRegistry.
 */

import type { PluginRegistry } from '$lib/plugins/registry';
import { genericJsonFormat } from './generic-json';
import { risuaiFormat } from './risuai';
import { sillytavernFormat } from './sillytavern';

export function registerBuiltinCardFormats(registry: PluginRegistry): void {
  registry.registerCardFormat(risuaiFormat);
  registry.registerCardFormat(sillytavernFormat);
  registry.registerCardFormat(genericJsonFormat);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/card-formats/builtin.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/card-formats/builtin.ts tests/plugins/card-formats/builtin.test.ts
git commit -m "feat: add built-in card format registration (RisuAI, SillyTavern, Generic JSON)"
```

---

### Task 5: Default Prompt Builder Plugin (TDD)

**Files:**
- Create: `src/lib/plugins/prompt-builder/default.ts`
- Create: `src/lib/plugins/prompt-builder/builtin.ts`
- Create: `tests/plugins/prompt-builder/default.test.ts`
- Create: `tests/plugins/prompt-builder/builtin.test.ts`

**Spec reference:** Section 3.5 — PromptBuilderPlugin

- [ ] **Step 1: Write failing tests for default prompt builder**

Write `tests/plugins/prompt-builder/default.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { defaultPromptBuilder } from '$lib/plugins/prompt-builder/default';
import type { CharacterCard, SceneState, Message } from '$lib/types';

const mockCard: CharacterCard = {
  name: 'Alice',
  description: 'A friendly elf from the forest',
  personality: 'Cheerful, curious',
  scenario: 'Alice is visiting the human village.',
  firstMessage: 'Hi there!',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

const mockScene: SceneState = {
  location: 'Forest Village',
  time: 'Dusk',
  mood: 'Peaceful',
  participatingCharacters: ['alice-id'],
  variables: {},
};

const mockMessages: Message[] = [
  { role: 'user', content: 'Hello Alice', type: 'dialogue', timestamp: 1000 },
  { role: 'assistant', content: 'Hi! Welcome to the village!', type: 'dialogue', timestamp: 2000 },
  { role: 'narrator', content: 'The sun began to set.', type: 'narrator', timestamp: 3000 },
];

describe('Default Prompt Builder', () => {
  describe('properties', () => {
    it('has correct id and name', () => {
      expect(defaultPromptBuilder.id).toBe('default');
      expect(defaultPromptBuilder.name).toBe('Default');
    });
  });

  describe('buildSystemPrompt', () => {
    it('builds system prompt from card fields when no custom systemPrompt', () => {
      const prompt = defaultPromptBuilder.buildSystemPrompt(mockCard, mockScene);

      expect(prompt).toContain('Alice');
      expect(prompt).toContain('A friendly elf from the forest');
      expect(prompt).toContain('Cheerful, curious');
      expect(prompt).toContain('Alice is visiting the human village.');
    });

    it('includes scene state in system prompt', () => {
      const prompt = defaultPromptBuilder.buildSystemPrompt(mockCard, mockScene);

      expect(prompt).toContain('Forest Village');
      expect(prompt).toContain('Dusk');
      expect(prompt).toContain('Peaceful');
    });

    it('uses custom systemPrompt when set', () => {
      const card = { ...mockCard, systemPrompt: 'You are {{char}}, a brave warrior.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);

      expect(prompt).toBe('You are Alice, a brave warrior.');
    });

    it('substitutes {{char}} template variable', () => {
      const card = { ...mockCard, systemPrompt: '{{char}} is here.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Alice is here.');
    });

    it('substitutes {{user}} template variable', () => {
      const card = { ...mockCard, systemPrompt: 'Talk to {{user}}.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Talk to User.');
    });

    it('substitutes {{char.name}} template variable', () => {
      const card = { ...mockCard, systemPrompt: '{{char.name}} approaches.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Alice approaches.');
    });

    it('substitutes scene template variables', () => {
      const card = {
        ...mockCard,
        systemPrompt: 'Location: {{scene.location}}, Time: {{scene.time}}, Mood: {{scene.mood}}.',
      };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Location: Forest Village, Time: Dusk, Mood: Peaceful.');
    });

    it('handles empty scene gracefully', () => {
      const emptyScene: SceneState = {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
      };
      const prompt = defaultPromptBuilder.buildSystemPrompt(mockCard, emptyScene);

      expect(prompt).toContain('Alice');
      // Scene section should not be included when empty
      expect(prompt).not.toContain('Current location:');
    });
  });

  describe('buildContext', () => {
    it('formats messages with role labels', () => {
      const context = defaultPromptBuilder.buildContext(mockMessages, mockScene);

      expect(context).toContain('User: Hello Alice');
      expect(context).toContain('Alice: Hi! Welcome to the village!');
    });

    it('formats narrator messages with italics', () => {
      const context = defaultPromptBuilder.buildContext(mockMessages, mockScene);
      expect(context).toContain('*The sun began to set.*');
    });

    it('includes scene info at the top when present', () => {
      const context = defaultPromptBuilder.buildContext(mockMessages, mockScene);
      expect(context).toContain('[Scene: Forest Village, Dusk, Peaceful]');
    });

    it('omits scene info when empty', () => {
      const emptyScene: SceneState = {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
      };
      const context = defaultPromptBuilder.buildContext(mockMessages, emptyScene);
      expect(context).not.toContain('[Scene:');
    });

    it('handles empty messages', () => {
      const context = defaultPromptBuilder.buildContext([], mockScene);
      expect(context).toContain('[Scene:');
    });

    it('substitutes template variables in message content', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello {{char}}', type: 'dialogue', timestamp: 1000 },
      ];
      const context = defaultPromptBuilder.buildContext(messages, mockScene);
      expect(context).toContain('Hello Alice');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/prompt-builder/default.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement default prompt builder**

Write `src/lib/plugins/prompt-builder/default.ts`:
```typescript
/**
 * Default prompt builder plugin.
 * Assembles system prompts and message context using card fields and template substitution.
 * Spec reference: Section 3.5 — PromptBuilderPlugin
 */

import type { PromptBuilderPlugin } from '$lib/types/plugin';
import type { CharacterCard, Message, SceneState } from '$lib/types';

function substituteTemplates(text: string, card: CharacterCard, scene: SceneState): string {
  return text
    .replace(/\{\{char\.name\}\}/g, card.name)
    .replace(/\{\{char\}\}/g, card.name)
    .replace(/\{\{user\}\}/g, 'User')
    .replace(/\{\{scene\.location\}\}/g, scene.location || '')
    .replace(/\{\{scene\.time\}\}/g, scene.time || '')
    .replace(/\{\{scene\.mood\}\}/g, scene.mood || '');
}

export const defaultPromptBuilder: PromptBuilderPlugin = {
  id: 'default',
  name: 'Default',

  buildSystemPrompt(card: CharacterCard, scene: SceneState): string {
    if (card.systemPrompt) {
      return substituteTemplates(card.systemPrompt, card, scene);
    }

    const parts: string[] = [];
    parts.push(`You are ${card.name}.`);
    if (card.description) parts.push(card.description);
    if (card.personality) parts.push(`Personality: ${card.personality}`);
    if (card.scenario) parts.push(`Scenario: ${card.scenario}`);

    if (scene.location || scene.time || scene.mood) {
      const sceneParts: string[] = [];
      if (scene.location) sceneParts.push(`Current location: ${scene.location}`);
      if (scene.time) sceneParts.push(`Time: ${scene.time}`);
      if (scene.mood) sceneParts.push(`Mood: ${scene.mood}`);
      parts.push(sceneParts.join('. ') + '.');
    }

    return substituteTemplates(parts.join('\n\n'), card, scene);
  },

  buildContext(messages: Message[], scene: SceneState): string {
    const parts: string[] = [];

    if (scene.location || scene.time || scene.mood) {
      parts.push(`[Scene: ${[scene.location, scene.time, scene.mood].filter(Boolean).join(', ')}]`);
    }

    for (const msg of messages) {
      const content = substituteTemplates(msg.content, { name: '' } as CharacterCard, scene);
      switch (msg.type) {
        case 'dialogue': {
          const label = msg.role === 'user' ? 'User' : 'Assistant';
          parts.push(`${label}: ${content}`);
          break;
        }
        case 'narrator':
          parts.push(`*${content}*`);
          break;
        case 'action':
          parts.push(`*${content}*`);
          break;
        case 'system':
          parts.push(`[System: ${content}]`);
          break;
      }
    }

    return parts.join('\n\n');
  },
};
```

- [ ] **Step 4: Write and run tests for prompt builder builtin registration**

Write `tests/plugins/prompt-builder/builtin.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { registerBuiltinPromptBuilders } from '$lib/plugins/prompt-builder/builtin';
import { PluginRegistry } from '$lib/plugins/registry';

describe('registerBuiltinPromptBuilders', () => {
  it('registers default prompt builder', () => {
    const registry = new PluginRegistry();
    registerBuiltinPromptBuilders(registry);

    const builders = registry.listPromptBuilders();
    expect(builders).toHaveLength(1);
    expect(builders[0].id).toBe('default');
  });

  it('can be retrieved by id', () => {
    const registry = new PluginRegistry();
    registerBuiltinPromptBuilders(registry);

    const builder = registry.getPromptBuilder('default');
    expect(builder.name).toBe('Default');
  });

  it('throws on duplicate registration', () => {
    const registry = new PluginRegistry();
    registerBuiltinPromptBuilders(registry);

    expect(() => registerBuiltinPromptBuilders(registry)).toThrow('already registered');
  });
});
```

Write `src/lib/plugins/prompt-builder/builtin.ts`:
```typescript
/**
 * Registers built-in prompt builder plugins with a PluginRegistry.
 */

import type { PluginRegistry } from '$lib/plugins/registry';
import { defaultPromptBuilder } from './default';

export function registerBuiltinPromptBuilders(registry: PluginRegistry): void {
  registry.registerPromptBuilder(defaultPromptBuilder);
}
```

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/prompt-builder/`
Expected: All prompt builder tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/prompt-builder/ tests/plugins/prompt-builder/
git commit -m "feat: add default prompt builder with template substitution"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All tests pass (including card formats and prompt builder).

- [ ] **Step 3: Run SvelteKit build**

Run: `cd "D:/Project/TextChatbot" && npm run build`
Expected: Build succeeds.

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec Section | Covered in Task | Notes |
|---|---|---|
| Section 3.2 — CardFormatPlugin interface | Tasks 1-4 | `parse`, `export`, `validate`, `supportedExtensions` |
| RisuAI card format (lossless roundtrip) | Task 2 | Field mapping per Section 9.1, lorebook per 9.2, metadata preservation per 9.3 |
| SillyTavern card format | Task 3 | V2 spec with `data` wrapper, `character_book` mapping |
| Generic JSON card format | Task 1 | Direct serialization, `.tcjson` extension |
| Section 3.5 — PromptBuilderPlugin | Task 5 | `buildSystemPrompt`, `buildContext` with template substitution |
| Section 3.6 — Plugin registration | Tasks 4-5 | `registerCardFormat`, `registerPromptBuilder` |
| Template substitution (`{{char}}`, `{{user}}`, `{{scene.*}}`) | Task 5 | `substituteTemplates` helper |
| RisuAI lorebook mapping | Task 2 | key→keywords, insertorder→priority, extententions→caseSensitive |
| RisuAI customscript mapping | Task 2 | scriptName→name, findRegex→pattern, placeHolder→stage |
| RisuAI triggerscript mapping | Task 2 | Basic mapping with raw preservation |

**2. Placeholder scan:** No TBD, TODO, or incomplete steps found. All steps contain exact code and commands.

**3. Type consistency:**
- `CardFormatPlugin` interface: `id`, `name`, `supportedExtensions`, `parse(data: ArrayBuffer): CharacterCard`, `export(card: CharacterCard): ArrayBuffer`, `validate(data: ArrayBuffer): boolean` — matches `plugin.ts:34-42`
- `PromptBuilderPlugin` interface: `id`, `name`, `buildSystemPrompt(card: CharacterCard, scene: SceneState): string`, `buildContext(messages: Message[], scene: SceneState): string` — matches `plugin.ts:79-87`
- `PluginRegistry.registerCardFormat` and `registerPromptBuilder` — matches `registry.ts` implementation
- All imported types from `$lib/types` match existing type definitions
