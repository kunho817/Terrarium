<script lang="ts">
  import type { ChatSession } from '$lib/types';
  import type { UserPersona } from '$lib/types/persona';

  let {
    session,
    isActive,
    personas,
    onselect,
    onrename,
    ondelete,
    onsetpersona,
  }: {
    session: ChatSession;
    isActive: boolean;
    personas: { id: string; name: string }[];
    onselect: (id: string) => void;
    onrename: (id: string, name: string) => void;
    ondelete: (id: string) => void;
    onsetpersona: (id: string, personaId: string | undefined) => void;
  } = $props();

  let editing = $state(false);
  let editName = $state('');
  let showPersonaSelect = $state(false);

  function startRename() {
    editName = session.name;
    editing = true;
  }

  function saveRename() {
    if (editName.trim() && editName !== session.name) {
      onrename(session.id, editName.trim());
    }
    editing = false;
  }

  function handleDelete() {
    if (confirm(`Delete "${session.name}"?`)) {
      ondelete(session.id);
    }
  }

  const linkedPersonaName = $derived(
    session.personaId
      ? personas.find(p => p.id === session.personaId)?.name ?? '(unknown)'
      : '(none)',
  );

  const dateStr = $derived(
    new Date(session.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  );
</script>

<div
  class="p-3 rounded-lg transition-colors cursor-pointer {isActive ? 'bg-surface2' : 'hover:bg-surface0'}"
  onclick={() => onselect(session.id)}
>
  <div class="flex items-start justify-between gap-2">
    {#if editing}
      <div class="flex-1 flex gap-1" onclick={(e) => e.stopPropagation()}>
        <input
          type="text"
          bind:value={editName}
          class="flex-1 bg-surface0 text-text text-sm px-2 py-0.5 rounded border border-surface1 focus:outline-none focus:border-mauve"
          onkeydown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') editing = false; }}
        />
        <button onclick={saveRename} class="text-xs text-green hover:text-lavender cursor-pointer bg-transparent border-none p-0">✓</button>
      </div>
    {:else}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          {#if isActive}
            <span class="w-1.5 h-1.5 rounded-full bg-lavender shrink-0"></span>
          {/if}
          <span class="text-sm text-text font-medium truncate">{session.name}</span>
        </div>
        {#if session.preview}
          <p class="text-xs text-subtext0 mt-0.5 truncate">{session.preview}</p>
        {/if}
        <div class="flex items-center gap-2 mt-1">
          <span class="text-[10px] text-subtext0">{dateStr}</span>
          <button
            onclick={(e) => { e.stopPropagation(); showPersonaSelect = !showPersonaSelect; }}
            class="text-[11px] text-lavender hover:text-text bg-surface0 hover:bg-surface1 border border-surface1 hover:border-surface2 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
          >
            Persona: {linkedPersonaName}
          </button>
        </div>
      </div>

      <div class="flex gap-1 shrink-0" onclick={(e) => e.stopPropagation()}>
        <button onclick={startRename} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-0.5" title="Rename">✎</button>
        <button onclick={handleDelete} class="text-subtext0 hover:text-red bg-transparent border-none cursor-pointer p-0.5" title="Delete">✕</button>
      </div>
    {/if}
  </div>

  {#if showPersonaSelect}
    <div class="mt-2 pt-2 border-t border-surface1" onclick={(e) => e.stopPropagation()}>
      <select
        class="w-full bg-surface0 text-text text-xs rounded px-2 py-1 border border-surface1 focus:outline-none focus:border-mauve cursor-pointer"
        value={session.personaId ?? ''}
        onchange={(e) => {
          const val = (e.target as HTMLSelectElement).value;
          onsetpersona(session.id, val || undefined);
          showPersonaSelect = false;
        }}
      >
        <option value="">(none)</option>
        {#each personas as p}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>
