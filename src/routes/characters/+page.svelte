<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { charactersStore } from '$lib/stores/characters';
  import { getRegistry } from '$lib/core/bootstrap';
  import CharacterCardDisplay from '$lib/components/CharacterCardDisplay.svelte';
  import * as characterStorage from '$lib/storage/characters';

  let importing = $state(false);
  let error = $state('');

  onMount(() => {
    charactersStore.loadList();
  });

  async function handleImport() {
    importing = true;
    error = '';
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Character Cards',
          extensions: ['json', 'png'],
        }],
      });
      if (!selected) {
        importing = false;
        return;
      }

      const paths = Array.isArray(selected) ? selected : [selected];
      const registry = getRegistry();

      for (const filePath of paths) {
        try {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const data = await readFile(filePath);

          const ext = filePath.split('.').pop()?.toLowerCase() || 'json';
          const format = registry.getCardFormat(ext === 'json' ? 'json' : ext);
          const card = format.parse(data.buffer as ArrayBuffer);
          await characterStorage.createCharacter(card);
        } catch (e: any) {
          error = `Failed to import ${filePath}: ${e?.message || 'Unknown error'}`;
        }
      }

      await charactersStore.loadList();
    } catch (e: any) {
      error = e?.message || 'Import failed';
    } finally {
      importing = false;
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete character "${name}"? This cannot be undone.`)) return;
    await charactersStore.deleteCharacter(id);
  }

  function handleSelect(id: string) {
    goto(`/chat/${id}`);
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <h1 class="text-lg font-semibold text-text">Characters</h1>
    <button
      onclick={handleImport}
      disabled={importing}
      class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
             hover:bg-lavender disabled:opacity-50 transition-colors"
    >
      {importing ? 'Importing...' : '+ Import Card'}
    </button>
  </div>

  {#if error}
    <div class="px-4 py-2 bg-red/10 text-red text-sm border-b border-surface0">
      {error}
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto p-4">
    {#if $charactersStore.isLoading}
      <div class="text-center text-subtext0 py-8">Loading...</div>
    {:else if $charactersStore.list.length === 0}
      <div class="text-center text-subtext0 py-8">
        <p class="text-lg mb-2">No characters yet</p>
        <p class="text-sm mb-4">Import a character card (RisuAI, SillyTavern, or JSON format)</p>
        <button
          onclick={handleImport}
          class="px-4 py-2 bg-surface1 text-text rounded-md hover:bg-surface2 transition-colors"
        >
          Import Character Card
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each $charactersStore.list as character (character.id)}
          <div class="group relative">
            <CharacterCardDisplay
              name={character.name}
              onclick={() => handleSelect(character.id)}
            />
            <button
              onclick={() => handleDelete(character.id, character.name)}
              class="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                     p-1 rounded bg-surface2 text-red hover:bg-overlay0
                     transition-opacity text-xs"
              title="Delete"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
