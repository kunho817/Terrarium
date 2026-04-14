# World Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add World Cards — a separate card type for world/setting-centric roleplay, with its own storage, store, editor UI, and prompt assembly support.

**Architecture:** World Cards are a new `WorldCard` type stored in `worlds/{id}/world.json`. Sessions gain a `cardType` field to route to the correct storage. The prompt assembler gets world-aware logic. A new worlds section is added to the home page and a world editor is created.

**Tech Stack:** SvelteKit 5, Svelte stores, Tauri filesystem, existing LorebookEntry, Vitest

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `src/lib/types/world.ts` | `WorldCard` and `WorldCharacter` types |
| `src/lib/storage/worlds.ts` | World card CRUD (list, load, save, delete, create) |
| `src/lib/stores/worlds.ts` | Reactive worlds store (same pattern as characters store) |
| `src/routes/worlds/+page.svelte` | World list page with create/import |
| `src/routes/worlds/new/+page.svelte` | New world creation page |
| `src/routes/worlds/[id]/edit/+page.svelte` | World editor (tabbed) |
| `tests/storage/worlds.test.ts` | Tests for worlds storage CRUD |
| `tests/stores/worlds-store.test.ts` | Tests for worlds store |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/types/index.ts` | Add World/WorldCharacter barrel exports |
| `src/lib/types/session.ts` | Add `cardType` field to `ChatSession` |
| `src/lib/types/lorebook.ts` | Add `category` field to `LorebookEntry` |
| `src/lib/storage/paths.ts` | Add world path constants |
| `src/routes/+page.svelte` | Add Characters/Worlds tabs, show world cards |
| `src/lib/core/chat/use-chat.ts` | World-aware card loading in `initChat` |
| `src/lib/core/chat/prompt-assembler.ts` | World-aware `AssemblyContext`, template vars |
| `src/lib/core/chat/engine.ts` | Accept `WorldCard` in chat context |
| `src/lib/components/TopBar.svelte` | Show "World" badge for world sessions |

---

### Task 1: World Types

**Files:**
- Create: `src/lib/types/world.ts`
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/types/lorebook.ts`
- Modify: `src/lib/types/session.ts`
- Test: `tests/storage/worlds.test.ts` (depends on types)

- [ ] **Step 1: Create `src/lib/types/world.ts`**

```ts
import type { LorebookEntry, LorebookSettings } from './lorebook';
import type { Trigger } from './trigger';
import type { RegexScript, VariableStore } from './script';
import type { DepthPrompt } from './character';

export interface WorldCharacter {
  id: string;
  name: string;
  description: string;
  personality?: string;
  exampleMessages?: string;
  avatar?: string;
  lorebookEntryIds?: string[];
}

export interface WorldCard {
  name: string;
  description: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];

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
    creator: '',
    tags: [],
    creatorNotes: '',
    metadata: {},
  };
}
```

- [ ] **Step 2: Add `category` field to `LorebookEntry` in `src/lib/types/lorebook.ts`**

Add after the `folderName` field (around line 42):

```ts
  category?: 'character' | 'region' | 'setting' | 'misc';
```

- [ ] **Step 3: Add `cardType` field to `ChatSession` in `src/lib/types/session.ts`**

```ts
export interface ChatSession {
  id: string;
  characterId: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  personaId?: string;
  cardType?: 'character' | 'world';
}
```

The field is optional — existing sessions default to `'character'`.

- [ ] **Step 4: Add barrel exports in `src/lib/types/index.ts`**

Add after the `// Character` block (after line 65):

```ts
// World
export type { WorldCard, WorldCharacter } from './world';
export { createDefaultWorldCard } from './world';
```

- [ ] **Step 5: Run typecheck to verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors in the new/modified type files (some pre-existing errors in other files are OK).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/world.ts src/lib/types/lorebook.ts src/lib/types/session.ts src/lib/types/index.ts
git commit -m "feat: add WorldCard, WorldCharacter types and LorebookEntry category"
```

---

### Task 2: World Storage

**Files:**
- Modify: `src/lib/storage/paths.ts`
- Create: `src/lib/storage/worlds.ts`
- Test: `tests/storage/worlds.test.ts`

- [ ] **Step 1: Add world paths to `src/lib/storage/paths.ts`**

Add after the `personas` block:

```ts
  // Worlds
  worlds: 'worlds',
  worldDir: (id: string) => `worlds/${id}`,
  worldFile: (id: string) => `worlds/${id}/world.json`,
```

- [ ] **Step 2: Write failing tests in `tests/storage/worlds.test.ts`**

Follow the same mock pattern as `tests/storage/characters.test.ts`. Mock `database.ts` functions.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
}));

import { listWorlds, loadWorld, saveWorld, deleteWorld, createWorld } from '$lib/storage/worlds';
import { readJson, writeJson, ensureDir, listDirs, removePath } from '$lib/storage/database';
import type { WorldCard } from '$lib/types';

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
  creator: 'test',
  tags: [],
  creatorNotes: '',
  metadata: {},
};

describe('worlds storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listWorlds', () => {
    it('returns empty array when no worlds exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);
      const result = await listWorlds();
      expect(result).toEqual([]);
    });

    it('lists worlds with names', async () => {
      vi.mocked(listDirs).mockResolvedValue(['world-1', 'world-2']);
      vi.mocked(readJson).mockImplementation(async (path: string) => {
        if (path.includes('world-1')) return { ...mockWorld, name: 'World One' };
        if (path.includes('world-2')) return { ...mockWorld, name: 'World Two' };
        throw new Error('not found');
      });
      const result = await listWorlds();
      expect(result).toEqual([
        { id: 'world-1', name: 'World One' },
        { id: 'world-2', name: 'World Two' },
      ]);
    });

    it('skips corrupt world directories', async () => {
      vi.mocked(listDirs).mockResolvedValue(['good', 'bad']);
      vi.mocked(readJson).mockImplementation(async (path: string) => {
        if (path.includes('good')) return mockWorld;
        throw new Error('corrupt');
      });
      const result = await listWorlds();
      expect(result).toEqual([{ id: 'good', name: 'Test World' }]);
    });
  });

  describe('loadWorld', () => {
    it('loads a world card', async () => {
      vi.mocked(readJson).mockResolvedValue(mockWorld);
      const result = await loadWorld('world-1');
      expect(result).toEqual(mockWorld);
      expect(readJson).toHaveBeenCalledWith('worlds/world-1/world.json');
    });
  });

  describe('saveWorld', () => {
    it('saves a world card', async () => {
      await saveWorld('world-1', mockWorld);
      expect(ensureDir).toHaveBeenCalledWith('worlds/world-1');
      expect(writeJson).toHaveBeenCalledWith('worlds/world-1/world.json', mockWorld);
    });
  });

  describe('deleteWorld', () => {
    it('removes world directory', async () => {
      await deleteWorld('world-1');
      expect(removePath).toHaveBeenCalledWith('worlds/world-1');
    });
  });

  describe('createWorld', () => {
    it('creates a new world and returns id', async () => {
      const id = await createWorld(mockWorld);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/storage/worlds.test.ts`
Expected: FAIL — module `$lib/storage/worlds` does not exist.

- [ ] **Step 4: Create `src/lib/storage/worlds.ts`**

```ts
import type { WorldCard } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listWorlds(): Promise<{ id: string; name: string }[]> {
  const dirs = await listDirs(PATHS.worlds);
  const worlds: { id: string; name: string }[] = [];

  for (const id of dirs) {
    try {
      const card = await readJson<WorldCard>(PATHS.worldFile(id));
      worlds.push({ id, name: card.name });
    } catch {
    }
  }

  return worlds;
}

export async function loadWorld(id: string): Promise<WorldCard> {
  return readJson<WorldCard>(PATHS.worldFile(id));
}

export async function saveWorld(id: string, card: WorldCard): Promise<void> {
  await ensureDir(PATHS.worldDir(id));
  await writeJson(PATHS.worldFile(id), card);
}

export async function deleteWorld(id: string): Promise<void> {
  await removePath(PATHS.worldDir(id));
}

export async function createWorld(card: WorldCard): Promise<string> {
  const id = crypto.randomUUID();
  await saveWorld(id, card);
  return id;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/storage/worlds.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/worlds.ts src/lib/storage/paths.ts tests/storage/worlds.test.ts
git commit -m "feat: add worlds storage with CRUD operations"
```

---

### Task 3: Worlds Store

**Files:**
- Create: `src/lib/stores/worlds.ts`
- Test: `tests/stores/worlds-store.test.ts`

- [ ] **Step 1: Write failing tests in `tests/stores/worlds-store.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/worlds', () => ({
  listWorlds: vi.fn(),
  loadWorld: vi.fn(),
  saveWorld: vi.fn(),
  deleteWorld: vi.fn(),
  createWorld: vi.fn(),
}));

import { worldsStore } from '$lib/stores/worlds';
import { listWorlds, loadWorld, saveWorld, deleteWorld } from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';
import { get } from 'svelte/store';

const mockWorld: WorldCard = {
  name: 'Test World',
  description: 'A test world',
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
  creator: '',
  tags: [],
  creatorNotes: '',
  metadata: {},
};

describe('worlds store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldsStore.clearSelection();
  });

  describe('loadList', () => {
    it('loads world list into store', async () => {
      vi.mocked(listWorlds).mockResolvedValue([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      await worldsStore.loadList();
      const state = get(worldsStore);
      expect(state.list).toEqual([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('selectWorld', () => {
    it('loads and sets current world', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsStore.selectWorld('w1');
      const state = get(worldsStore);
      expect(state.currentId).toBe('w1');
      expect(state.current).toEqual(mockWorld);
    });
  });

  describe('saveCurrent', () => {
    it('saves current world via storage', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsStore.selectWorld('w1');
      await worldsStore.saveCurrent();
      expect(saveWorld).toHaveBeenCalledWith('w1', mockWorld);
    });
  });

  describe('deleteWorld', () => {
    it('deletes world and removes from list', async () => {
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'w1', name: 'World One' }]);
      await worldsStore.loadList();
      await worldsStore.deleteWorld('w1');
      expect(deleteWorld).toHaveBeenCalledWith('w1');
      const state = get(worldsStore);
      expect(state.list).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/worlds-store.test.ts`
Expected: FAIL — module `$lib/stores/worlds` does not exist.

- [ ] **Step 3: Create `src/lib/stores/worlds.ts`**

```ts
import { writable, get } from 'svelte/store';
import type { WorldCard } from '$lib/types';
import * as worldStorage from '$lib/storage/worlds';

interface WorldsState {
  list: { id: string; name: string }[];
  currentId: string | null;
  current: WorldCard | null;
  isLoading: boolean;
}

function createWorldsStore() {
  const { subscribe, set, update } = writable<WorldsState>({
    list: [],
    currentId: null,
    current: null,
    isLoading: false,
  });

  return {
    subscribe,

    async loadList() {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const list = await worldStorage.listWorlds();
        update((s) => ({ ...s, list, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async selectWorld(id: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const card = await worldStorage.loadWorld(id);
        update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async saveCurrent() {
      const state = get({ subscribe });
      if (state.currentId && state.current) {
        await worldStorage.saveWorld(state.currentId, state.current);
      }
    },

    async deleteWorld(id: string) {
      await worldStorage.deleteWorld(id);
      update((s) => ({
        ...s,
        list: s.list.filter((w) => w.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },

    clearSelection() {
      update((s) => ({ ...s, currentId: null, current: null }));
    },
  };
}

export const worldsStore = createWorldsStore();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stores/worlds-store.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/worlds.ts tests/stores/worlds-store.test.ts
git commit -m "feat: add worlds store with reactive state"
```

---

### Task 4: Home Page — Characters/Worlds Tabs

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Update the home page to show both Characters and Worlds**

The page needs:
- A tab bar at the top: "Characters" and "Worlds"
- Characters tab: existing character grid (unchanged)
- Worlds tab: world grid linking to `/chat/{world.id}?cardType=world`
- Recent Chats section shows sessions from both characters and worlds

Replace the entire content of `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { charactersStore } from '$lib/stores/characters';
  import { worldsStore } from '$lib/stores/worlds';
  import * as chatStorage from '$lib/storage/chats';
  import type { ChatSession } from '$lib/types';

  interface RecentSession extends ChatSession {
    cardName: string;
  }

  let recentSessions: RecentSession[] = $state([]);
  let activeTab: 'characters' | 'worlds' = $state('characters');

  function relativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  async function loadRecentSessions(): Promise<void> {
    const chatIds = await chatStorage.listChats();
    if (chatIds.length === 0) return;

    const charNames = new Map<string, string>();
    for (const c of $charactersStore.list) charNames.set(c.id, c.name);
    for (const w of $worldsStore.list) charNames.set(w.id, w.name);

    const all: RecentSession[] = [];
    for (const cid of chatIds) {
      const sessions = await chatStorage.listSessions(cid);
      if (sessions.length === 0) continue;

      const latest = sessions.reduce((a, b) =>
        a.lastMessageAt > b.lastMessageAt ? a : b,
      );

      all.push({
        ...latest,
        cardName: charNames.get(cid) ?? cid,
      });
    }

    all.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    recentSessions = all;
  }

  onMount(async () => {
    await charactersStore.loadList();
    await worldsStore.loadList();
    await loadRecentSessions();
  });
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <div class="flex gap-1">
      <button
        onclick={() => activeTab = 'characters'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-none
               {activeTab === 'characters' ? 'bg-surface1 text-text' : 'bg-transparent text-subtext0 hover:text-text'}"
      >
        Characters
      </button>
      <button
        onclick={() => activeTab = 'worlds'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer border-none
               {activeTab === 'worlds' ? 'bg-surface1 text-text' : 'bg-transparent text-subtext0 hover:text-text'}"
      >
        Worlds
      </button>
    </div>
    {#if activeTab === 'characters'}
      <a
        href="/characters"
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender transition-colors"
      >
        + New Chat
      </a>
    {:else}
      <a
        href="/worlds"
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender transition-colors"
      >
        + New World
      </a>
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto p-4">
    {#if activeTab === 'characters'}
      {#if $charactersStore.isLoading}
        <div class="text-center text-subtext0 py-8">Loading...</div>
      {:else if $charactersStore.list.length === 0}
        <div class="text-center text-subtext0 py-8">
          <p class="text-lg mb-2">No characters yet</p>
          <p class="text-sm">Import a character card to get started</p>
          <a
            href="/characters"
            class="inline-block mt-4 px-4 py-2 bg-surface1 text-text rounded-md
                   hover:bg-surface2 transition-colors"
          >
            Go to Characters
          </a>
        </div>
      {:else}
        {#if recentSessions.length > 0 && activeTab === 'characters'}
          <div class="mb-4">
            <h2 class="text-sm font-medium text-subtext0 mb-2 px-1">Recent Chats</h2>
            <div class="grid gap-2">
              {#each recentSessions as session}
                <a
                  href="/chat/{session.characterId}?session={session.id}"
                  class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                         transition-colors border border-surface1"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="text-text font-medium text-sm">{session.cardName}</span>
                      {#if session.cardType === 'world'}
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium">World</span>
                      {/if}
                    </div>
                    <span class="text-subtext1 text-xs shrink-0">{relativeTime(session.lastMessageAt)}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-subtext0 text-xs">{session.name}</span>
                  </div>
                  {#if session.preview}
                    <p class="text-subtext1 text-xs mt-1 truncate">{session.preview}</p>
                  {/if}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <div class="mb-4">
          {#if recentSessions.length > 0}
            <h2 class="text-sm font-medium text-subtext0 mb-2 px-1">Characters</h2>
          {/if}
          <div class="grid gap-3">
            {#each $charactersStore.list as character}
              <a
                href="/chat/{character.id}"
                class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                       transition-colors border border-surface1"
              >
                <span class="text-text font-medium">{character.name}</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    {:else}
      {#if $worldsStore.isLoading}
        <div class="text-center text-subtext0 py-8">Loading...</div>
      {:else if $worldsStore.list.length === 0}
        <div class="text-center text-subtext0 py-8">
          <p class="text-lg mb-2">No worlds yet</p>
          <p class="text-sm">Create a world card to get started</p>
          <a
            href="/worlds"
            class="inline-block mt-4 px-4 py-2 bg-surface1 text-text rounded-md
                   hover:bg-surface2 transition-colors"
          >
            Go to Worlds
          </a>
        </div>
      {:else}
        <div class="grid gap-3">
          {#each $worldsStore.list as world}
            <a
              href="/chat/{world.id}?cardType=world"
              class="block p-3 rounded-lg bg-surface0 hover:bg-surface1
                     transition-colors border border-surface1"
            >
              <div class="flex items-center gap-2">
                <span class="text-text font-medium">{world.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium">World</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`
Expected: No errors in `+page.svelte` (some pre-existing errors OK).

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add Characters/Worlds tabs to home page"
```

---

### Task 5: Worlds List Page

**Files:**
- Create: `src/routes/worlds/+page.svelte`

- [ ] **Step 1: Create `src/routes/worlds/+page.svelte`**

Follow the same pattern as `src/routes/characters/+page.svelte` but for worlds.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { worldsStore } from '$lib/stores/worlds';
  import * as worldStorage from '$lib/storage/worlds';
  import { createDefaultWorldCard } from '$lib/types';

  let error = $state('');

  onMount(() => {
    worldsStore.loadList();
  });

  async function handleCreate() {
    error = '';
    try {
      const card = createDefaultWorldCard();
      card.name = 'New World';
      const id = await worldStorage.createWorld(card);
      goto(`/worlds/${id}/edit`);
    } catch (e: any) {
      error = e?.message || 'Failed to create world';
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete world "${name}"? This cannot be undone.`)) return;
    await worldsStore.deleteWorld(id);
  }

  function handleSelect(id: string) {
    goto(`/chat/${id}?cardType=world`);
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <h1 class="text-lg font-semibold text-text">Worlds</h1>
    <div class="flex gap-2">
      <button
        onclick={handleCreate}
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender transition-colors cursor-pointer border-none"
      >
        + Create
      </button>
    </div>
  </div>

  {#if error}
    <div class="px-4 py-2 bg-red/10 text-red text-sm border-b border-surface0">
      {error}
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto p-4">
    {#if $worldsStore.isLoading}
      <div class="text-center text-subtext0 py-8">Loading...</div>
    {:else if $worldsStore.list.length === 0}
      <div class="text-center text-subtext0 py-8">
        <p class="text-lg mb-2">No worlds yet</p>
        <p class="text-sm mb-4">Create a world card to set up a universe for roleplay</p>
        <button
          onclick={handleCreate}
          class="px-4 py-2 bg-surface1 text-text rounded-md hover:bg-surface2 transition-colors cursor-pointer border-none"
        >
          Create World
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each $worldsStore.list as world (world.id)}
          <div class="group relative">
            <button
              onclick={() => handleSelect(world.id)}
              class="w-full text-left p-3 rounded-lg bg-surface0 hover:bg-surface1
                     transition-colors border border-surface1 cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <span class="text-text font-medium">{world.name}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium">World</span>
              </div>
            </button>
            <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/routes/worlds/+page.svelte
git commit -m "feat: add worlds list page with create and delete"
```

---

### Task 6: World Editor

**Files:**
- Create: `src/routes/worlds/[id]/edit/+page.svelte`

This is a larger file. It follows the same tabbed pattern as the character editor but with world-specific fields.

- [ ] **Step 1: Create `src/routes/worlds/[id]/edit/+page.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { worldsStore } from '$lib/stores/worlds';
  import { createDefaultWorldCard } from '$lib/types';
  import type { WorldCard, WorldCharacter } from '$lib/types';

  let tab = $state<'overview' | 'system' | 'lorebook' | 'characters' | 'scripts' | 'theme'>('overview');
  let card = $state<WorldCard>(createDefaultWorldCard());
  let saving = $state(false);
  let error = $state('');
  let loaded = $state(false);

  const worldId = $derived($page.params.id);

  let tagsText = $state('');
  let newCharName = $state('');
  let newCharDesc = $state('');

  onMount(async () => {
    try {
      await worldsStore.selectWorld(worldId);
      const state = $worldsStore;
      if (state.current) {
        card = { ...state.current };
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
    error = '';
    try {
      card.tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
      await worldsStore.selectWorld(worldId);
      const store = $worldsStore;
      if (store.current) {
        const merged = { ...store.current, ...card };
        await worldsStore.saveCurrent();
      } else {
        const { saveWorld } = await import('$lib/storage/worlds');
        await saveWorld(worldId, card);
      }
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
      description: newCharDesc.trim(),
    };
    card.characters = [...card.characters, char];
    newCharName = '';
    newCharDesc = '';
  }

  function removeCharacter(id: string) {
    card.characters = card.characters.filter(c => c.id !== id);
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'system', label: 'System Prompt' },
    { key: 'lorebook', label: 'Lorebook' },
    { key: 'characters', label: 'Characters' },
    { key: 'scripts', label: 'Scripts' },
    { key: 'theme', label: 'Theme' },
  ] as const;
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <div class="flex items-center gap-3">
      <button onclick={() => goto('/worlds')} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer text-lg">&larr;</button>
      <h1 class="text-lg font-semibold text-text">Edit World</h1>
    </div>
    <div class="flex gap-2">
      <button
        onclick={() => goto(`/chat/${worldId}?cardType=world`)}
        class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
      >
        Chat
      </button>
      <button
        onclick={handleSave}
        disabled={saving}
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 transition-colors cursor-pointer border-none"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="px-4 py-2 bg-red/10 text-red text-sm border-b border-surface0">{error}</div>
  {/if}

  {#if !loaded}
    <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
  {:else}
    <!-- Tab bar -->
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
      <!-- Overview -->
      {#if tab === 'overview'}
        <div class="max-w-2xl space-y-4">
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
            <label class="block text-xs text-subtext0 mb-1">First Message</label>
            <textarea bind:value={card.firstMessage} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Tags</label>
            <input type="text" bind:value={tagsText} placeholder="tag1, tag2, ..." class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Creator Notes</label>
            <textarea bind:value={card.creatorNotes} rows="2" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
          </div>
        </div>

      <!-- System Prompt -->
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
        </div>

      <!-- Lorebook -->
      {:else if tab === 'lorebook'}
        <div class="max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-text">Lorebook Entries</h2>
            <button
              onclick={() => {
                card.lorebook = [...card.lorebook, {
                  id: crypto.randomUUID(),
                  name: 'New Entry',
                  keywords: [],
                  caseSensitive: false,
                  content: '',
                  position: 'before_char',
                  priority: 0,
                  enabled: true,
                  scanDepth: card.loreSettings.scanDepth,
                  scope: 'global',
                  mode: 'normal',
                  constant: false,
                  category: 'misc',
                }];
              }}
              class="px-2 py-1 bg-surface1 text-text rounded text-xs hover:bg-surface2 transition-colors cursor-pointer border-none"
            >
              + Add Entry
            </button>
          </div>
          {#if card.lorebook.length === 0}
            <p class="text-subtext0 text-sm">No lorebook entries yet.</p>
          {:else}
            <div class="space-y-2">
              {#each card.lorebook as entry, i (entry.id)}
                <div class="p-3 rounded-lg bg-surface0 border border-surface1">
                  <div class="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      bind:value={entry.name}
                      class="bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve flex-1 mr-2"
                    />
                    <div class="flex items-center gap-2">
                      <select
                        bind:value={entry.category}
                        class="bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1 cursor-pointer"
                      >
                        <option value="character">Character</option>
                        <option value="region">Region</option>
                        <option value="setting">Setting</option>
                        <option value="misc">Misc</option>
                      </select>
                      <button
                        onclick={() => { card.lorebook = card.lorebook.filter((_, j) => j !== i); }}
                        class="text-red hover:text-red text-xs cursor-pointer bg-transparent border-none"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <textarea
                    bind:value={entry.content}
                    rows="3"
                    class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y"
                    placeholder="Entry content..."
                  ></textarea>
                  <div class="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={entry.keywords.join(', ')}
                      onchange={(e) => { entry.keywords = (e.target as HTMLInputElement).value.split(',').map(k => k.trim()).filter(Boolean); }}
                      class="flex-1 bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
                      placeholder="keywords (comma separated)"
                    />
                    <label class="flex items-center gap-1 text-xs text-subtext0 cursor-pointer">
                      <input type="checkbox" bind:checked={entry.enabled} class="accent-mauve" />
                      Enabled
                    </label>
                    <label class="flex items-center gap-1 text-xs text-subtext0 cursor-pointer">
                      <input type="checkbox" bind:checked={entry.constant} class="accent-mauve" />
                      Constant
                    </label>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- Characters -->
      {:else if tab === 'characters'}
        <div class="max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-text">Characters (OCs)</h2>
          </div>
          <div class="space-y-3 mb-4">
            {#each card.characters as char (char.id)}
              <div class="p-3 rounded-lg bg-surface0 border border-surface1">
                <div class="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    bind:value={char.name}
                    class="bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve font-medium"
                  />
                  <button
                    onclick={() => removeCharacter(char.id)}
                    class="text-red hover:text-red text-xs cursor-pointer bg-transparent border-none"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  bind:value={char.description}
                  rows="2"
                  class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y mb-2"
                  placeholder="Character description..."
                ></textarea>
                <textarea
                  bind:value={char.personality}
                  rows="1"
                  class="w-full bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y"
                  placeholder="Personality traits (optional)..."
                ></textarea>
              </div>
            {/each}
          </div>
          <div class="p-3 rounded-lg bg-surface0 border border-surface1 border-dashed">
            <div class="flex gap-2 mb-2">
              <input
                type="text"
                bind:value={newCharName}
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
            <textarea
              bind:value={newCharDesc}
              rows="2"
              class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y"
              placeholder="Description (optional)..."
            ></textarea>
          </div>
        </div>

      <!-- Scripts -->
      {:else if tab === 'scripts'}
        <div class="max-w-2xl">
          <p class="text-subtext0 text-sm">Regex scripts and triggers — coming soon.</p>
          <div class="mt-4 space-y-2">
            <p class="text-xs text-subtext0">Regex Scripts: {card.regexScripts.length}</p>
            <p class="text-xs text-subtext0">Triggers: {card.triggers.length}</p>
          </div>
        </div>

      <!-- Theme -->
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

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/routes/worlds/[id]/edit/+page.svelte
git commit -m "feat: add world editor with tabbed interface"
```

---

### Task 7: Chat Page — World-Aware Card Loading

**Files:**
- Modify: `src/routes/chat/[id]/+page.svelte`

The chat page needs to detect whether the card ID refers to a character or a world, and load from the correct storage. The `cardType` query param tells us, but we also need fallback detection.

- [ ] **Step 1: Update chat page to handle world cards**

Add imports at the top of the script block:

```ts
import { worldsStore } from '$lib/stores/worlds';
import * as worldStorage from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';
```

Add a `cardType` state variable and update `onMount`:

```ts
let cardType: 'character' | 'world' = $state('character');
```

Update the `onMount` to detect card type:

```ts
onMount(async () => {
  const id = $page.params.id!;
  const type = $page.url.searchParams.get('cardType');
  cardType = type === 'world' ? 'world' : 'character';

  try {
    if (cardType === 'world') {
      await worldsStore.selectWorld(id);
      sessions = await chatStorage.listSessions(id);
      personas = await listPersonas();

      const querySession = $page.url.searchParams.get('session');
      if (querySession && sessions.some((s) => s.id === querySession)) {
        await initChat(id, querySession);
      } else {
        await initChat(id);
        const resolved = $chatStore.sessionId;
        if (resolved && resolved !== querySession) {
          goto(`/chat/${id}?cardType=world&session=${resolved}`, { replaceState: true });
        }
      }
    } else {
      await charactersStore.selectCharacter(id);
      sessions = await chatStorage.listSessions(id);
      personas = await listPersonas();

      const querySession = $page.url.searchParams.get('session');
      if (querySession && sessions.some((s) => s.id === querySession)) {
        await initChat(id, querySession);
      } else {
        await initChat(id);
        const resolved = $chatStore.sessionId;
        if (resolved && resolved !== querySession) {
          goto(`/chat/${id}?session=${resolved}`, { replaceState: true });
        }
      }
    }
  } catch {
    error = 'Failed to load';
  }
});
```

Update `createNewSession` to pass `cardType`:

```ts
goto(`/chat/${characterId}?cardType=${cardType}&session=${session.id}`, { replaceState: true });
```

And `switchSession`:

```ts
const typeParam = cardType === 'world' ? '&cardType=world' : '';
goto(`/chat/${characterId}?session=${newSessionId}${typeParam}`, { replaceState: true });
```

Update TopBar to show world context:

```svelte
<TopBar
  characterName={cardType === 'world' ? ($worldsStore.current?.name ?? 'World') : ($charactersStore.current?.name ?? '')}
  modelName={($settingsStore.providers[$settingsStore.defaultProvider] as any)?.model || ''}
  characterId={$page.params.id}
  isWorld={cardType === 'world'}
/>
```

Update the "else if" condition:

```svelte
{:else if (cardType === 'character' && $charactersStore.current) || (cardType === 'world' && $worldsStore.current)}
```

- [ ] **Step 2: Update TopBar to accept `isWorld` prop**

In `src/lib/components/TopBar.svelte`, add `isWorld` to props and show a badge:

```ts
let {
  characterName,
  modelName,
  characterId,
  isWorld = false,
}: {
  characterName: string;
  modelName: string;
  characterId: string;
  isWorld?: boolean;
} = $props();
```

In the template, after `{characterName}`:

```svelte
{#if isWorld}
  <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium ml-2">World</span>
{/if}
```

- [ ] **Step 3: Update `initChat` and `injectFirstMessage` to handle worlds**

In `src/lib/core/chat/use-chat.ts`, update `injectFirstMessage` to accept world cards:

```ts
export async function injectFirstMessage(worldCard?: import('$lib/types/world').WorldCard): Promise<void> {
  const state = get(chatStore);
  if (state.messages.length === 0) {
    const firstMsg = worldCard?.firstMessage || get(charactersStore).current?.firstMessage;
    if (firstMsg) {
      const greeting: Message = {
        role: 'assistant',
        content: firstMsg,
        type: 'dialogue',
        timestamp: Date.now(),
        isFirstMessage: true,
      };
      chatStore.addMessage(greeting);
      await chatStore.save();
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run 2>&1 | tail -10`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/chat/[id]/+page.svelte src/lib/components/TopBar.svelte src/lib/core/chat/use-chat.ts
git commit -m "feat: world-aware chat page with card type detection"
```

---

### Task 8: Prompt Assembly — World Support

**Files:**
- Modify: `src/lib/core/chat/prompt-assembler.ts`
- Modify: `src/lib/core/chat/engine.ts`

The prompt assembler needs to handle `WorldCard` data. When a world card is active, `personality` resolves to empty, and world characters are injected as synthetic lorebook entries.

- [ ] **Step 1: Update `AssemblyContext` to accept world data**

In `src/lib/core/chat/prompt-assembler.ts`, update the interface:

```ts
import type { WorldCard } from '$lib/types/world';

export interface AssemblyContext {
  card: CharacterCard;
  scene: SceneState;
  messages: Message[];
  lorebookMatches: LorebookEntry[];
  persona?: UserPersona;
  worldCard?: WorldCard;
}
```

- [ ] **Step 2: Add world character injection to lorebook matching**

In `src/lib/core/chat/lorebook.ts` (or wherever `matchLorebook` is called from `engine.ts`), before calling `matchLorebook`, inject synthetic lorebook entries for world characters.

In `src/lib/core/chat/engine.ts`, add a helper:

```ts
function buildWorldCharacterLore(worldCard: WorldCard): LorebookEntry[] {
  return worldCard.characters.map(char => ({
    id: `__world_char_${char.id}`,
    name: char.name,
    keywords: [char.name.toLowerCase()],
    caseSensitive: false,
    content: [char.name, char.description, char.personality].filter(Boolean).join('\n'),
    position: 'before_char' as const,
    priority: 0,
    enabled: true,
    scanDepth: worldCard.loreSettings.scanDepth,
    scope: 'global' as const,
    mode: 'normal' as const,
    constant: true,
    category: 'character' as const,
  }));
}
```

When `worldCard` is present in the chat context, merge these synthetic entries into the lorebook before matching.

- [ ] **Step 3: Update `buildTemplateVars` to handle world cards**

```ts
function buildTemplateVars(
  card: CharacterCard,
  scene: SceneState,
  slot: string,
  persona?: UserPersona,
  worldCard?: WorldCard,
): TemplateVariables {
  return {
    char: worldCard?.name || card.name,
    user: persona?.name || 'User',
    description: worldCard?.description || card.description,
    personality: worldCard ? '' : card.personality,
    scenario: worldCard?.scenario || card.scenario,
    exampleMessages: worldCard ? '' : card.exampleMessages,
    slot,
    sceneLocation: scene.location || '',
    sceneTime: scene.time || '',
    sceneMood: scene.mood || '',
    variables: scene.variables || {},
    userPersona: persona?.shortDescription || '',
    userDescription: persona?.detailedSettings || '',
    userExampleDialogue: persona?.exampleDialogue || '',
  };
}
```

Update all calls to `buildTemplateVars` to pass `ctx.worldCard`.

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run tests/core/chat/prompt-assembler.test.ts tests/core/chat/engine.test.ts`
Expected: All existing tests pass (they don't pass `worldCard`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/prompt-assembler.ts src/lib/core/chat/engine.ts
git commit -m "feat: world-aware prompt assembly with synthetic character lore"
```

---

### Task 9: Full Test Suite Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`
Expected: No new errors beyond pre-existing ones.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve world cards integration issues"
```
