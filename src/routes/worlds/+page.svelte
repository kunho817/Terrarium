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
