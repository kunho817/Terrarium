# Memory Inspector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a side panel that lets users browse, search, filter, edit, add, and delete AI memories for the current session, plus view and manage session summaries.

**Architecture:** New storage functions for update/delete of memories and summaries. Three Svelte components: MemoryPanel (container with tabs), MemoryCard (single memory display/edit), SummaryList (summary list with edit). Trigger button added to SceneInfoBar. Wired into the chat page.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest, SQLite (sql.js), Tailwind/Catppuccin

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/storage/memories.ts` | Add `updateMemory`, `deleteSummary`, `updateSummary` |
| `src/lib/components/MemoryPanel.svelte` | **New** — side panel container with Memories/Summaries tabs |
| `src/lib/components/MemoryCard.svelte` | **New** — single memory display/edit card |
| `src/lib/components/SummaryList.svelte` | **New** — summary list with inline editing |
| `src/lib/components/SceneInfoBar.svelte` | Add memory inspector trigger button |
| `src/routes/chat/[id]/+page.svelte` | Wire panel state and handlers |
| `tests/storage/memories.test.ts` | Add tests for new storage functions |

---

### Task 1: Storage Functions + Tests

**Files:**
- Modify: `src/lib/storage/memories.ts`
- Modify: `tests/storage/memories.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/storage/memories.test.ts`:

```typescript
describe('updateMemory', () => {
  it('updates content and importance', async () => {
    await insertMemory({
      id: 'mem-1',
      sessionId: makeSessionId('sess-1'),
      type: 'event',
      content: 'original',
      importance: 0.5,
      sourceMessageIds: [],
      turnNumber: 1,
      createdAt: Date.now(),
      embedding: [0.1, 0.2],
    });

    await updateMemory('mem-1', { content: 'updated', importance: 0.9 });

    const memories = await getMemoriesForSession('sess-1');
    expect(memories).toHaveLength(1);
    expect(memories[0].content).toBe('updated');
    expect(memories[0].importance).toBe(0.9);
  });

  it('updates type', async () => {
    await insertMemory({
      id: 'mem-2',
      sessionId: makeSessionId('sess-2'),
      type: 'event',
      content: 'test',
      importance: 0.5,
      sourceMessageIds: [],
      turnNumber: 1,
      createdAt: Date.now(),
      embedding: [],
    });

    await updateMemory('mem-2', { type: 'trait' });

    const memories = await getMemoriesForSession('sess-2');
    expect(memories[0].type).toBe('trait');
  });
});

describe('summary CRUD', () => {
  it('updateSummary changes summary text', async () => {
    await insertSummary({
      id: 'sum-1',
      sessionId: makeSessionId('sess-1'),
      startTurn: 1,
      endTurn: 5,
      summary: 'original summary',
      createdAt: Date.now(),
    });

    await updateSummary('sum-1', { summary: 'updated summary' });

    const summaries = await getSummariesForSession('sess-1');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].summary).toBe('updated summary');
  });

  it('deleteSummary removes a summary', async () => {
    await insertSummary({
      id: 'sum-2',
      sessionId: makeSessionId('sess-2'),
      startTurn: 1,
      endTurn: 3,
      summary: 'to delete',
      createdAt: Date.now(),
    });

    await deleteSummary('sum-2');

    const summaries = await getSummariesForSession('sess-2');
    expect(summaries).toHaveLength(0);
  });
});
```

**Important:** These tests use real SQLite (via the `db.ts` mock or in-memory). Check how existing tests in this file mock `getDb`. If they mock it, follow the same pattern. If they use the real DB, follow that.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/storage/memories.test.ts`
Expected: FAIL — `updateMemory`, `updateSummary`, `deleteSummary` not defined

- [ ] **Step 3: Implement the three functions**

Add to `src/lib/storage/memories.ts`, after the existing `countMemories` function:

```typescript
export async function updateMemory(
	id: string,
	patch: { content?: string; importance?: number; type?: MemoryType },
): Promise<void> {
	const db = await getDb();
	const sets: string[] = [];
	const values: unknown[] = [];
	if (patch.content !== undefined) { sets.push('content = ?'); values.push(patch.content); }
	if (patch.importance !== undefined) { sets.push('importance = ?'); values.push(patch.importance); }
	if (patch.type !== undefined) { sets.push('type = ?'); values.push(patch.type); }
	if (!sets.length) return;
	values.push(id);
	db.run(`UPDATE memories SET ${sets.join(', ')} WHERE id = ?`, values);
	try { await persist(); } catch {}
}

export async function deleteSummary(id: string): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM summaries WHERE id = ?', [id]);
	try { await persist(); } catch {}
}

export async function updateSummary(
	id: string,
	patch: { summary?: string },
): Promise<void> {
	const db = await getDb();
	const sets: string[] = [];
	const values: unknown[] = [];
	if (patch.summary !== undefined) { sets.push('summary = ?'); values.push(patch.summary); }
	if (!sets.length) return;
	values.push(id);
	db.run(`UPDATE summaries SET ${sets.join(', ')} WHERE id = ?`, values);
	try { await persist(); } catch {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/storage/memories.test.ts`
Expected: All tests pass

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: 832+ tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/memories.ts tests/storage/memories.test.ts
git commit -m "feat: add updateMemory, updateSummary, deleteSummary storage functions"
```

---

### Task 2: MemoryCard Component

**Files:**
- Create: `src/lib/components/MemoryCard.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import type { MemoryType } from '$lib/types/memory';

  type MemoryView = {
    id: string;
    type: MemoryType;
    content: string;
    importance: number;
    turnNumber: number;
    createdAt: number;
  };

  let {
    memory,
    onupdate,
    ondelete,
  }: {
    memory: MemoryView;
    onupdate: (id: string, patch: { content?: string; importance?: number; type?: MemoryType }) => void;
    ondelete: (id: string) => void;
  } = $props();

  let expanded = $state(false);
  let editContent = $state(memory.content);
  let editImportance = $state(memory.importance);
  let editType = $state<MemoryType>(memory.type);

  const typeColors: Record<MemoryType, string> = {
    event: 'text-blue',
    trait: 'text-green',
    relationship: 'text-pink',
    location: 'text-yellow',
    state: 'text-mauve',
  };

  function toggle() {
    expanded = !expanded;
    if (expanded) {
      editContent = memory.content;
      editImportance = memory.importance;
      editType = memory.type;
    }
  }

  function save() {
    onupdate(memory.id, {
      content: editContent,
      importance: editImportance,
      type: editType,
    });
    expanded = false;
  }

  function remove() {
    ondelete(memory.id);
  }

  let importancePercent = $derived(Math.round(memory.importance * 100));
</script>

<button
  class="w-full text-left bg-surface0 rounded-lg border border-surface1 p-3 hover:border-surface2 transition-colors"
  onclick={toggle}
>
  <div class="flex items-start justify-between gap-2">
    <div class="flex-1 min-w-0">
      {#if !expanded}
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-medium {typeColors[memory.type]}">{memory.type}</span>
          <div class="flex-1 h-1 bg-surface1 rounded-full overflow-hidden">
            <div class="h-full bg-lavender rounded-full" style="width: {importancePercent}%"></div>
          </div>
          <span class="text-xs text-subtext0">{importancePercent}%</span>
        </div>
        <p class="text-sm text-text truncate">{memory.content}</p>
        <p class="text-xs text-subtext0 mt-1">Turn {memory.turnNumber} · {new Date(memory.createdAt).toLocaleString()}</p>
      {:else}
        <div class="space-y-3" onclick|stopPropagation>
          <div>
            <label class="text-xs text-subtext0">Type</label>
            <select
              bind:value={editType}
              class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 mt-1"
            >
              <option value="event">event</option>
              <option value="trait">trait</option>
              <option value="relationship">relationship</option>
              <option value="location">location</option>
              <option value="state">state</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-subtext0">Content</label>
            <textarea
              bind:value={editContent}
              class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 mt-1 resize-y min-h-[60px]"
            ></textarea>
          </div>
          <div>
            <label class="text-xs text-subtext0">Importance: {Math.round(editImportance * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={editImportance}
              class="w-full mt-1"
            />
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick={save}
              class="text-xs text-green bg-transparent border border-green/30 rounded px-2 py-1 hover:bg-green/10"
            >Save</button>
            <button
              onclick={remove}
              class="text-xs text-red bg-transparent border border-red/30 rounded px-2 py-1 hover:bg-red/10"
            >Delete</button>
            <button
              onclick={() => expanded = false}
              class="text-xs text-subtext0 bg-transparent border-none hover:text-text"
            >Cancel</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</button>
```

**Note:** The `onclick|stopPropagation` syntax prevents the outer button toggle from firing when clicking inside the edit form. In Svelte 5, use `onclick={(e) => e.stopPropagation()}` instead. Replace `onclick|stopPropagation` with `onclick={(e) => e.stopPropagation()}`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoryCard.svelte
git commit -m "feat: add MemoryCard component for memory display/edit"
```

---

### Task 3: SummaryList Component

**Files:**
- Create: `src/lib/components/SummaryList.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import type { SessionSummary } from '$lib/types/memory';

  let {
    summaries,
    onupdate,
    ondelete,
  }: {
    summaries: SessionSummary[];
    onupdate: (id: string, patch: { summary: string }) => void;
    ondelete: (id: string) => void;
  } = $props();

  let expandedId = $state<string | null>(null);
  let editText = $state('');

  function toggle(id: string, currentText: string) {
    if (expandedId === id) {
      expandedId = null;
    } else {
      expandedId = id;
      editText = currentText;
    }
  }

  function save(id: string) {
    onupdate(id, { summary: editText });
    expandedId = null;
  }
</script>

{#if summaries.length === 0}
  <div class="text-center text-subtext0 text-sm py-8">No summaries yet</div>
{:else}
  <div class="space-y-2">
    {#each summaries as summary}
      <div class="bg-surface0 rounded-lg border border-surface1 p-3">
        <button
          class="w-full text-left bg-transparent border-none cursor-pointer"
          onclick={() => toggle(summary.id, summary.summary)}
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-subtext0">Turns {summary.startTurn}–{summary.endTurn}</span>
            <span class="text-xs text-subtext0">{new Date(summary.createdAt).toLocaleString()}</span>
          </div>
          {#if expandedId !== summary.id}
            <p class="text-sm text-text line-clamp-2">{summary.summary}</p>
          {/if}
        </button>

        {#if expandedId === summary.id}
          <div class="mt-2 space-y-2">
            <textarea
              bind:value={editText}
              class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 resize-y min-h-[80px]"
            ></textarea>
            <div class="flex items-center gap-2">
              <button
                onclick={() => save(summary.id)}
                class="text-xs text-green bg-transparent border border-green/30 rounded px-2 py-1 hover:bg-green/10"
              >Save</button>
              <button
                onclick={() => ondelete(summary.id)}
                class="text-xs text-red bg-transparent border border-red/30 rounded px-2 py-1 hover:bg-red/10"
              >Delete</button>
              <button
                onclick={() => expandedId = null}
                class="text-xs text-subtext0 bg-transparent border-none hover:text-text"
              >Cancel</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/SummaryList.svelte
git commit -m "feat: add SummaryList component for summary display/edit"
```

---

### Task 4: MemoryPanel Component

**Files:**
- Create: `src/lib/components/MemoryPanel.svelte`

This is the main container. It loads data, provides search/filter, handles the Memories/Summaries tab, and wires CRUD operations.

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getMemoriesForSession,
    getSummariesForSession,
    updateMemory,
    deleteMemory,
    insertMemory,
    updateSummary,
    deleteSummary,
  } from '$lib/storage/memories';
  import type { MemoryType } from '$lib/types/memory';
  import type { MemoryRecord, SessionSummary } from '$lib/types/memory';
  import { makeSessionId } from '$lib/types/branded';
  import MemoryCard from './MemoryCard.svelte';
  import SummaryList from './SummaryList.svelte';

  let {
    sessionId,
    onclose,
  }: {
    sessionId: string;
    onclose: () => void;
  } = $props();

  type MemoryView = { id: string; type: MemoryType; content: string; importance: number; turnNumber: number; createdAt: number };

  let tab = $state<'memories' | 'summaries'>('memories');
  let memories = $state<MemoryView[]>([]);
  let summaries = $state<SessionSummary[]>([]);
  let searchQuery = $state('');
  let typeFilter = $state<Set<MemoryType>>(new Set());
  let sortBy = $state<'importance' | 'recency'>('recency');
  let showAddForm = $state(false);
  let newContent = $state('');
  let newType = $state<MemoryType>('event');
  let newImportance = $state(0.7);

  const allTypes: MemoryType[] = ['event', 'trait', 'relationship', 'location', 'state'];

  async function load() {
    try {
      const mems = await getMemoriesForSession(sessionId);
      const sums = await getSummariesForSession(sessionId);
      memories = mems.map(m => ({ id: m.id, type: m.type, content: m.content, importance: m.importance, turnNumber: m.turnNumber, createdAt: m.createdAt }));
      summaries = sums;
    } catch {
      memories = [];
      summaries = [];
    }
  }

  onMount(load);

  function toggleType(t: MemoryType) {
    const next = new Set(typeFilter);
    if (next.has(t)) next.delete(t); else next.add(t);
    typeFilter = next;
  }

  let filteredMemories = $derived.by(() => {
    let result = memories;
    if (typeFilter.size > 0) {
      result = result.filter(m => typeFilter.has(m.type));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => m.content.toLowerCase().includes(q));
    }
    if (sortBy === 'importance') {
      result = [...result].sort((a, b) => b.importance - a.importance);
    } else {
      result = [...result].sort((a, b) => b.createdAt - a.createdAt);
    }
    return result;
  });

  async function handleUpdate(id: string, patch: { content?: string; importance?: number; type?: MemoryType }) {
    await updateMemory(id, patch);
    await load();
  }

  async function handleDelete(id: string) {
    await deleteMemory(id);
    await load();
  }

  async function handleAddMemory() {
    if (!newContent.trim()) return;
    await insertMemory({
      id: crypto.randomUUID(),
      sessionId: makeSessionId(sessionId),
      type: newType,
      content: newContent.trim(),
      importance: newImportance,
      sourceMessageIds: [],
      turnNumber: 0,
      createdAt: Date.now(),
      embedding: new Array(128).fill(0),
    });
    newContent = '';
    newType = 'event';
    newImportance = 0.7;
    showAddForm = false;
    await load();
  }

  async function handleUpdateSummary(id: string, patch: { summary: string }) {
    await updateSummary(id, patch);
    await load();
  }

  async function handleDeleteSummary(id: string) {
    await deleteSummary(id);
    await load();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex justify-end bg-overlay/50"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-96 h-full bg-mantle border-l border-surface0 flex flex-col shadow-xl"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface0">
      <h2 class="text-sm font-semibold text-text">Memory Inspector</h2>
      <button
        onclick={onclose}
        class="text-subtext0 hover:text-text text-lg bg-transparent border-none cursor-pointer"
      >✕</button>
    </div>

    <div class="flex border-b border-surface0">
      <button
        onclick={() => tab = 'memories'}
        class="flex-1 text-xs py-2 bg-transparent border-none cursor-pointer {tab === 'memories' ? 'text-text border-b-2 border-lavender' : 'text-subtext0'}"
      >Memories ({memories.length})</button>
      <button
        onclick={() => tab = 'summaries'}
        class="flex-1 text-xs py-2 bg-transparent border-none cursor-pointer {tab === 'summaries' ? 'text-text border-b-2 border-lavender' : 'text-subtext0'}"
      >Summaries ({summaries.length})</button>
    </div>

    {#if tab === 'memories'}
      <div class="p-3 border-b border-surface0 space-y-2">
        <div class="flex items-center gap-2">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search memories..."
            class="flex-1 bg-surface0 text-text text-xs px-2 py-1.5 rounded border border-surface1 focus:outline-none focus:border-mauve"
          />
          <button
            onclick={() => sortBy = sortBy === 'importance' ? 'recency' : 'importance'}
            class="text-xs text-subtext0 hover:text-text bg-surface0 border border-surface1 rounded px-2 py-1.5 cursor-pointer"
          >{sortBy === 'importance' ? '★' : '🕐'}</button>
        </div>
        <div class="flex flex-wrap gap-1">
          {#each allTypes as t}
            <button
              onclick={() => toggleType(t)}
              class="text-xs px-2 py-0.5 rounded-full border cursor-pointer {typeFilter.has(t) ? 'bg-lavender/20 border-lavender text-lavender' : 'bg-transparent border-surface1 text-subtext0 hover:text-text'}"
            >{t}</button>
          {/each}
        </div>
        <button
          onclick={() => showAddForm = !showAddForm}
          class="text-xs text-green bg-transparent border-none cursor-pointer hover:text-lavender"
        >+ Add Memory</button>
        {#if showAddForm}
          <div class="bg-surface0 rounded-lg p-3 space-y-2">
            <textarea
              bind:value={newContent}
              placeholder="Memory content..."
              class="w-full bg-surface1 text-text text-xs px-2 py-1.5 rounded border border-surface1 resize-y min-h-[50px] focus:outline-none focus:border-mauve"
            ></textarea>
            <div class="flex items-center gap-2">
              <select
                bind:value={newType}
                class="bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1"
              >
                {#each allTypes as t}
                  <option value={t}>{t}</option>
                {/each}
              </select>
              <div class="flex-1 flex items-center gap-1">
                <input type="range" min="0" max="1" step="0.05" bind:value={newImportance} class="flex-1" />
                <span class="text-xs text-subtext0">{Math.round(newImportance * 100)}%</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick={handleAddMemory} class="text-xs text-green bg-transparent border border-green/30 rounded px-2 py-1 hover:bg-green/10 cursor-pointer">Add</button>
              <button onclick={() => showAddForm = false} class="text-xs text-subtext0 bg-transparent border-none hover:text-text cursor-pointer">Cancel</button>
            </div>
          </div>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        {#if filteredMemories.length === 0}
          <div class="text-center text-subtext0 text-sm py-8">{memories.length === 0 ? 'No memories yet' : 'No matching memories'}</div>
        {:else}
          {#each filteredMemories as memory (memory.id)}
            <MemoryCard {memory} onupdate={handleUpdate} ondelete={handleDelete} />
          {/each}
        {/if}
      </div>
    {:else}
      <div class="flex-1 overflow-y-auto p-3">
        <SummaryList summaries={summaries} onupdate={handleUpdateSummary} ondelete={handleDeleteSummary} />
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoryPanel.svelte
git commit -m "feat: add MemoryPanel side panel component"
```

---

### Task 5: Wire Trigger Button and Panel into Chat Page

**Files:**
- Modify: `src/lib/components/SceneInfoBar.svelte`
- Modify: `src/routes/chat/[id]/+page.svelte`

- [ ] **Step 1: Add trigger button to SceneInfoBar**

Add an `onopenmemory` prop to `src/lib/components/SceneInfoBar.svelte`. Current script:

```svelte
<script lang="ts">
  let { location = '', time = '', mood = '' } = $props<{
    location?: string;
    time?: string;
    mood?: string;
  }>();
</script>
```

Change to:

```svelte
<script lang="ts">
  let { location = '', time = '', mood = '', onopenmemory }: {
    location?: string;
    time?: string;
    mood?: string;
    onopenmemory?: () => void;
  } = $props();
</script>
```

Find the closing `</div>` of the SceneInfoBar (the container div with `flex items-center`). Before it closes, add:

```svelte
    {#if onopenmemory}
      <button
        onclick={onopenmemory}
        class="ml-auto text-xs text-subtext0 hover:text-lavender bg-transparent border-none cursor-pointer"
        title="Memory Inspector"
      >🧠</button>
    {/if}
```

- [ ] **Step 2: Add import and state to +page.svelte**

Add import after existing component imports:

```typescript
  import MemoryPanel from '$lib/components/MemoryPanel.svelte';
```

Add state variable after `let showSessionPanel = $state(false);`:

```typescript
  let showMemoryPanel = $state(false);
```

- [ ] **Step 3: Wire onopenmemory prop to SceneInfoBar**

Find the `<SceneInfoBar` usage in the template and add the `onopenmemory` prop:

```svelte
    <SceneInfoBar
      location={$sceneStore.location}
      time={$sceneStore.time}
      mood={$sceneStore.mood}
      onopenmemory={() => showMemoryPanel = true}
    />
```

- [ ] **Step 4: Add MemoryPanel to template**

After the `{#if showSessionPanel}...{/if}` block (and after `<AgentPipelineIndicator />`), add:

```svelte
  {#if showMemoryPanel}
    <MemoryPanel
      sessionId={currentSessionId ?? ''}
      onclose={() => showMemoryPanel = false}
    />
  {/if}
```

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/SceneInfoBar.svelte src/routes/chat/[id]/+page.svelte
git commit -m "feat: wire MemoryPanel trigger and state into chat page"
```

---

### Task 6: Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify git status**

Run: `git status`
Expected: All changes committed
