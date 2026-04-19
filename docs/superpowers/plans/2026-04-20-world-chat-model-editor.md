# World Chat Improvements — Sub-Project 1: World Card Model + Editor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the WorldCard data model with new types (AlternateGreeting, WorldScenario, WorldSettings, enhanced WorldCharacter) and overhaul the world editor with full character editing, improved lorebook, scripts tab, and settings tab.

**Architecture:** Type-first approach — define new types in `src/lib/types/world.ts`, update migration in `src/lib/storage/world-import.ts`, then build editor components as reusable Svelte components following existing patterns (`LorebookEditor.svelte`, `RegexEditor.svelte`). The editor page reuses these components via props/callbacks.

**Tech Stack:** Svelte 5 ($props, $state, $derived), TypeScript, Vitest for tests. No new dependencies for this sub-project.

**Spec:** `docs/superpowers/specs/2026-04-20-world-chat-improvements-design.md` (Sections 1.1 and 1.2)

---

## File Structure

### New files
- `src/lib/components/editors/WorldCharacterForm.svelte` — single character editing form (avatar, personality, example messages, lorebook links, track state toggle, tags)
- `src/lib/components/editors/GreetingList.svelte` — alternate greetings list editor (add/edit/delete/rename)
- `src/lib/components/editors/WorldSettingsEditor.svelte` — per-world settings overrides form

### Modified files
- `src/lib/types/world.ts` — add AlternateGreeting, WorldScenario, WorldSettings types; expand WorldCharacter and WorldCard
- `src/lib/types/character.ts` — change CharacterCard.alternateGreetings from string[] to AlternateGreeting[]
- `src/lib/types/index.ts` — export new types
- `src/lib/storage/world-import.ts` — migration for new fields, handle alternateGreetings format change
- `src/routes/worlds/[id]/edit/+page.svelte` — full editor overhaul using new components
- `tests/types/world-types.test.ts` — tests for new types and defaults
- `tests/storage/world-import.test.ts` — update for migration tests
- `tests/storage/worlds.test.ts` — update mock data for new fields

---

### Task 1: Define New Types and Update WorldCard Model

**Files:**
- Modify: `src/lib/types/world.ts`
- Create: `tests/types/world-types.test.ts`

- [ ] **Step 1: Write the failing test for new types**

```typescript
// tests/types/world-types.test.ts
import { describe, it, expect } from 'vitest';
import {
  createDefaultWorldCard,
  type WorldCard,
  type WorldCharacter,
  type AlternateGreeting,
  type WorldScenario,
  type WorldSettings,
} from '$lib/types';

describe('WorldCard types', () => {
  describe('createDefaultWorldCard', () => {
    it('returns a valid default WorldCard', () => {
      const card = createDefaultWorldCard();
      expect(card.name).toBe('');
      expect(card.description).toBe('');
      expect(card.scenario).toBe('');
      expect(card.firstMessage).toBe('');
      expect(card.alternateGreetings).toEqual([]);
      expect(card.scenarios).toEqual([]);
      expect(card.worldSettings).toBeUndefined();
      expect(card.lorebook).toEqual([]);
      expect(card.characters).toEqual([]);
      expect(card.regexScripts).toEqual([]);
      expect(card.triggers).toEqual([]);
    });
  });

  describe('WorldCharacter defaults', () => {
    it('has all required fields with sensible defaults', () => {
      const char: WorldCharacter = {
        id: 'test-id',
        name: 'Test',
        description: 'A test character',
        personality: '',
        exampleMessages: '',
        avatar: null,
        lorebookEntryIds: [],
        trackState: false,
        tags: [],
      };
      expect(char.trackState).toBe(false);
      expect(char.lorebookEntryIds).toEqual([]);
      expect(char.avatar).toBeNull();
    });
  });

  describe('AlternateGreeting', () => {
    it('has id, name, and content', () => {
      const greeting: AlternateGreeting = {
        id: 'g1',
        name: 'Tavern Start',
        content: 'The tavern door creaks open...',
      };
      expect(greeting.id).toBe('g1');
      expect(greeting.name).toBe('Tavern Start');
      expect(greeting.content).toContain('tavern');
    });
  });

  describe('WorldScenario', () => {
    it('has condition and actions fields', () => {
      const scenario: WorldScenario = {
        id: 's1',
        name: 'Reputation Event',
        description: 'Triggered when reputation is high',
        condition: 'get_var("reputation") > 50',
        actions: 'set_var("chapter", 2)',
        enabled: true,
      };
      expect(scenario.condition).toContain('get_var');
      expect(scenario.actions).toContain('set_var');
      expect(scenario.enabled).toBe(true);
    });
  });

  describe('WorldSettings', () => {
    it('all fields are optional', () => {
      const settings: WorldSettings = {};
      expect(settings.temperature).toBeUndefined();
      expect(settings.agents).toBeUndefined();
    });

    it('allows partial agent overrides', () => {
      const settings: WorldSettings = {
        temperature: 0.8,
        agents: {
          memory: { enabled: false },
          narrativeConsistency: { enabled: true, tokenBudget: 512 },
        },
      };
      expect(settings.agents?.memory?.enabled).toBe(false);
      expect(settings.agents?.narrativeConsistency?.tokenBudget).toBe(512);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types/world-types.test.ts`
Expected: FAIL — types not exported

- [ ] **Step 3: Update WorldCard types**

Replace the contents of `src/lib/types/world.ts`:

```typescript
import type { LorebookEntry, LorebookSettings } from './lorebook';
import type { Trigger } from './trigger';
import type { RegexScript, VariableStore } from './script';
import type { DepthPrompt } from './character';

export interface WorldCharacter {
  id: string;
  name: string;
  description: string;
  personality: string;
  exampleMessages: string;
  avatar: string | null;
  lorebookEntryIds: string[];
  trackState: boolean;
  tags: string[];
}

export interface AlternateGreeting {
  id: string;
  name: string;
  content: string;
}

export interface WorldScenario {
  id: string;
  name: string;
  description: string;
  condition: string;
  actions: string;
  enabled: boolean;
}

export interface WorldSettings {
  providerId?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  agents?: {
    memory?: { enabled?: boolean; tokenBudget?: number };
    director?: { enabled?: boolean; tokenBudget?: number };
    sceneState?: { enabled?: boolean; tokenBudget?: number };
    characterState?: { enabled?: boolean; tokenBudget?: number };
    narrativeConsistency?: { enabled?: boolean; tokenBudget?: number };
  };
  loreSettings?: Partial<LorebookSettings>;
}

export interface WorldCard {
  name: string;
  description: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: AlternateGreeting[];

  systemPrompt: string;
  postHistoryInstructions: string;
  depthPrompt?: DepthPrompt;
  defaultPersonaId?: string;

  lorebook: LorebookEntry[];
  loreSettings: LorebookSettings;

  characters: WorldCharacter[];

  regexScripts: RegexScript[];
  triggers: Trigger[];
  virtualScript?: string;
  scriptState: VariableStore;

  scenarios: WorldScenario[];

  worldSettings?: WorldSettings;

  backgroundHTML?: string;
  backgroundCSS?: string;
  customTheme?: string;

  creator: string;
  tags: string[];
  creatorNotes: string;
  license?: string;
  metadata: Record<string, unknown>;
}

export function createDefaultWorldCard(): WorldCard {
  return {
    name: '',
    description: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    systemPrompt: '',
    postHistoryInstructions: '',
    lorebook: [],
    loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
    characters: [],
    regexScripts: [],
    triggers: [],
    scriptState: {},
    scenarios: [],
    creator: '',
    tags: [],
    creatorNotes: '',
    metadata: {},
  };
}
```

- [ ] **Step 4: Update barrel exports in `src/lib/types/index.ts`**

Add to the World section:

```typescript
export type { WorldCard, WorldCharacter, AlternateGreeting, WorldScenario, WorldSettings } from './world';
export { createDefaultWorldCard } from './world';
```

Replace the existing World exports.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/types/world-types.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/world.ts src/lib/types/index.ts tests/types/world-types.test.ts
git commit -m "feat: expand WorldCard types with AlternateGreeting, WorldScenario, WorldSettings"
```

---

### Task 2: Update CharacterCard.alternateGreetings and Migration Logic

**Files:**
- Modify: `src/lib/types/character.ts`
- Modify: `src/lib/storage/world-import.ts`
- Modify: `tests/storage/world-import.test.ts`

- [ ] **Step 1: Write the failing test for migration**

Add to `tests/storage/world-import.test.ts`:

```typescript
describe('alternateGreetings migration', () => {
  it('migrates string[] alternateGreetings to AlternateGreeting[]', () => {
    const data = {
      spec: 'tcworld',
      specVersion: '1.0',
      data: {
        name: 'Migration Test',
        description: 'Test',
        scenario: '',
        firstMessage: '',
        alternateGreetings: ['Greeting one', 'Greeting two'],
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
    const result = parseWorldCard(toBuffer(data));
    expect(result.alternateGreetings).toHaveLength(2);
    expect(result.alternateGreetings[0]).toEqual({
      id: expect.any(String),
      name: 'Greeting 1',
      content: 'Greeting one',
    });
    expect(result.alternateGreetings[1]).toEqual({
      id: expect.any(String),
      name: 'Greeting 2',
      content: 'Greeting two',
    });
  });

  it('preserves existing AlternateGreeting[] format', () => {
    const greetings = [
      { id: 'g1', name: 'Tavern', content: 'The door opens...' },
    ];
    const data = {
      spec: 'tcworld',
      specVersion: '1.0',
      data: {
        name: 'Preserve Test',
        description: 'Test',
        alternateGreetings: greetings,
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
    const result = parseWorldCard(toBuffer(data));
    expect(result.alternateGreetings).toEqual(greetings);
  });
});

describe('WorldCharacter migration', () => {
  it('fills defaults for legacy WorldCharacter fields', () => {
    const data = {
      spec: 'tcworld',
      specVersion: '1.0',
      data: {
        name: 'Char Migration',
        description: 'Test',
        characters: [
          { id: 'c1', name: 'Legacy', description: 'Old format' },
        ],
        lorebook: [],
        loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
        regexScripts: [],
        triggers: [],
        scriptState: {},
        creator: '',
        tags: [],
        creatorNotes: '',
        metadata: {},
      },
    };
    const result = parseWorldCard(toBuffer(data));
    expect(result.characters[0]).toEqual({
      id: 'c1',
      name: 'Legacy',
      description: 'Old format',
      personality: '',
      exampleMessages: '',
      avatar: null,
      lorebookEntryIds: [],
      trackState: false,
      tags: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/world-import.test.ts`
Expected: FAIL — alternateGreetings migration not implemented

- [ ] **Step 3: Update world-import.ts with migration logic**

Replace `src/lib/storage/world-import.ts`:

```typescript
import type { WorldCard, WorldCharacter, AlternateGreeting } from '$lib/types';
import { createDefaultWorldCard } from '$lib/types';

const TCWORLD_SPEC = 'tcworld';
const TCWORLD_VERSION = '1.0';

const REQUIRED_DATA_FIELDS: (keyof WorldCard)[] = ['name', 'description'];

function migrateAlternateGreetings(raw: any): AlternateGreeting[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  if (typeof raw[0] === 'object' && raw[0] !== null && 'id' in raw[0]) {
    return raw as AlternateGreeting[];
  }
  return raw.map((content: string, i: number) => ({
    id: crypto.randomUUID(),
    name: `Greeting ${i + 1}`,
    content,
  }));
}

function migrateCharacter(char: any): WorldCharacter {
  return {
    id: char.id ?? crypto.randomUUID(),
    name: char.name ?? '',
    description: char.description ?? '',
    personality: char.personality ?? '',
    exampleMessages: char.exampleMessages ?? '',
    avatar: char.avatar ?? null,
    lorebookEntryIds: char.lorebookEntryIds ?? [],
    trackState: char.trackState ?? false,
    tags: char.tags ?? [],
  };
}

export function validateWorldCard(data: ArrayBuffer): boolean {
  try {
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return false;
    if (parsed.spec !== TCWORLD_SPEC) return false;
    if (typeof parsed.data !== 'object' || parsed.data === null) return false;
    return REQUIRED_DATA_FIELDS.every((field) => field in parsed.data);
  } catch {
    return false;
  }
}

export function parseWorldCard(data: ArrayBuffer): WorldCard {
  const text = new TextDecoder().decode(data);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON in world card file');
  }
  if (parsed.spec !== TCWORLD_SPEC || !parsed.data) {
    throw new Error('Not a valid .tcworld file');
  }
  const defaults = createDefaultWorldCard();
  const raw = parsed.data;
  const merged = { ...defaults, ...raw };
  merged.alternateGreetings = migrateAlternateGreetings(raw.alternateGreetings);
  if (Array.isArray(raw.characters)) {
    merged.characters = raw.characters.map(migrateCharacter);
  }
  if (!Array.isArray(raw.scenarios)) {
    merged.scenarios = [];
  }
  return merged as WorldCard;
}

export function exportWorldCard(card: WorldCard): ArrayBuffer {
  const envelope = {
    spec: TCWORLD_SPEC,
    specVersion: TCWORLD_VERSION,
    data: card,
  };
  const json = JSON.stringify(envelope, null, 2);
  return new TextEncoder().encode(json).buffer;
}
```

- [ ] **Step 4: Update CharacterCard.alternateGreetings type**

In `src/lib/types/character.ts`, change the import and field:

Add import at top:
```typescript
import type { AlternateGreeting } from './world';
```

Change field:
```typescript
alternateGreetings: AlternateGreeting[];
```

- [ ] **Step 5: Update worlds.test.ts mock data**

In `tests/storage/worlds.test.ts`, update `mockWorld` to match the new WorldCard shape — add `scenarios: []` and ensure `characters` use new fields:

```typescript
const mockWorld: WorldCard = {
  name: 'Test World',
  description: 'A test world',
  scenario: 'Test scenario',
  firstMessage: 'Welcome to the test world',
  alternateGreetings: [],
  systemPrompt: '',
  postHistoryInstructions: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  characters: [],
  regexScripts: [],
  triggers: [],
  scriptState: {},
  scenarios: [],
  creator: 'test',
  tags: [],
  creatorNotes: '',
  metadata: {},
};
```

- [ ] **Step 6: Run tests to verify everything passes**

Run: `npx vitest run tests/storage/world-import.test.ts tests/storage/worlds.test.ts tests/types/world-types.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/character.ts src/lib/storage/world-import.ts tests/storage/world-import.test.ts tests/storage/worlds.test.ts
git commit -m "feat: add migration for AlternateGreeting and expanded WorldCharacter fields"
```

---

### Task 3: Build WorldCharacterForm Component

**Files:**
- Create: `src/lib/components/editors/WorldCharacterForm.svelte`

- [ ] **Step 1: Create the WorldCharacterForm component**

This component edits a single `WorldCharacter`. Follows the same pattern as `LorebookEntryForm.svelte` — receives entry via props, calls `onchange` with updated entry.

```svelte
<script lang="ts">
  import type { WorldCharacter, LorebookEntry } from '$lib/types';

  let {
    character,
    lorebookEntries,
    onchange,
    onremove,
  }: {
    character: WorldCharacter;
    lorebookEntries: LorebookEntry[];
    onchange: (char: WorldCharacter) => void;
    onremove: () => void;
  } = $props();

  let tagsText = $state(character.tags.join(', '));

  function update(partial: Partial<WorldCharacter>) {
    onchange({ ...character, ...partial });
  }

  function handleTagsInput(value: string) {
    tagsText = value;
    const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
    update({ tags: arr });
  }

  function handleLorebookToggle(entryId: string) {
    const current = character.lorebookEntryIds;
    if (current.includes(entryId)) {
      update({ lorebookEntryIds: current.filter((id) => id !== entryId) });
    } else {
      update({ lorebookEntryIds: [...current, entryId] });
    }
  }
</script>

<div class="flex flex-col gap-3">
  <div class="grid grid-cols-2 gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Name</span>
      <input
        type="text"
        value={character.name}
        oninput={(e) => update({ name: e.currentTarget.value })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Tags</span>
      <input
        type="text"
        value={tagsText}
        oninput={(e) => handleTagsInput(e.currentTarget.value)}
        placeholder="tag1, tag2, ..."
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
      />
    </label>
  </div>

  <label class="flex flex-col gap-1">
    <span class="text-xs text-subtext0">Description</span>
    <textarea
      value={character.description}
      oninput={(e) => update({ description: e.currentTarget.value })}
      rows={3}
      class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
             focus:border-mauve focus:outline-none transition-colors resize-y"
    ></textarea>
  </label>

  <label class="flex flex-col gap-1">
    <span class="text-xs text-subtext0">Personality</span>
    <textarea
      value={character.personality}
      oninput={(e) => update({ personality: e.currentTarget.value })}
      rows={2}
      class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
             focus:border-mauve focus:outline-none transition-colors resize-y
             placeholder:text-overlay0"
      placeholder="Personality traits, quirks, speech patterns..."
    ></textarea>
  </label>

  <label class="flex flex-col gap-1">
    <span class="text-xs text-subtext0">Example Messages</span>
    <textarea
      value={character.exampleMessages}
      oninput={(e) => update({ exampleMessages: e.currentTarget.value })}
      rows={3}
      class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
             focus:border-mauve focus:outline-none transition-colors resize-y font-mono
             placeholder:text-overlay0"
      placeholder="<START>&#10;{{char}}: Hello there!&#10;{{user}}: Hi!"
    ></textarea>
  </label>

  {#if lorebookEntries.length > 0}
    <div class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Linked Lorebook Entries</span>
      <div class="flex flex-wrap gap-1.5">
        {#each lorebookEntries as entry (entry.id)}
          <button
            type="button"
            onclick={() => handleLorebookToggle(entry.id)}
            class="px-2 py-0.5 rounded text-xs border transition-colors
                   {character.lorebookEntryIds.includes(entry.id)
                     ? 'bg-mauve/20 border-mauve text-mauve'
                     : 'bg-surface0 border-surface1 text-subtext0 hover:border-overlay0'}"
          >
            {entry.name || 'Untitled'}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <label class="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={character.trackState}
        onchange={(e) => update({ trackState: e.currentTarget.checked })}
        class="accent-mauve"
      />
      <span class="text-xs text-subtext1">Track State</span>
    </label>
    <button
      type="button"
      onclick={onremove}
      class="px-3 py-1 rounded text-xs text-red hover:bg-red/10 transition-colors"
    >
      Remove Character
    </button>
  </div>
</div>
```

- [ ] **Step 2: Verify component compiles**

Run: `npx svelte-check --threshold error 2>&1 | Select-String "WorldCharacterForm"`
Expected: No errors for this file (warnings OK)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editors/WorldCharacterForm.svelte
git commit -m "feat: add WorldCharacterForm editor component"
```

---

### Task 4: Build GreetingList Component

**Files:**
- Create: `src/lib/components/editors/GreetingList.svelte`

- [ ] **Step 1: Create the GreetingList component**

```svelte
<script lang="ts">
  import type { AlternateGreeting } from '$lib/types';

  let {
    greetings,
    onchange,
    label = 'Alternate Greetings',
  }: {
    greetings: AlternateGreeting[];
    onchange: (greetings: AlternateGreeting[]) => void;
    label?: string;
  } = $props();

  let expandedIds = $state<Set<string>>(new Set());

  function addGreeting() {
    const newGreeting: AlternateGreeting = {
      id: crypto.randomUUID(),
      name: 'New Greeting',
      content: '',
    };
    onchange([...greetings, newGreeting]);
    expandedIds = new Set([...expandedIds, newGreeting.id]);
  }

  function updateGreeting(id: string, partial: Partial<AlternateGreeting>) {
    onchange(greetings.map((g) => (g.id === id ? { ...g, ...partial } : g)));
  }

  function removeGreeting(id: string) {
    onchange(greetings.filter((g) => g.id !== id));
    const ids = new Set(expandedIds);
    ids.delete(id);
    expandedIds = ids;
  }

  function toggleExpand(id: string) {
    const ids = new Set(expandedIds);
    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }
    expandedIds = ids;
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium text-text">{label}</h3>
    <button
      type="button"
      onclick={addGreeting}
      class="px-3 py-1 rounded text-xs font-medium bg-mauve text-crust hover:bg-lavender transition-colors"
    >
      + Add Greeting
    </button>
  </div>

  {#if greetings.length === 0}
    <p class="text-xs text-overlay0 text-center py-4">No greetings yet. Click "Add Greeting" to start.</p>
  {:else}
    {#each greetings as greeting (greeting.id)}
      {@const isExpanded = expandedIds.has(greeting.id)}
      <div class="rounded-lg border border-surface1 bg-crust overflow-hidden">
        <button
          type="button"
          onclick={() => toggleExpand(greeting.id)}
          class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface0 transition-colors"
        >
          <span class="text-xs text-overlay0 transition-transform" class:rotate-90={isExpanded}>
            &#9654;
          </span>
          <span class="text-sm text-text flex-1 truncate">
            {greeting.name || 'Untitled'}
          </span>
          <span class="text-xs text-overlay0 truncate max-w-48">
            {greeting.content.substring(0, 60)}{greeting.content.length > 60 ? '...' : ''}
          </span>
        </button>

        {#if isExpanded}
          <div class="px-3 pb-3 border-t border-surface1 flex flex-col gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-subtext0">Name</span>
              <input
                type="text"
                value={greeting.name}
                oninput={(e) => updateGreeting(greeting.id, { name: e.currentTarget.value })}
                class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                       focus:border-mauve focus:outline-none transition-colors"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs text-subtext0">Content</span>
              <textarea
                value={greeting.content}
                oninput={(e) => updateGreeting(greeting.id, { content: e.currentTarget.value })}
                rows={4}
                class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                       focus:border-mauve focus:outline-none transition-colors resize-y"
              ></textarea>
            </label>
            <div class="flex justify-end">
              <button
                type="button"
                onclick={() => removeGreeting(greeting.id)}
                class="px-3 py-1 rounded text-xs text-red hover:bg-red/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/editors/GreetingList.svelte
git commit -m "feat: add GreetingList editor component"
```

---

### Task 5: Build WorldSettingsEditor Component

**Files:**
- Create: `src/lib/components/editors/WorldSettingsEditor.svelte`

- [ ] **Step 1: Create the WorldSettingsEditor component**

```svelte
<script lang="ts">
  import type { WorldSettings } from '$lib/types';

  let {
    settings,
    onchange,
    providerIds,
  }: {
    settings: WorldSettings;
    onchange: (settings: WorldSettings) => void;
    providerIds: string[];
  } = $props();

  function update(partial: Partial<WorldSettings>) {
    onchange({ ...settings, ...partial });
  }

  function updateAgent(agentKey: keyof NonNullable<WorldSettings['agents']>, partial: { enabled?: boolean; tokenBudget?: number }) {
    const agents = { ...settings.agents };
    agents[agentKey] = { ...agents[agentKey], ...partial };
    update({ agents });
  }
</script>

<div class="flex flex-col gap-4">
  <div>
    <h3 class="text-sm font-medium text-text mb-2">Model Overrides</h3>
    <p class="text-xs text-subtext0 mb-3">Leave blank to use global settings.</p>
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Provider</span>
        <select
          value={settings.providerId ?? ''}
          onchange={(e) => {
            const val = e.currentTarget.value;
            update({ providerId: val || undefined });
          }}
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors"
        >
          <option value="">(global)</option>
          {#each providerIds as pid}
            <option value={pid}>{pid}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Model</span>
        <input
          type="text"
          value={settings.model ?? ''}
          oninput={(e) => update({ model: e.currentTarget.value || undefined })}
          placeholder="(global)"
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Temperature</span>
        <input
          type="number"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature ?? ''}
          oninput={(e) => {
            const val = e.currentTarget.value;
            update({ temperature: val ? Number(val) : undefined });
          }}
          placeholder="(global)"
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Top P</span>
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={settings.topP ?? ''}
          oninput={(e) => {
            const val = e.currentTarget.value;
            update({ topP: val ? Number(val) : undefined });
          }}
          placeholder="(global)"
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Max Tokens</span>
        <input
          type="number"
          min="1"
          value={settings.maxTokens ?? ''}
          oninput={(e) => {
            const val = e.currentTarget.value;
            update({ maxTokens: val ? Number(val) : undefined });
          }}
          placeholder="(global)"
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
        />
      </label>
    </div>
  </div>

  <div>
    <h3 class="text-sm font-medium text-text mb-2">Agent Overrides</h3>
    <div class="flex flex-col gap-2">
      {#each [
        { key: 'memory' as const, label: 'Memory Agent' },
        { key: 'director' as const, label: 'Director Agent' },
        { key: 'sceneState' as const, label: 'Scene State Agent' },
        { key: 'characterState' as const, label: 'Character State Agent' },
        { key: 'narrativeConsistency' as const, label: 'Narrative Consistency' },
      ] as agent}
        <div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface0 border border-surface1">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.agents?.[agent.key]?.enabled ?? true}
              onchange={(e) => updateAgent(agent.key, { enabled: e.currentTarget.checked })}
              class="accent-mauve"
            />
            <span class="text-xs text-subtext1">{agent.label}</span>
          </label>
          <label class="flex items-center gap-1.5 ml-auto">
            <span class="text-xs text-subtext0">Budget</span>
            <input
              type="number"
              min="0"
              value={settings.agents?.[agent.key]?.tokenBudget ?? ''}
              oninput={(e) => {
                const val = e.currentTarget.value;
                updateAgent(agent.key, { tokenBudget: val ? Number(val) : undefined });
              }}
              placeholder="(global)"
              class="w-20 rounded px-2 py-1 text-xs bg-surface1 text-text border border-surface1
                     focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
            />
          </label>
        </div>
      {/each}
    </div>
  </div>

  <div>
    <h3 class="text-sm font-medium text-text mb-2">Lore Settings Overrides</h3>
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Token Budget</span>
        <input
          type="number"
          min="0"
          value={settings.loreSettings?.tokenBudget ?? ''}
          oninput={(e) => {
            const val = e.currentTarget.value;
            update({ loreSettings: { ...settings.loreSettings, tokenBudget: val ? Number(val) : undefined } });
          }}
          placeholder="(global)"
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Scan Depth</span>
        <input
          type="number"
          min="0"
          value={settings.loreSettings?.scanDepth ?? ''}
          oninput={(e) => {
            const val = e.currentTarget.value;
            update({ loreSettings: { ...settings.loreSettings, scanDepth: val ? Number(val) : undefined } });
          }}
          placeholder="(global)"
          class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
                 focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
        />
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/editors/WorldSettingsEditor.svelte
git commit -m "feat: add WorldSettingsEditor component"
```

---

### Task 6: Overhaul the World Editor Page

**Files:**
- Modify: `src/routes/worlds/[id]/edit/+page.svelte`

This is the largest task. The editor page gets a full rewrite using the new components plus existing `LorebookEditor`, `RegexEditor`, `TriggerEditor`.

- [ ] **Step 1: Rewrite the editor page**

Replace the entire content of `src/routes/worlds/[id]/edit/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { worldsStore } from '$lib/stores/worlds';
  import { worldsRepo } from '$lib/repositories/worlds-repo';
  import { createDefaultWorldCard } from '$lib/types/world';
  import type { WorldCard, WorldCharacter } from '$lib/types/world';
  import * as worldImport from '$lib/storage/world-import';
  import { settingsStore } from '$lib/stores/settings';

  import LorebookEditor from '$lib/components/editors/LorebookEditor.svelte';
  import RegexEditor from '$lib/components/editors/RegexEditor.svelte';
  import TriggerEditor from '$lib/components/editors/TriggerEditor.svelte';
  import WorldCharacterForm from '$lib/components/editors/WorldCharacterForm.svelte';
  import GreetingList from '$lib/components/editors/GreetingList.svelte';
  import WorldSettingsEditor from '$lib/components/editors/WorldSettingsEditor.svelte';

  let tab = $state<'overview' | 'system' | 'lorebook' | 'characters' | 'scripts' | 'settings' | 'theme'>('overview');
  let card = $state<WorldCard>(createDefaultWorldCard());
  let saving = $state(false);
  let saved = $state(false);
  let error = $state('');
  let loaded = $state(false);

  const worldId = $derived($page.params.id ?? '');

  let tagsText = $state('');
  let newCharName = $state('');

  let expandedCharIds = $state<Set<string>>(new Set());

  const providerIds = $derived(Object.keys($settingsStore.providers));

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'system' as const, label: 'System Prompt' },
    { key: 'lorebook' as const, label: 'Lorebook' },
    { key: 'characters' as const, label: 'Characters' },
    { key: 'scripts' as const, label: 'Scripts' },
    { key: 'settings' as const, label: 'Settings' },
    { key: 'theme' as const, label: 'Theme' },
  ];

  onMount(async () => {
    try {
      await worldsRepo.selectWorld(worldId);
      const state = $worldsStore;
      if (state.current) {
        card = JSON.parse(JSON.stringify(state.current));
        tagsText = card.tags.join(', ');
      }
      loaded = true;
    } catch {
      error = 'Failed to load world';
      loaded = true;
    }
  });

  async function handleSave() {
    saving = true;
    saved = false;
    error = '';
    try {
      card.tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
      await worldsRepo.saveWorld(worldId, card);
      saved = true;
      setTimeout(() => { saved = false; }, 2000);
    } catch (e: any) {
      error = e?.message || 'Failed to save';
    } finally {
      saving = false;
    }
  }

  function addCharacter() {
    if (!newCharName.trim()) return;
    const char: WorldCharacter = {
      id: crypto.randomUUID(),
      name: newCharName.trim(),
      description: '',
      personality: '',
      exampleMessages: '',
      avatar: null,
      lorebookEntryIds: [],
      trackState: false,
      tags: [],
    };
    card.characters = [...card.characters, char];
    expandedCharIds = new Set([...expandedCharIds, char.id]);
    newCharName = '';
  }

  function updateCharacter(id: string, updated: WorldCharacter) {
    card.characters = card.characters.map((c) => (c.id === id ? updated : c));
  }

  function removeCharacter(id: string) {
    card.characters = card.characters.filter((c) => c.id !== id);
    const ids = new Set(expandedCharIds);
    ids.delete(id);
    expandedCharIds = ids;
  }

  function toggleCharExpand(id: string) {
    const ids = new Set(expandedCharIds);
    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }
    expandedCharIds = ids;
  }

  async function handleExport() {
    try {
      const data = worldImport.exportWorldCard(card);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: `${card.name || 'world'}.tcworld`,
        filters: [{ name: 'World Cards', extensions: ['tcworld'] }],
      });
      if (!filePath) return;
      await writeFile(filePath, new Uint8Array(data));
    } catch (e: any) {
      error = e?.message || 'Export failed';
    }
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <div class="flex items-center gap-3">
      <button onclick={() => goto('/worlds')} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer text-lg">&larr;</button>
      <h1 class="text-lg font-semibold text-text">Edit World</h1>
      <span class="text-sm text-subtext0">{card.name || 'Untitled'}</span>
    </div>
    <div class="flex gap-2">
      <button
        onclick={handleExport}
        class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
      >
        Export
      </button>
      <button
        onclick={() => goto(`/chat/${worldId}?cardType=world`)}
        class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
      >
        Chat
      </button>
      <button
        onclick={handleSave}
        disabled={saving}
        class="px-3 py-1.5 rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 transition-colors cursor-pointer border-none
               {saved ? 'bg-green text-crust' : 'bg-mauve text-crust'}"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="px-4 py-2 bg-red/10 text-red text-sm border-b border-surface0">{error}</div>
  {/if}

  {#if !loaded}
    <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
  {:else}
    <div class="flex gap-1 px-4 py-2 border-b border-surface0 overflow-x-auto">
      {#each tabs as t}
        <button
          onclick={() => tab = t.key}
          class="px-3 py-1 rounded-md text-sm transition-colors cursor-pointer border-none
                 {tab === t.key ? 'bg-surface1 text-text font-medium' : 'bg-transparent text-subtext0 hover:text-text'}"
        >
          {t.label}
        </button>
      {/each}
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      {#if tab === 'overview'}
        <div class="max-w-2xl space-y-6">
          <div class="space-y-4">
            <div>
              <label class="block text-xs text-subtext0 mb-1">Name</label>
              <input type="text" bind:value={card.name} class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
            </div>
            <div>
              <label class="block text-xs text-subtext0 mb-1">Description</label>
              <textarea bind:value={card.description} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
            </div>
            <div>
              <label class="block text-xs text-subtext0 mb-1">Scenario</label>
              <textarea bind:value={card.scenario} rows="3" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
            </div>
            <div>
              <label class="block text-xs text-subtext0 mb-1">First Message (Default)</label>
              <textarea bind:value={card.firstMessage} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
            </div>
          </div>

          <div class="border-t border-surface0 pt-4">
            <GreetingList
              greetings={card.alternateGreetings}
              onchange={(g) => { card.alternateGreetings = g; }}
            />
          </div>

          <div class="border-t border-surface0 pt-4 space-y-4">
            <div>
              <label class="block text-xs text-subtext0 mb-1">Tags</label>
              <input type="text" bind:value={tagsText} placeholder="tag1, tag2, ..." class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
            </div>
            <div>
              <label class="block text-xs text-subtext0 mb-1">Creator Notes</label>
              <textarea bind:value={card.creatorNotes} rows="2" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
            </div>
          </div>
        </div>

      {:else if tab === 'system'}
        <div class="max-w-2xl space-y-4">
          <div>
            <label class="block text-xs text-subtext0 mb-1">System Prompt</label>
            <textarea bind:value={card.systemPrompt} rows="8" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Post History Instructions</label>
            <textarea bind:value={card.postHistoryInstructions} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Depth Prompt</label>
            <textarea bind:value={card.depthPrompt?.prompt ?? ''} rows="2"
              oninput={(e) => {
                const val = (e.target as HTMLTextAreaElement).value;
                card.depthPrompt = val ? { depth: card.depthPrompt?.depth ?? 4, prompt: val } : undefined;
              }}
              class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"
            ></textarea>
            <div class="mt-1">
              <label class="text-xs text-subtext0">Depth position: </label>
              <input
                type="number"
                min="0"
                value={card.depthPrompt?.depth ?? 4}
                oninput={(e) => {
                  const val = Number((e.target as HTMLInputElement).value);
                  if (card.depthPrompt) card.depthPrompt = { ...card.depthPrompt, depth: val };
                }}
                class="w-16 bg-surface0 text-text text-xs px-2 py-1 rounded border border-surface1"
              />
            </div>
          </div>
        </div>

      {:else if tab === 'lorebook'}
        <div class="max-w-3xl">
          <LorebookEditor
            entries={card.lorebook}
            onchange={(entries) => { card.lorebook = entries; }}
          />
        </div>

      {:else if tab === 'characters'}
        <div class="max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-text">Characters</h2>
            <span class="text-xs text-subtext0">{card.characters.length} characters</span>
          </div>
          <div class="flex flex-col gap-2 mb-4">
            {#each card.characters as char (char.id)}
              {@const isExpanded = expandedCharIds.has(char.id)}
              <div class="rounded-lg border border-surface1 bg-crust overflow-hidden">
                <button
                  type="button"
                  onclick={() => toggleCharExpand(char.id)}
                  class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface0 transition-colors"
                >
                  <span class="text-xs text-overlay0 transition-transform" class:rotate-90={isExpanded}>&#9654;</span>
                  <span class="text-sm text-text flex-1 truncate font-medium">{char.name || 'Unnamed'}</span>
                  {#if char.trackState}
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue/20 text-blue">Tracked</span>
                  {/if}
                  <button
                    type="button"
                    onclick={(e) => { e.stopPropagation(); removeCharacter(char.id); }}
                    class="text-red hover:text-red text-xs cursor-pointer bg-transparent border-none px-1"
                  >
                    ✕
                  </button>
                </button>
                {#if isExpanded}
                  <div class="px-3 pb-3 border-t border-surface1">
                    <WorldCharacterForm
                      character={char}
                      lorebookEntries={card.lorebook}
                      onchange={(updated) => updateCharacter(char.id, updated)}
                      onremove={() => removeCharacter(char.id)}
                    />
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-xs text-overlay0 text-center py-4">No characters yet.</p>
            {/each}
          </div>
          <div class="flex gap-2 p-3 rounded-lg bg-surface0 border border-surface1 border-dashed">
            <input
              type="text"
              bind:value={newCharName}
              onkeydown={(e) => { if (e.key === 'Enter') addCharacter(); }}
              class="flex-1 bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
              placeholder="Character name"
            />
            <button
              onclick={addCharacter}
              class="px-3 py-1 bg-mauve text-crust rounded text-sm font-medium hover:bg-lavender transition-colors cursor-pointer border-none"
            >
              Add
            </button>
          </div>
        </div>

      {:else if tab === 'scripts'}
        <div class="max-w-3xl space-y-6">
          <div>
            <RegexEditor
              scripts={card.regexScripts}
              onchange={(scripts) => { card.regexScripts = scripts; }}
            />
          </div>
          <div class="border-t border-surface0 pt-4">
            <TriggerEditor
              triggers={card.triggers}
              onchange={(triggers) => { card.triggers = triggers; }}
            />
          </div>
        </div>

      {:else if tab === 'settings'}
        <div class="max-w-2xl">
          <WorldSettingsEditor
            settings={card.worldSettings ?? {}}
            onchange={(s) => { card.worldSettings = s; }}
            {providerIds}
          />
        </div>

      {:else if tab === 'theme'}
        <div class="max-w-2xl space-y-4">
          <div>
            <label class="block text-xs text-subtext0 mb-1">Background HTML</label>
            <textarea bind:value={card.backgroundHTML} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Background CSS</label>
            <textarea bind:value={card.backgroundCSS} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Verify the page compiles**

Run: `npx svelte-check --threshold error 2>&1 | Select-String "worlds/\[id\]"`
Expected: No errors for this file (pre-existing errors elsewhere are OK)

- [ ] **Step 3: Commit**

```bash
git add src/routes/worlds/[id]/edit/+page.svelte
git commit -m "feat: overhaul world editor with full character editing, lorebook, scripts, settings"
```

---

### Task 7: Run Full Test Suite and Fix Breakage

**Files:**
- May modify: any files that break due to type changes

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. Focus on: world-import, worlds, world-types tests.

- [ ] **Step 2: Run svelte-check**

Run: `npx svelte-check --threshold error`
Expected: No new errors. Pre-existing errors in other files are acceptable.

- [ ] **Step 3: Fix any type errors found**

If any files reference the old `string[]` alternateGreetings or missing `scenarios`/`worldSettings` fields, update them. Key files to check:
- `src/lib/core/chat/use-chat-helpers.ts` — worldCardToCharacterCard may need `alternateGreetings` mapping
- `src/routes/chat/[id]/+page.svelte` — check for world-related type usage

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address type errors from WorldCard model expansion"
```

---

### Task 8: Clean Up Test File and Verify

- [ ] **Step 1: Remove the standalone test HTML file if it exists**

Run: `Remove-Item -Path "test-visual.html" -ErrorAction SilentlyContinue`

- [ ] **Step 2: Final full test run**

Run: `npx vitest run`
Expected: All tests pass (836+)

- [ ] **Step 3: Commit cleanup**

```bash
git add -A
git commit -m "chore: cleanup after world card model + editor sub-project"
```
