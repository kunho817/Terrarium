<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { worldsStore } from '$lib/stores/worlds';
  import { worldsRepo } from '$lib/repositories/worlds-repo';
  import { createDefaultWorldCard } from '$lib/types/world';
  import type { WorldCard, WorldCharacter } from '$lib/types/world';
  import * as worldImport from '$lib/storage/world-import';

  let tab = $state<'overview' | 'system' | 'lorebook' | 'characters' | 'scripts' | 'theme'>('overview');
  let card = $state<WorldCard>(createDefaultWorldCard());
  let saving = $state(false);
  let saved = $state(false);
  let error = $state('');
  let loaded = $state(false);

  const worldId = $derived($page.params.id ?? '');

  let tagsText = $state('');
  let newCharName = $state('');
  let newCharDesc = $state('');

  onMount(async () => {
    try {
      await worldsRepo.selectWorld(worldId);
      const state = $worldsStore;
      if (state.current) {
        card = JSON.parse(JSON.stringify(state.current));
        tagsText = card.tags.join(', ');
      }
      loaded = true;
    } catch {
      error = 'Failed to load world';
      loaded = true;
    }
  });

  async function handleSave() {
    saving = true;
    saved = false;
    error = '';
    try {
      card.tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
      const { saveWorld } = await import('$lib/storage/worlds');
      await saveWorld(worldId, card);
      saved = true;
      setTimeout(() => { saved = false; }, 2000);
    } catch (e: any) {
      error = e?.message || 'Failed to save';
    } finally {
      saving = false;
    }
  }

  function addCharacter() {
    if (!newCharName.trim()) return;
    const char: WorldCharacter = {
      id: crypto.randomUUID(),
      name: newCharName.trim(),
      description: newCharDesc.trim(),
    };
    card.characters = [...card.characters, char];
    newCharName = '';
    newCharDesc = '';
  }

  function removeCharacter(id: string) {
    card.characters = card.characters.filter(c => c.id !== id);
  }

  async function handleExport() {
    try {
      const data = worldImport.exportWorldCard(card);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: `${card.name || 'world'}.tcworld`,
        filters: [{ name: 'World Cards', extensions: ['tcworld'] }],
      });
      if (!filePath) return;
      await writeFile(filePath, new Uint8Array(data));
    } catch (e: any) {
      error = e?.message || 'Export failed';
    }
  }

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'system' as const, label: 'System Prompt' },
    { key: 'lorebook' as const, label: 'Lorebook' },
    { key: 'characters' as const, label: 'Characters' },
    { key: 'scripts' as const, label: 'Scripts' },
    { key: 'theme' as const, label: 'Theme' },
  ];
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center justify-between p-4 border-b border-surface0">
    <div class="flex items-center gap-3">
      <button onclick={() => goto('/worlds')} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer text-lg">&larr;</button>
      <h1 class="text-lg font-semibold text-text">Edit World</h1>
    </div>
    <div class="flex gap-2">
      <button
        onclick={handleExport}
        class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
      >
        Export
      </button>
      <button
        onclick={() => goto(`/chat/${worldId}?cardType=world`)}
        class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
      >
        Chat
      </button>
      <button
        onclick={handleSave}
        disabled={saving}
        class="px-3 py-1.5 rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 transition-colors cursor-pointer border-none
               {saved ? 'bg-green text-crust' : 'bg-mauve text-crust'}"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="px-4 py-2 bg-red/10 text-red text-sm border-b border-surface0">{error}</div>
  {/if}

  {#if !loaded}
    <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
  {:else}
    <div class="flex gap-1 px-4 py-2 border-b border-surface0 overflow-x-auto">
      {#each tabs as t}
        <button
          onclick={() => tab = t.key}
          class="px-3 py-1 rounded-md text-sm transition-colors cursor-pointer border-none
                 {tab === t.key ? 'bg-surface1 text-text font-medium' : 'bg-transparent text-subtext0 hover:text-text'}"
        >
          {t.label}
        </button>
      {/each}
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      {#if tab === 'overview'}
        <div class="max-w-2xl space-y-4">
          <div>
            <label class="block text-xs text-subtext0 mb-1">Name</label>
            <input type="text" bind:value={card.name} class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Description</label>
            <textarea bind:value={card.description} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Scenario</label>
            <textarea bind:value={card.scenario} rows="3" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">First Message</label>
            <textarea bind:value={card.firstMessage} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Tags</label>
            <input type="text" bind:value={tagsText} placeholder="tag1, tag2, ..." class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Creator Notes</label>
            <textarea bind:value={card.creatorNotes} rows="2" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
          </div>
        </div>

      {:else if tab === 'system'}
        <div class="max-w-2xl space-y-4">
          <div>
            <label class="block text-xs text-subtext0 mb-1">System Prompt</label>
            <textarea bind:value={card.systemPrompt} rows="8" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Post History Instructions</label>
            <textarea bind:value={card.postHistoryInstructions} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
        </div>

      {:else if tab === 'lorebook'}
        <div class="max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-text">Lorebook Entries</h2>
            <button
              onclick={() => {
                card.lorebook = [...card.lorebook, {
                  id: crypto.randomUUID(),
                  name: 'New Entry',
                  keywords: [],
                  caseSensitive: false,
                  content: '',
                  position: 'before_char',
                  priority: 0,
                  enabled: true,
                  scanDepth: card.loreSettings.scanDepth,
                  scope: 'global',
                  mode: 'normal',
                  constant: false,
                  category: 'misc',
                }];
              }}
              class="px-2 py-1 bg-surface1 text-text rounded text-xs hover:bg-surface2 transition-colors cursor-pointer border-none"
            >
              + Add Entry
            </button>
          </div>
          {#if card.lorebook.length === 0}
            <p class="text-subtext0 text-sm">No lorebook entries yet.</p>
          {:else}
            <div class="space-y-2">
              {#each card.lorebook as entry, i (entry.id)}
                <div class="p-3 rounded-lg bg-surface0 border border-surface1">
                  <div class="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      bind:value={entry.name}
                      class="bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve flex-1 mr-2"
                    />
                    <div class="flex items-center gap-2">
                      <select
                        bind:value={entry.category}
                        class="bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1 cursor-pointer"
                      >
                        <option value="character">Character</option>
                        <option value="region">Region</option>
                        <option value="setting">Setting</option>
                        <option value="misc">Misc</option>
                      </select>
                      <button
                        onclick={() => { card.lorebook = card.lorebook.filter((_, j) => j !== i); }}
                        class="text-red hover:text-red text-xs cursor-pointer bg-transparent border-none"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <textarea
                    bind:value={entry.content}
                    rows="3"
                    class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y"
                    placeholder="Entry content..."
                  ></textarea>
                  <div class="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={entry.keywords.join(', ')}
                      onchange={(e) => { entry.keywords = (e.target as HTMLInputElement).value.split(',').map(k => k.trim()).filter(Boolean); }}
                      class="flex-1 bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
                      placeholder="keywords (comma separated)"
                    />
                    <label class="flex items-center gap-1 text-xs text-subtext0 cursor-pointer">
                      <input type="checkbox" bind:checked={entry.enabled} class="accent-mauve" />
                      Enabled
                    </label>
                    <label class="flex items-center gap-1 text-xs text-subtext0 cursor-pointer">
                      <input type="checkbox" bind:checked={entry.constant} class="accent-mauve" />
                      Constant
                    </label>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      {:else if tab === 'characters'}
        <div class="max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-text">Characters (OCs)</h2>
          </div>
          <div class="space-y-3 mb-4">
            {#each card.characters as char (char.id)}
              <div class="p-3 rounded-lg bg-surface0 border border-surface1">
                <div class="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    bind:value={char.name}
                    class="bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve font-medium"
                  />
                  <button
                    onclick={() => removeCharacter(char.id)}
                    class="text-red hover:text-red text-xs cursor-pointer bg-transparent border-none"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  bind:value={char.description}
                  rows="2"
                  class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y mb-2"
                  placeholder="Character description..."
                ></textarea>
                <textarea
                  bind:value={char.personality}
                  rows="1"
                  class="w-full bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y"
                  placeholder="Personality traits (optional)..."
                ></textarea>
              </div>
            {/each}
          </div>
          <div class="p-3 rounded-lg bg-surface0 border border-surface1 border-dashed">
            <div class="flex gap-2 mb-2">
              <input
                type="text"
                bind:value={newCharName}
                class="flex-1 bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
                placeholder="Character name"
              />
              <button
                onclick={addCharacter}
                class="px-3 py-1 bg-mauve text-crust rounded text-sm font-medium hover:bg-lavender transition-colors cursor-pointer border-none"
              >
                Add
              </button>
            </div>
            <textarea
              bind:value={newCharDesc}
              rows="2"
              class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve resize-y"
              placeholder="Description (optional)..."
            ></textarea>
          </div>
        </div>

      {:else if tab === 'scripts'}
        <div class="max-w-2xl">
          <p class="text-subtext0 text-sm">Regex scripts and triggers — coming soon.</p>
          <div class="mt-4 space-y-2">
            <p class="text-xs text-subtext0">Regex Scripts: {card.regexScripts.length}</p>
            <p class="text-xs text-subtext0">Triggers: {card.triggers.length}</p>
          </div>
        </div>

      {:else if tab === 'theme'}
        <div class="max-w-2xl space-y-4">
          <div>
            <label class="block text-xs text-subtext0 mb-1">Background HTML</label>
            <textarea bind:value={card.backgroundHTML} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
          <div>
            <label class="block text-xs text-subtext0 mb-1">Background CSS</label>
            <textarea bind:value={card.backgroundCSS} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
