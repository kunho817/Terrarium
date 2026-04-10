<script lang="ts">
  import type { LorebookEntry } from '$lib/types/lorebook';
  import LorebookEntryForm from './LorebookEntryForm.svelte';

  let { entries, onchange } = $props<{
    entries: LorebookEntry[];
    onchange: (entries: LorebookEntry[]) => void;
  }>();

  let expandedIds = $state<Set<string>>(new Set());

  function createEntry(): LorebookEntry {
    return {
      id: crypto.randomUUID(),
      name: 'New Entry',
      keywords: [],
      secondaryKeywords: [],
      regex: '',
      content: '',
      position: 'before_char',
      priority: 10,
      mode: 'normal',
      scope: 'global',
      enabled: true,
      caseSensitive: false,
      activationPercent: 100,
      scanDepth: 2,
      constant: false,
    };
  }

  function addEntry() {
    const newEntry = createEntry();
    const next = [...entries, newEntry];
    expandedIds = new Set([...expandedIds, newEntry.id]);
    onchange(next);
  }

  function updateEntry(index: number, updated: LorebookEntry) {
    const next = [...entries];
    next[index] = updated;
    onchange(next);
  }

  function removeEntry(index: number) {
    const removed = entries[index];
    const next = entries.filter((_: LorebookEntry, i: number) => i !== index);
    const ids = new Set(expandedIds);
    ids.delete(removed.id);
    expandedIds = ids;
    onchange(next);
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

  function expandAll() {
    expandedIds = new Set(entries.map((e: LorebookEntry) => e.id));
  }

  function collapseAll() {
    expandedIds = new Set();
  }
</script>

<div class="flex flex-col gap-2">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-medium text-text">Entries</h3>
      <span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-subtext0">
        {entries.length}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={expandAll}
        class="px-2 py-1 rounded text-xs text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
      >
        Expand All
      </button>
      <button
        type="button"
        onclick={collapseAll}
        class="px-2 py-1 rounded text-xs text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
      >
        Collapse All
      </button>
      <button
        type="button"
        onclick={addEntry}
        class="px-3 py-1 rounded text-xs font-medium bg-mauve text-crust hover:bg-lavender transition-colors"
      >
        + Add Entry
      </button>
    </div>
  </div>

  <!-- Entry list -->
  {#each entries as entry, index (entry.id)}
    {@const isExpanded = expandedIds.has(entry.id)}
    <div class="rounded-lg border border-surface1 bg-crust overflow-hidden">
      <!-- Card header (always visible) -->
      <button
        type="button"
        onclick={() => toggleExpand(entry.id)}
        class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface0 transition-colors"
      >
        <span class="text-xs text-overlay0 transition-transform" class:rotate-90={isExpanded}>
          &#9654;
        </span>
        <span class="text-sm text-text flex-1 truncate">
          {entry.name || 'Untitled'}
        </span>
        {#if !entry.enabled}
          <span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-overlay0">Disabled</span>
        {/if}
        {#if entry.constant}
          <span class="text-xs px-1.5 py-0.5 rounded bg-blue/20 text-blue">Constant</span>
        {/if}
        <span class="text-xs text-overlay0">P:{entry.priority}</span>
      </button>

      <!-- Expanded form -->
      {#if isExpanded}
        <div class="px-3 pb-3 border-t border-surface1">
          <LorebookEntryForm
            {entry}
            onchange={(updated) => updateEntry(index, updated)}
            onremove={() => removeEntry(index)}
          />
        </div>
      {/if}
    </div>
  {:else}
    <p class="text-xs text-overlay0 text-center py-4">No entries yet. Click "Add Entry" to start.</p>
  {/each}
</div>
