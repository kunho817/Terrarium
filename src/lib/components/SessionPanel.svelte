<script lang="ts">
  import type { ChatSession } from '$lib/types';
  import type { UserPersona } from '$lib/types/persona';
  import SessionItem from './SessionItem.svelte';

  let {
    sessions,
    activeSessionId,
    personas,
    onselect,
    onrename,
    ondelete,
    oncreate,
    onclose,
    onsetpersona,
  }: {
    sessions: ChatSession[];
    activeSessionId: string | null;
    personas: { id: string; name: string }[];
    onselect: (id: string) => void;
    onrename: (id: string, name: string) => void;
    ondelete: (id: string) => void;
    oncreate: () => void;
    onclose: () => void;
    onsetpersona: (id: string, personaId: string | undefined) => void;
  } = $props();
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
    <!-- Header -->
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

    <!-- Session list -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      {#if sessions.length === 0}
        <div class="text-center text-subtext0 text-sm py-8">No sessions yet</div>
      {:else}
        {#each sessions as session}
          <SessionItem
            {session}
            isActive={session.id === activeSessionId}
            {personas}
            {onselect}
            {onrename}
            {ondelete}
            onsetpersona={onsetpersona}
          />
        {/each}
      {/if}
    </div>

    <!-- New session button -->
    <div class="p-3 border-t border-surface0">
      <button
        onclick={oncreate}
        class="w-full text-sm text-green hover:text-lavender bg-transparent border border-surface1 rounded-lg px-3 py-2 cursor-pointer hover:bg-surface0 transition-colors"
      >
        + New Session
      </button>
    </div>
  </div>
</div>
