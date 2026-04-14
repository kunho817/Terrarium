# Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full import/export for World Cards (`.tcworld` format) and export UI for Character Cards (leveraging existing `CardFormatPlugin.export()` methods).

**Architecture:** World card import/export uses a standalone utility module (no plugin abstraction). Character export reuses existing `CardFormatPlugin` instances via the plugin registry. Both use Tauri file dialogs for file picking and writing.

**Tech Stack:** SvelteKit 5, Tauri dialog/filesystem plugins, Vitest

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `src/lib/storage/world-import.ts` | `validateWorldCard`, `parseWorldCard`, `exportWorldCard` |
| `tests/storage/world-import.test.ts` | Tests for world card parse/validate/export |

### Modified Files
| File | Changes |
|------|---------|
| `src/routes/worlds/+page.svelte` | Add import button, per-world export button |
| `src/routes/worlds/[id]/edit/+page.svelte` | Add export button in header |
| `src/routes/characters/+page.svelte` | Add per-character export button with format dropdown |
| `src/routes/characters/[id]/edit/+page.svelte` | Add export button in header |

---

### Task 1: World Import/Export Utility

**Files:**
- Create: `src/lib/storage/world-import.ts`
- Create: `tests/storage/world-import.test.ts`

- [ ] **Step 1: Write failing tests in `tests/storage/world-import.test.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/storage/world-import.test.ts`
Expected: FAIL — module `$lib/storage/world-import` does not exist.

- [ ] **Step 3: Create `src/lib/storage/world-import.ts`**

```ts
import type { WorldCard } from '$lib/types';
import { createDefaultWorldCard } from '$lib/types';

const TCWORLD_SPEC = 'tcworld';
const TCWORLD_VERSION = '1.0';

const REQUIRED_DATA_FIELDS: (keyof WorldCard)[] = ['name', 'description'];

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
  return { ...defaults, ...parsed.data } as WorldCard;
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/storage/world-import.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (previous 466 + new tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/world-import.ts tests/storage/world-import.test.ts
git commit -m "feat: add world card import/export utility with .tcworld format"
```

---

### Task 2: World List Page — Import + Export

**Files:**
- Modify: `src/routes/worlds/+page.svelte`

- [ ] **Step 1: Update `src/routes/worlds/+page.svelte`**

Add imports at the top of the script block (after existing imports):

```ts
import * as worldImport from '$lib/storage/world-import';
```

Add state variables (after existing `let error`):

```ts
let importing = $state(false);
```

Add import handler function (after `handleDelete`):

```ts
async function handleImport() {
  importing = true;
  error = '';
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: true,
      filters: [{ name: 'World Cards', extensions: ['tcworld'] }],
    });
    if (!selected) {
      importing = false;
      return;
    }

    const paths = Array.isArray(selected) ? selected : [selected];

    for (const filePath of paths) {
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const data = await readFile(filePath);
        const card = worldImport.parseWorldCard(data.buffer as ArrayBuffer);
        await worldStorage.createWorld(card);
      } catch (e: any) {
        error = `Failed to import ${filePath}: ${e?.message || 'Unknown error'}`;
      }
    }

    await worldsStore.loadList();
  } catch (e: any) {
    error = e?.message || 'Import failed';
  } finally {
    importing = false;
  }
}

async function handleExport(id: string, name: string) {
  try {
    const card = await worldStorage.loadWorld(id);
    const data = worldImport.exportWorldCard(card);
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      defaultPath: `${name}.tcworld`,
      filters: [{ name: 'World Cards', extensions: ['tcworld'] }],
    });
    if (!filePath) return;
    await writeFile(filePath, new Uint8Array(data));
  } catch (e: any) {
    error = e?.message || 'Export failed';
  }
}
```

Update the header button area — replace the existing `<div class="flex gap-2">` block with:

```svelte
<div class="flex gap-2">
  <button
    onclick={handleImport}
    disabled={importing}
    class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm font-medium
           hover:bg-surface2 disabled:opacity-50 transition-colors cursor-pointer border-none"
  >
    {importing ? 'Importing...' : 'Import'}
  </button>
  <button
    onclick={handleCreate}
    class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
           hover:bg-lavender transition-colors cursor-pointer border-none"
  >
    + Create
  </button>
</div>
```

In the per-world hover buttons (the `absolute top-2 right-2` div), add an export button before the edit link:

```svelte
<div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  <button
    onclick={() => handleExport(world.id, world.name)}
    class="p-1 rounded bg-surface2 text-subtext0 hover:bg-overlay0 hover:text-text
           transition-colors text-xs cursor-pointer border-none"
    title="Export"
  >
    ↓
  </button>
  <a
    href="/worlds/{world.id}/edit"
    class="p-1 rounded bg-surface2 text-subtext0 hover:bg-overlay0 hover:text-text
           transition-colors text-xs"
    title="Edit"
  >
    &#9998;
  </a>
  <button
    onclick={() => handleDelete(world.id, world.name)}
    class="p-1 rounded bg-surface2 text-red hover:bg-overlay0
           transition-colors text-xs cursor-pointer border-none"
    title="Delete"
  >
    ✕
  </button>
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`
Expected: No new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/routes/worlds/+page.svelte
git commit -m "feat: add world import and export to worlds list page"
```

---

### Task 3: World Editor — Export Button

**Files:**
- Modify: `src/routes/worlds/[id]/edit/+page.svelte`

- [ ] **Step 1: Add export handler to world editor**

Add import at the top of the script block:

```ts
import * as worldImport from '$lib/storage/world-import';
```

Add export handler function (after `removeCharacter`):

```ts
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
```

In the header button area, add an "Export" button before the "Chat" button. The existing `<div class="flex gap-2">` should become:

```svelte
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
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/routes/worlds/[id]/edit/+page.svelte
git commit -m "feat: add export button to world editor"
```

---

### Task 4: Character List Page — Export Button

**Files:**
- Modify: `src/routes/characters/+page.svelte`

- [ ] **Step 1: Add export handler to characters list page**

Add import at the top of the script block:

```ts
import type { CharacterCard } from '$lib/types';
```

Add state variable for export dropdown (after `let error`):

```ts
let exportMenuFor: string | null = $state(null);
```

Add export handler function (after `handleSelect`):

```ts
async function handleExport(id: string, name: string, formatId: string) {
  exportMenuFor = null;
  try {
    const registry = getRegistry();
    const format = registry.getCardFormat(formatId);
    const card = await characterStorage.loadCharacter(id);
    const data = format.export(card);
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const ext = formatId === 'generic-json' ? 'tcjson' : 'json';
    const filePath = await save({
      defaultPath: `${name}.${ext}`,
      filters: [{ name: `${format.name} Card`, extensions: [ext] }],
    });
    if (!filePath) return;
    await writeFile(filePath, new Uint8Array(data));
  } catch (e: any) {
    error = e?.message || 'Export failed';
  }
}
```

In the per-character hover buttons (the `absolute top-2 right-2` div), add an export button before the edit link. Replace the existing hover div:

```svelte
<div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  <div class="relative">
    <button
      onclick={(e) => { e.stopPropagation(); exportMenuFor = exportMenuFor === character.id ? null : character.id; }}
      class="p-1 rounded bg-surface2 text-subtext0 hover:bg-overlay0 hover:text-text
             transition-colors text-xs cursor-pointer border-none"
      title="Export"
    >
      ↓
    </button>
    {#if exportMenuFor === character.id}
      <div class="absolute right-0 top-full mt-1 bg-surface1 border border-surface2 rounded-md shadow-lg z-10 py-1 min-w-[160px]">
        <button
          onclick={() => handleExport(character.id, character.name, 'generic-json')}
          class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
        >
          Terrarium (.tcjson)
        </button>
        <button
          onclick={() => handleExport(character.id, character.name, 'risuai')}
          class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
        >
          RisuAI (.json)
        </button>
        <button
          onclick={() => handleExport(character.id, character.name, 'sillytavern')}
          class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
        >
          SillyTavern (.json)
        </button>
      </div>
    {/if}
  </div>
  <a
    href="/characters/{character.id}/edit"
    class="p-1 rounded bg-surface2 text-subtext0 hover:bg-overlay0 hover:text-text
           transition-colors text-xs"
    title="Edit"
  >
    &#9998;
  </a>
  <button
    onclick={() => handleDelete(character.id, character.name)}
    class="p-1 rounded bg-surface2 text-red hover:bg-overlay0
           transition-colors text-xs"
    title="Delete"
  >
    ✕
  </button>
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/routes/characters/+page.svelte
git commit -m "feat: add per-character export with format dropdown"
```

---

### Task 5: Character Editor — Export Button

**Files:**
- Modify: `src/routes/characters/[id]/edit/+page.svelte`

- [ ] **Step 1: Add export handler to character editor**

Add imports at the top of the script block:

```ts
import { getRegistry } from '$lib/core/bootstrap';
```

Add state for export menu:

```ts
let showExportMenu = $state(false);
```

Add export handler function (after `handleSave`):

```ts
async function handleExport(formatId: string) {
  showExportMenu = false;
  if (!card) return;
  try {
    const registry = getRegistry();
    const format = registry.getCardFormat(formatId);
    const data = format.export(card);
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const ext = formatId === 'generic-json' ? 'tcjson' : 'json';
    const filePath = await save({
      defaultPath: `${card.name}.${ext}`,
      filters: [{ name: `${format.name} Card`, extensions: [ext] }],
    });
    if (!filePath) return;
    await writeFile(filePath, new Uint8Array(data));
  } catch (e: any) {
    error = e?.message || 'Export failed';
  }
}
```

In the header, replace the existing `<div class="flex items-center justify-between">` block with one that adds an export button/dropdown next to "Save Changes":

```svelte
<div class="flex items-center justify-between">
  <div class="flex items-center gap-3">
    <a href="/characters" class="text-subtext0 hover:text-text transition-colors">&#8592;</a>
    <h1 class="text-lg font-semibold text-text">Edit Character</h1>
  </div>
  <div class="flex items-center gap-2">
    <div class="relative">
      <button
        onclick={() => showExportMenu = !showExportMenu}
        class="px-3 py-2 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors"
      >
        Export
      </button>
      {#if showExportMenu}
        <div class="absolute right-0 top-full mt-1 bg-surface1 border border-surface2 rounded-md shadow-lg z-10 py-1 min-w-[160px]">
          <button
            onclick={() => handleExport('generic-json')}
            class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
          >
            Terrarium (.tcjson)
          </button>
          <button
            onclick={() => handleExport('risuai')}
            class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
          >
            RisuAI (.json)
          </button>
          <button
            onclick={() => handleExport('sillytavern')}
            class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
          >
            SillyTavern (.json)
          </button>
        </div>
      {/if}
    </div>
    <button
      onclick={handleSave}
      disabled={saving || !card.name.trim()}
      class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium
             hover:bg-lavender disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {saving ? 'Saving...' : 'Save Changes'}
    </button>
  </div>
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/routes/characters/[id]/edit/+page.svelte
git commit -m "feat: add export button with format dropdown to character editor"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (466 + new world-import tests).

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`
Expected: No new errors beyond pre-existing ones.

- [ ] **Step 3: Final commit (if any fixups needed)**

Only if verification required fixes.
