<script lang="ts">
  import { blockBuilderStore } from '$lib/stores/block-builder';

  const toggles = $derived($blockBuilderStore.toggles);
  const toggleNames = $derived($blockBuilderStore.toggleNames);

  function handleToggle(id: string, value: boolean) {
    blockBuilderStore.setToggle(id, value);
  }

  function handleAddToggle() {
    const id = crypto.randomUUID();
    const name = `Toggle ${toggles.size + 1}`;
    blockBuilderStore.addToggle(id, name);
  }

  function handleRemoveToggle(id: string) {
    blockBuilderStore.removeToggle(id);
  }
</script>

<div class="toggle-panel bg-surface1 rounded-lg p-3">
  <h4 class="text-sm font-semibold text-text mb-3">Active Toggles</h4>

  <div class="space-y-2">
    {#each [...toggles.entries()] as [id, value]}
      <div class="flex items-center justify-between p-2 bg-surface0 rounded">
        <span class="text-sm text-text">🔘 {toggleNames.get(id) ?? 'Toggle'}</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-label="Toggle {toggleNames.get(id) ?? 'Toggle'}"
            aria-checked={value}
            class="w-9 h-5 rounded-full transition-colors"
            style="background: {value ? '#a6e3a1' : '#45475a'};"
            onclick={() => handleToggle(id, !value)}
          >
            <div 
              class="w-4 h-4 bg-white rounded-full transition-transform"
              style="transform: translateX({value ? '14px' : '2px'});"
            ></div>
          </button>
          <button
            class="text-subtext0 hover:text-red transition-colors"
            onclick={() => handleRemoveToggle(id)}
          >✕</button>
        </div>
      </div>
    {/each}
  </div>

  <button
    type="button"
    class="w-full mt-3 p-2 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
    onclick={handleAddToggle}
  >
    + Add Toggle
  </button>
</div>
