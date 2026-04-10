<script lang="ts">
  import { onMount } from 'svelte';
  import { charactersStore } from '$lib/stores/characters';

  onMount(() => {
    charactersStore.loadList();
  });
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <h1 class="text-lg font-semibold text-text">Chats</h1>
    <a
      href="/characters"
      class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
             hover:bg-lavender transition-colors"
    >
      + New Chat
    </a>
  </div>

  <div class="flex-1 overflow-y-auto p-4">
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
    {/if}
  </div>
</div>
