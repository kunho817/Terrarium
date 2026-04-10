<script lang="ts">
  let { characterName = '', modelName = '' } = $props<{
    characterName?: string;
    modelName?: string;
  }>();
</script>

<div class="flex items-center justify-between px-4 py-2 border-b border-surface0 bg-mantle">
  <div class="flex items-center gap-3">
    <span class="text-sm font-semibold text-text">{characterName || 'Select a character'}</span>
  </div>
  <div class="flex items-center gap-2">
    {#if modelName}
      <span class="text-xs px-2 py-0.5 bg-surface0 rounded text-subtext0">{modelName}</span>
    {/if}
  </div>
</div>
