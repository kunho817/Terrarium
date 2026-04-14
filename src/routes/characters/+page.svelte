<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { charactersStore } from '$lib/stores/characters';
  import { getRegistry } from '$lib/core/bootstrap';
  import CharacterCardDisplay from '$lib/components/CharacterCardDisplay.svelte';
  import type { CharacterCard } from '$lib/types';
  import * as characterStorage from '$lib/storage/characters';

  let importing = $state(false);
  let error = $state('');
  let exportMenuFor: string | null = $state(null);

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
          extensions: ['json', 'tcjson', 'png'],
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
          const format = registry.getCardFormat(`.${ext}`);
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

  async function handleExport(id: string, name: string, formatId: string) {
    exportMenuFor = null;
    try {
      const registry = getRegistry();
      const format = registry.getCardFormat(formatId);
      const card = await characterStorage.loadCharacter(id);
      const data = format.export(card);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const ext = formatId === 'generic-json' ? 'tcjson' : 'json';
      const filePath = await save({
        defaultPath: `${name}.${ext}`,
        filters: [{ name: `${format.name} Card`, extensions: [ext] }],
      });
      if (!filePath) return;
      await writeFile(filePath, new Uint8Array(data));
    } catch (e: any) {
      error = e?.message || 'Export failed';
    }
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <h1 class="text-lg font-semibold text-text">Characters</h1>
    <div class="flex gap-2">
      <a
        href="/characters/new"
        class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm font-medium
               hover:bg-surface2 transition-colors"
      >
        + Create
      </a>
      <button
        onclick={handleImport}
        disabled={importing}
        class="px-3 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 transition-colors"
      >
        {importing ? 'Importing...' : 'Import Card'}
      </button>
    </div>
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
            <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="relative">
                <button
                  onclick={(e) => { e.stopPropagation(); exportMenuFor = exportMenuFor === character.id ? null : character.id; }}
                  class="p-1 rounded bg-surface2 text-subtext0 hover:bg-overlay0 hover:text-text
                         transition-colors text-xs cursor-pointer border-none"
                  title="Export"
                >
                  ↓
                </button>
                {#if exportMenuFor === character.id}
                  <div class="absolute right-0 top-full mt-1 bg-surface1 border border-surface2 rounded-md shadow-lg z-10 py-1 min-w-[160px]">
                    <button
                      onclick={() => handleExport(character.id, character.name, 'generic-json')}
                      class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
                    >
                      Terrarium (.tcjson)
                    </button>
                    <button
                      onclick={() => handleExport(character.id, character.name, 'risuai')}
                      class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
                    >
                      RisuAI (.json)
                    </button>
                    <button
                      onclick={() => handleExport(character.id, character.name, 'sillytavern')}
                      class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
                    >
                      SillyTavern (.json)
                    </button>
                  </div>
                {/if}
              </div>
              <a
                href="/characters/{character.id}/edit"
                class="p-1 rounded bg-surface2 text-subtext0 hover:bg-overlay0 hover:text-text
                       transition-colors text-xs"
                title="Edit"
              >
                &#9998;
              </a>
              <button
                onclick={() => handleDelete(character.id, character.name)}
                class="p-1 rounded bg-surface2 text-red hover:bg-overlay0
                       transition-colors text-xs"
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
