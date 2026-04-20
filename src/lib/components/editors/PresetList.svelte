<script lang="ts">
  import { tick } from 'svelte';
  import type { PromptPreset } from '$lib/types/prompt-preset';

  let { presets, activePresetId, onselect, oncreate, onduplicate, onrename, ondelete }: {
    presets: PromptPreset[];
    activePresetId: string;
    onselect: (id: string) => void;
    oncreate: (name: string) => void;
    onrename: (id: string, name: string) => void;
    onduplicate: (id: string) => void;
    ondelete: (id: string) => void;
  } = $props();

  let editingId = $state<string | null>(null);
  let editingName = $state('');
  let newName = $state('');
  let renameInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (editingId && renameInput) {
      tick().then(() => renameInput?.focus());
    }
  });

  function startRename(id: string, currentName: string) {
    editingId = id;
    editingName = currentName;
  }

  function confirmRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed) {
      onrename(id, trimmed);
    }
    editingId = null;
    editingName = '';
  }

  function cancelRename() {
    editingId = null;
    editingName = '';
  }

  function handleCreate() {
    const name = newName.trim() || 'New Preset';
    oncreate(name);
    newName = '';
  }
</script>

<div class="flex flex-col gap-1">
  <h3 class="text-sm font-semibold text-subtext1 mb-2">Presets</h3>

  <!-- Preset list -->
  {#each presets as preset (preset.id)}
    {@const isActive = preset.id === activePresetId}
    {@const isEditing = preset.id === editingId}
    {@const isLast = presets.length <= 1}

    <div
      class="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors
             {isActive ? 'bg-surface1 text-mauve' : 'bg-surface0 text-text hover:bg-surface1'}"
      role="button"
      tabindex="0"
      onclick={() => { if (!isEditing) onselect(preset.id); }}
      onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isEditing) onselect(preset.id); }}
    >
      {#if isEditing}
        <input
          bind:this={renameInput}
          type="text"
          value={editingName}
          oninput={(e) => editingName = e.currentTarget.value}
          onkeydown={(e) => {
            if (e.key === 'Enter') confirmRename(preset.id);
            if (e.key === 'Escape') cancelRename();
          }}
          onblur={() => confirmRename(preset.id)}
          class="flex-1 bg-surface0 text-text px-2 py-0.5 rounded text-sm border border-surface1
                 focus:border-mauve focus:outline-none transition-colors min-w-0"
        />
      {:else}
        <span class="flex-1 text-sm truncate">{preset.name}</span>

        <!-- Per-preset actions -->
        <div class="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onclick={(e) => { e.stopPropagation(); startRename(preset.id, preset.name); }}
            class="p-1 rounded text-xs text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
            title="Rename"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            type="button"
            onclick={(e) => { e.stopPropagation(); onduplicate(preset.id); }}
            class="p-1 rounded text-xs text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
            title="Duplicate"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
            </svg>
          </button>
          <button
            type="button"
            onclick={(e) => { e.stopPropagation(); ondelete(preset.id); }}
            disabled={isLast}
            class="p-1 rounded text-xs text-subtext0 hover:text-red hover:bg-surface0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={isLast ? 'Cannot delete last preset' : 'Delete'}
          >
            &times;
          </button>
        </div>
      {/if}
    </div>
  {/each}

  <!-- Create new preset -->
  <div class="flex items-center gap-2 mt-2">
    <input
      type="text"
      value={newName}
      oninput={(e) => newName = e.currentTarget.value}
      onkeydown={(e) => { if (e.key === 'Enter') handleCreate(); }}
      placeholder="Preset name"
      class="flex-1 bg-surface0 text-text px-2 py-1.5 rounded-md text-sm border border-surface1
             focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0 min-w-0"
    />
    <button
      type="button"
      onclick={handleCreate}
      class="px-3 py-1.5 rounded-md text-xs font-medium bg-mauve text-crust hover:bg-lavender transition-colors shrink-0"
    >
      + New Preset
    </button>
  </div>
</div>
