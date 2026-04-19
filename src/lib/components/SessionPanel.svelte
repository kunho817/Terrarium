<script lang="ts">
  import type { ChatSession } from '$lib/types';
  import type { UserPersona } from '$lib/types/persona';
  import SessionItem from './SessionItem.svelte';

  let {
    sessions,
    archivedSessions = [],
    activeSessionId,
    personas,
    onselect,
    onrename,
    ondelete,
    oncreate,
    onclose,
    onsetpersona,
    onpin,
    onexport,
    onarchive,
    onrestore,
    onpermanentlyDelete,
    memoryCounts = new Map<string, number>(),
  }: {
    sessions: ChatSession[];
    archivedSessions?: ChatSession[];
    activeSessionId: string | null;
    personas: { id: string; name: string }[];
    memoryCounts?: Map<string, number>;
    onselect: (id: string) => void;
    onrename: (id: string, name: string) => void;
    ondelete: (id: string) => void;
    oncreate: (name?: string) => void;
    onclose: () => void;
    onsetpersona: (id: string, personaId: string | undefined) => void;
    onpin: (id: string, pinned: boolean) => void;
    onexport: (id: string) => void;
    onarchive: (id: string) => void;
    onrestore: (id: string) => void;
    onpermanentlyDelete: (id: string) => void;
  } = $props();

  let searchQuery = $state('');
  let showArchive = $state(false);
  let showNewSessionInput = $state(false);
  let newSessionName = $state('');

  const filteredSessions = $derived.by(() => {
    let result = sessions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q));
    }
    const pinned = result.filter(s => s.pinnedAt).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
    const unpinned = result.filter(s => !s.pinnedAt).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return [...pinned, ...unpinned];
  });

  const filteredArchived = $derived.by(() => {
    if (!searchQuery.trim()) return archivedSessions;
    const q = searchQuery.toLowerCase();
    return archivedSessions.filter(s => s.name.toLowerCase().includes(q));
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex justify-end bg-overlay/50"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-80 h-full bg-mantle border-l border-surface0 flex flex-col shadow-xl"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface0">
      <h2 class="text-text text-sm font-semibold">Sessions</h2>
      <button
        onclick={onclose}
        class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-1"
        aria-label="Close"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>

    <div class="px-4 pb-2">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search sessions..."
        class="w-full bg-surface0 text-text text-sm px-3 py-1.5 rounded-lg border border-surface1 focus:outline-none focus:border-mauve placeholder:text-subtext0"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      {#if showNewSessionInput}
        <div class="flex gap-1 p-2">
          <input
            type="text"
            bind:value={newSessionName}
            placeholder="Session name..."
            class="flex-1 bg-surface0 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
            onkeydown={(e) => {
              if (e.key === 'Enter') { oncreate(newSessionName.trim() || undefined); showNewSessionInput = false; newSessionName = ''; }
              if (e.key === 'Escape') { showNewSessionInput = false; newSessionName = ''; }
            }}
          />
          <button onclick={() => { oncreate(newSessionName.trim() || undefined); showNewSessionInput = false; newSessionName = ''; }} class="text-xs text-green bg-transparent border-none cursor-pointer">✓</button>
        </div>
      {/if}

      {#if filteredSessions.length === 0}
        <div class="text-center text-subtext0 text-sm py-8">No sessions found</div>
      {:else}
        {#each filteredSessions as session}
          <SessionItem
            {session}
            isActive={session.id === activeSessionId}
            {personas}
            memoryCount={memoryCounts.get(session.id) ?? 0}
            {onselect}
            {onrename}
            ondelete={onarchive}
            {onsetpersona}
            {onpin}
            {onexport}
          />
        {/each}
      {/if}

      {#if archivedSessions.length > 0}
        <div class="mt-4 border-t border-surface1 pt-2">
          <button
            onclick={() => showArchive = !showArchive}
            class="w-full text-left text-xs text-subtext0 hover:text-text bg-transparent border-none cursor-pointer px-2 py-1"
          >
            Archived ({archivedSessions.length}) {showArchive ? '▲' : '▼'}
          </button>
          {#if showArchive}
            {#each filteredArchived as session}
              <SessionItem
                {session}
                isActive={false}
                {personas}
                memoryCount={memoryCounts.get(session.id) ?? 0}
                onselect={onrestore}
                {onrename}
                ondelete={onpermanentlyDelete}
                {onsetpersona}
                {onpin}
                {onexport}
              />
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    <div class="p-3 border-t border-surface0">
      <button
        onclick={() => showNewSessionInput = true}
        class="w-full text-sm text-green hover:text-lavender bg-transparent border border-surface1 rounded-lg px-3 py-2 cursor-pointer hover:bg-surface0 transition-colors"
      >
        + New Session
      </button>
    </div>
  </div>
</div>
