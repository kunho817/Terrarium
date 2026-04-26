<script lang="ts">
  import { blockRegistry } from '$lib/blocks/registry';
  import type { BlockDefinition } from '$lib/types';

  interface Props {
    onBlockClick?: (blockType: string) => void;
  }

  let { onBlockClick }: Props = $props();

  const categories = [
    { id: 'foundation', label: 'Foundation' },
    { id: 'logic', label: 'Logic' },
    { id: 'structure', label: 'Structure' },
    { id: 'data', label: 'Data' },
  ] as const;

  const categoryColors: Record<string, string> = {
    foundation: '#89b4fa',
    logic: '#f38ba8',
    structure: '#74c7ec',
    data: '#a6e3a1',
  };

  const hiddenPaletteTypes = new Set(['StageBlock']);

  function getBlocksByCategory(category: string): BlockDefinition[] {
    return blockRegistry
      .getAllByCategory(category as BlockDefinition['category'])
      .filter((definition) => !hiddenPaletteTypes.has(definition.type));
  }
</script>

<div class="palette-panel h-full bg-surface1 rounded-lg p-3 overflow-y-auto">
  <h3 class="text-sm font-semibold text-text mb-3">Block Palette</h3>

  {#each categories as category}
    {@const blocks = getBlocksByCategory(category.id)}
    {#if blocks.length > 0}
      <div class="mb-4">
        <div 
          class="text-xs uppercase font-medium mb-2 px-2 py-1 rounded"
          style="color: {categoryColors[category.id]}; background: {categoryColors[category.id]}20;"
        >
          {category.label}
        </div>

        <div class="space-y-1">
          {#each blocks as block}
            <button
              class="flex items-center gap-2 p-2 bg-surface0 rounded cursor-pointer hover:bg-surface2 transition-colors w-full text-left"
              onclick={() => onBlockClick?.(block.type)}
            >
              <span class="text-base">{block.icon}</span>
              <span class="text-sm text-text truncate">{block.displayName}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>
