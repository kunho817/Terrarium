<script lang="ts">
  import { blockRegistry } from '$lib/blocks/registry';
  import type { BlockDefinition } from '$lib/types';

  interface Props {
    onBlockDragStart?: (blockType: string) => void;
  }

  let { onBlockDragStart }: Props = $props();

  const categories = [
    { id: 'foundation', label: 'Foundation', color: '#89b4fa' },
    { id: 'logic', label: 'Logic (CBS)', color: '#f38ba8' },
    { id: 'data', label: 'Data', color: '#a6e3a1' },
    { id: 'structure', label: 'Structure', color: '#94e2d5' },
  ] as const;

  function getBlocksByCategory(category: string): BlockDefinition[] {
    return blockRegistry.getAllByCategory(category as BlockDefinition['category']);
  }

  function handleDragStart(e: DragEvent, blockType: string) {
    e.dataTransfer?.setData('text/plain', blockType);
    onBlockDragStart?.(blockType);
  }
</script>

<div class="w-64 h-full bg-surface1 rounded-lg p-4 overflow-y-auto">
  <h3 class="text-sm font-semibold text-text mb-4">Block Palette</h3>

  {#each categories as category}
    {@const blocks = getBlocksByCategory(category.id)}
    {#if blocks.length > 0}
      <div class="mb-4">
        <div
          class="text-xs uppercase font-medium mb-2 px-2 py-1 rounded"
          style="color: {category.color}; background: {category.color}20;"
        >
          {category.label}
        </div>

        <div class="space-y-2">
          {#each blocks as block}
            <div
              class="flex items-center gap-2 p-2 bg-surface0 rounded cursor-grab hover:bg-surface2 transition-colors"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, block.type)}
              role="button"
              aria-label="Drag {block.displayName} block"
            >
              <span class="text-lg">{block.icon}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text truncate">
                  {block.displayName}
                </div>
                <div class="text-xs text-subtext0 truncate">
                  {block.description}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>
