<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import PresetList from '$lib/components/editors/PresetList.svelte';
  import PromptItemEditor from '$lib/components/editors/PromptItemEditor.svelte';
  import type { PromptPreset, PromptItem, PromptPresetSettings } from '$lib/types/prompt-preset';
  import { createDefaultPreset } from '$lib/core/presets/defaults';

  let loaded = $state(false);
  let localSettings = $state<PromptPresetSettings | null>(null);

  onMount(async () => {
    await settingsStore.load();
    localSettings = $settingsStore.promptPresets ?? null;
    loaded = true;
  });

  // Get active preset
  let activePreset = $derived(
    localSettings?.presets.find(p => p.id === localSettings!.activePresetId) ?? null
  );

  // Helper to update settings
  function updateSettings(patch: Partial<PromptPresetSettings>) {
    if (!localSettings) return;
    localSettings = { ...localSettings, ...patch };
    settingsStore.update({ promptPresets: localSettings });
  }

  function updatePreset(updated: PromptPreset) {
    if (!localSettings) return;
    const presets = localSettings.presets.map(p => p.id === updated.id ? updated : p);
    updateSettings({ presets });
  }

  // PresetList callbacks
  function handleSelect(id: string) {
    updateSettings({ activePresetId: id });
  }

  function handleCreate(name: string) {
    if (!localSettings) return;
    const newPreset: PromptPreset = {
      id: crypto.randomUUID(),
      name,
      items: [...(activePreset?.items ?? [])],
      assistantPrefill: '',
    };
    updateSettings({ presets: [...localSettings.presets, newPreset], activePresetId: newPreset.id });
  }

  function handleDuplicate(id: string) {
    if (!localSettings) return;
    const source = localSettings.presets.find(p => p.id === id);
    if (!source) return;
    const dup: PromptPreset = {
      id: crypto.randomUUID(),
      name: source.name + ' (Copy)',
      items: source.items.map(item => ({ ...item, id: crypto.randomUUID() })),
      assistantPrefill: source.assistantPrefill,
    };
    updateSettings({ presets: [...localSettings.presets, dup], activePresetId: dup.id });
  }

  function handleRename(id: string, name: string) {
    if (!localSettings) return;
    const presets = localSettings.presets.map(p => p.id === id ? { ...p, name } : p);
    updateSettings({ presets });
  }

  function handleDelete(id: string) {
    if (!localSettings || localSettings.presets.length <= 1) return;
    const presets = localSettings.presets.filter(p => p.id !== id);
    const activePresetId = localSettings.activePresetId === id ? presets[0].id : localSettings.activePresetId;
    updateSettings({ presets, activePresetId });
  }

  function handleReset() {
    if (!activePreset || !localSettings) return;
    const defaultPreset = createDefaultPreset();
    // Preserve the preset ID and name, but reset items and prefill
    const resetPreset: PromptPreset = {
      ...activePreset,
      items: defaultPreset.items.map(item => ({ ...item, id: crypto.randomUUID() })),
      assistantPrefill: defaultPreset.assistantPrefill,
    };
    updatePreset(resetPreset);
    handleSave();
  }

  // PromptItem callbacks
  function handleItemChange(index: number, updatedItem: PromptItem) {
    if (!activePreset) return;
    const items = activePreset.items.map((item, i) => i === index ? updatedItem : item);
    updatePreset({ ...activePreset, items });
  }

  function handleItemRemove(index: number) {
    if (!activePreset) return;
    const items = activePreset.items.filter((_, i) => i !== index);
    updatePreset({ ...activePreset, items });
  }

  function handleMoveUp(index: number) {
    if (!activePreset || index === 0) return;
    const items = [...activePreset.items];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    updatePreset({ ...activePreset, items });
  }

  function handleMoveDown(index: number) {
    if (!activePreset || index >= activePreset.items.length - 1) return;
    const items = [...activePreset.items];
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    updatePreset({ ...activePreset, items });
  }

  function handleAddItem() {
    if (!activePreset) return;
    const newItem: PromptItem = {
      id: crypto.randomUUID(),
      type: 'plain',
      name: 'New Item',
      enabled: true,
      role: 'system',
      content: '',
    };
    updatePreset({ ...activePreset, items: [...activePreset.items, newItem] });
  }

  async function handleSave() {
    await settingsStore.save();
  }
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-4xl mx-auto p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <a
            href="/settings"
            class="text-sm text-mauve hover:text-lavender transition-colors"
          >
            &larr; Back to Settings
          </a>
          <h1 class="text-lg font-semibold text-text mt-1">Prompt Builder</h1>
        </div>
        <button
          onclick={handleSave}
          class="px-4 py-1.5 rounded-md text-sm font-medium bg-mauve text-crust
                 hover:bg-lavender transition-colors"
        >
          Save
        </button>
      </div>

      <div class="flex gap-6 flex-col md:flex-row">
        <!-- Left panel: Preset list -->
        <div class="w-full md:w-64 shrink-0">
          <PresetList
            presets={localSettings?.presets ?? []}
            activePresetId={localSettings?.activePresetId ?? ''}
            onselect={handleSelect}
            oncreate={handleCreate}
            onduplicate={handleDuplicate}
            onrename={handleRename}
            ondelete={handleDelete}
          />
        </div>

        <!-- Right panel: Items editor -->
        <div class="flex-1 min-w-0">
          {#if activePreset}
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-medium text-text">{activePreset.name}</h2>
              <button
                onclick={handleReset}
                class="text-xs text-subtext0 hover:text-red transition-colors"
                title="Reset this preset to factory defaults (all custom changes will be lost)"
              >
                Reset to Default
              </button>
            </div>
            <div class="space-y-3">
              {#each activePreset.items as item, i (item.id)}
                <div class="flex items-start gap-2">
                  <!-- Move buttons -->
                  <div class="flex flex-col gap-0.5 pt-2 shrink-0">
                    <button
                      onclick={() => handleMoveUp(i)}
                      disabled={i === 0}
                      class="px-1.5 py-0.5 text-xs rounded bg-surface0 text-subtext1
                             hover:bg-surface1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      &#9650;
                    </button>
                    <button
                      onclick={() => handleMoveDown(i)}
                      disabled={i >= activePreset.items.length - 1}
                      class="px-1.5 py-0.5 text-xs rounded bg-surface0 text-subtext1
                             hover:bg-surface1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      &#9660;
                    </button>
                  </div>

                  <!-- Item editor -->
                  <div class="flex-1 min-w-0">
                    <PromptItemEditor
                      {item}
                      onchange={(updated: PromptItem) => handleItemChange(i, updated)}
                      onremove={() => handleItemRemove(i)}
                    />
                  </div>
                </div>
              {/each}

              <!-- Add item button -->
              <button
                onclick={handleAddItem}
                class="w-full py-2 rounded-md text-sm font-medium bg-surface0 text-subtext1
                       hover:bg-surface1 hover:text-text transition-colors border border-dashed border-surface1"
              >
                + Add Item
              </button>
            </div>
          {:else}
            <p class="text-sm text-subtext0">Select or create a preset to begin.</p>
          {/if}
        </div>
      </div>

      <!-- Template Variables Reference -->
      <section class="border-t border-surface1 pt-4 mt-6">
        <h3 class="text-sm font-medium text-text mb-2">Template Variables</h3>
        <div class="grid grid-cols-2 gap-2 text-xs text-subtext0">
          <div><code class="text-mauve">{`{{char}}`}</code> &mdash; Character name</div>
          <div><code class="text-mauve">{`{{user}}`}</code> &mdash; User name</div>
          <div><code class="text-mauve">{`{{description}}`}</code> &mdash; Character description</div>
          <div><code class="text-mauve">{`{{personality}}`}</code> &mdash; Personality</div>
          <div><code class="text-mauve">{`{{scenario}}`}</code> &mdash; Scenario</div>
          <div><code class="text-mauve">{`{{slot}}`}</code> &mdash; Resolved content (in inner format)</div>
          <div><code class="text-mauve">{`{{scene.location}}`}</code> &mdash; Scene location</div>
          <div><code class="text-mauve">{`{{var.*}}`}</code> &mdash; Variable store values</div>
        </div>
      </section>
    </div>
  </div>
{/if}
