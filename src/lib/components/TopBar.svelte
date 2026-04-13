<script lang="ts">
  let { characterName = '', modelName = '', characterId = '', isWorld = false } = $props<{
    characterName?: string;
    modelName?: string;
    characterId?: string;
    isWorld?: boolean;
  }>();
</script>

<div class="flex items-center justify-between px-4 py-2 border-b border-surface0 bg-mantle">
  <div class="flex items-center gap-3">
    <span class="text-sm font-semibold text-text">{characterName || 'Select a character'}</span>
    {#if isWorld}
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-lavender/20 text-lavender font-medium ml-2">World</span>
    {/if}
  </div>
  <div class="flex items-center gap-2">
    {#if modelName}
      <span class="text-xs px-2 py-0.5 bg-surface0 rounded text-subtext0">{modelName}</span>
    {/if}
    {#if characterId}
      <a
        href="/chat/{characterId}/info"
        class="text-subtext0 hover:text-text transition-colors text-sm px-1.5 py-0.5 rounded hover:bg-surface0"
        title="Chat Info"
      >
        &#9432;
      </a>
    {/if}
  </div>
</div>
