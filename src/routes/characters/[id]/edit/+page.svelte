<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { charactersStore } from '$lib/stores/characters';
  import * as characterStorage from '$lib/storage/characters';
  import CharacterEditor from '$lib/components/editors/CharacterEditor.svelte';
  import type { CharacterCard } from '$lib/types';

  let card = $state<CharacterCard | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');

  onMount(async () => {
    const id = $page.params.id!;
    try {
      await charactersStore.selectCharacter(id);
      const state = $charactersStore;
      if (state.current) {
        // Deep clone so local edits don't mutate the store directly
        card = JSON.parse(JSON.stringify(state.current));
      } else {
        error = 'Character not found';
      }
    } catch {
      error = 'Failed to load character';
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    if (!card || !card.name.trim()) {
      error = 'Name is required';
      return;
    }
    saving = true;
    error = '';
    try {
      const id = $page.params.id!;
      await characterStorage.saveCharacter(id, card);
      goto('/characters');
    } catch (e: any) {
      error = e?.message || 'Failed to save character';
    } finally {
      saving = false;
    }
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="max-w-2xl mx-auto p-6 space-y-6">
    {#if loading}
      <div class="text-center text-subtext0 py-8">Loading...</div>
    {:else if card}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a href="/characters" class="text-subtext0 hover:text-text transition-colors">&#8592;</a>
          <h1 class="text-lg font-semibold text-text">Edit Character</h1>
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

      {#if error}
        <div class="px-4 py-2 bg-red/10 text-red text-sm rounded-md">{error}</div>
      {/if}

      <CharacterEditor {card} onchange={(updated) => card = updated} />
    {:else}
      <div class="text-center text-subtext0 py-8">
        <p class="text-lg mb-2">{error || 'Character not found'}</p>
        <a href="/characters" class="text-mauve hover:text-lavender transition-colors text-sm">
          Back to Characters
        </a>
      </div>
    {/if}
  </div>
</div>
