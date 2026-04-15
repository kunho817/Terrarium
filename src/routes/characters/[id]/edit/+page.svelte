<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { charactersStore } from '$lib/stores/characters';
  import { charactersRepo } from '$lib/repositories/characters-repo';
  import * as characterStorage from '$lib/storage/characters';
  import CharacterEditor from '$lib/components/editors/CharacterEditor.svelte';
  import type { CharacterCard } from '$lib/types';
  import { getRegistry } from '$lib/core/bootstrap';

  let card = $state<CharacterCard | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let showExportMenu = $state(false);

  onMount(async () => {
    const id = $page.params.id!;
    try {
      await charactersRepo.selectCharacter(id);
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
      await charactersRepo.saveCharacter(id, card);
      goto('/characters');
    } catch (e: any) {
      error = e?.message || 'Failed to save character';
    } finally {
      saving = false;
    }
  }

  async function handleExport(formatId: string) {
    showExportMenu = false;
    if (!card) return;
    try {
      const registry = getRegistry();
      const format = registry.getCardFormat(formatId);
      const data = format.export(card);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const ext = formatId === 'generic-json' ? 'tcjson' : 'json';
      const filePath = await save({
        defaultPath: `${card.name}.${ext}`,
        filters: [{ name: `${format.name} Card`, extensions: [ext] }],
      });
      if (!filePath) return;
      await writeFile(filePath, new Uint8Array(data));
    } catch (e: any) {
      error = e?.message || 'Export failed';
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
        <div class="flex items-center gap-2">
          <div class="relative">
            <button
              onclick={() => showExportMenu = !showExportMenu}
              class="px-3 py-2 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors"
            >
              Export
            </button>
            {#if showExportMenu}
              <div class="absolute right-0 top-full mt-1 bg-surface1 border border-surface2 rounded-md shadow-lg z-10 py-1 min-w-[160px]">
                <button
                  onclick={() => handleExport('generic-json')}
                  class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
                >
                  Terrarium (.tcjson)
                </button>
                <button
                  onclick={() => handleExport('risuai')}
                  class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
                >
                  RisuAI (.json)
                </button>
                <button
                  onclick={() => handleExport('sillytavern')}
                  class="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface2 cursor-pointer bg-transparent border-none"
                >
                  SillyTavern (.json)
                </button>
              </div>
            {/if}
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
