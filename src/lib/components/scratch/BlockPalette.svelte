<script lang="ts">
  import { getAllBlocksByCategory } from '$lib/blocks/scratch-definitions';
  import type { BlockDefinition } from '$lib/types/scratch-blocks';

  const categories = [
    { id: 'foundation' as const, name: 'Foundation', color: '#89b4fa' },
    { id: 'logic' as const, name: 'Logic', color: '#f38ba8' },
  ];

  function onDragStart(e: DragEvent, block: BlockDefinition) {
    if (!e.dataTransfer) return;
    
    const payload = JSON.stringify({
      type: 'new-block',
      blockType: block.type,
    });
    
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'copy';
    
    console.log('Drag start:', block.type, payload);
  }
</script>

<aside class="palette w-48 bg-base flex flex-col overflow-y-auto">
  {#each categories as category}
    <div class="category" data-category={category.id}>
      <div 
        class="category-header px-3 py-2 text-xs font-semibold uppercase tracking-wider"
        style="background: {category.color}22; color: {category.color};"
      >
        {category.name}
      </div>
      <div class="category-blocks p-2 space-y-1">
        {#each getAllBlocksByCategory(category.id) as block}
          <div
            class="palette-block flex items-center gap-2 px-3 py-2 rounded cursor-grab hover:brightness-110 transition-all"
            style="background: {block.color};"
            draggable="true"
            ondragstart={(e) => onDragStart(e, block)}
            data-block-type={block.type}
            role="button"
            tabindex="0"
          >
            <span class="text-lg">{block.icon}</span>
            <span class="text-sm font-medium text-crust">{block.displayName}</span>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</aside>

<style>
  .palette {
    border-right: 1px solid var(--surface2);
  }
  .palette-block:active {
    cursor: grabbing;
  }
</style>
