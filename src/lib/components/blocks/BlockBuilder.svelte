<script lang="ts">
  import { tick } from 'svelte';
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import BlockPalette from './BlockPalette.svelte';
  import BlockCanvas from './BlockCanvas.svelte';
  import BlockPreview from './BlockPreview.svelte';
  import TogglePanel from './TogglePanel.svelte';
  import TextBlockEditor from './editors/TextBlockEditor.svelte';

  interface Props {
    graph: BlockGraph;
    onBlockAdd?: (blockType: string) => void;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    onBlockConfigChange?: (blockId: string, config: Record<string, unknown>) => void;
    selectedBlockId?: string | null;
  }

  let { 
    graph, 
    onBlockAdd, 
    onBlockSelect,
    onBlockMove,
    onBlockConfigChange,
    selectedBlockId 
  }: Props = $props();

  let editingBlock: BlockInstance | null = $state(null);
  let modalElement: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (editingBlock) {
      tick().then(() => modalElement?.focus());
    }
  });

  function handleBlockClick(blockType: string) {
    onBlockAdd?.(blockType);
  }

  function handleBlockSelect(blockId: string | null) {
    onBlockSelect?.(blockId);
  }

  function handleBlockMove(blockId: string, position: { x: number; y: number }) {
    onBlockMove?.(blockId, position);
  }

  function handleBlockDoubleClick(blockId: string) {
    const block = graph.blocks.find(b => b.id === blockId);
    if (block) {
      editingBlock = block;
    }
  }

  function handleEditorClose() {
    editingBlock = null;
  }

  function handleEditorSave(blockId: string, config: Record<string, unknown>) {
    onBlockConfigChange?.(blockId, config);
    editingBlock = null;
  }
</script>

<div class="block-builder grid gap-4" style="grid-template-columns: 200px 1fr 250px; height: 500px;">
  <BlockPalette onBlockClick={handleBlockClick} />
  
  <div class="relative">
    <BlockCanvas 
      {graph} 
      selectedBlockId={selectedBlockId ?? null}
      onBlockSelect={handleBlockSelect}
      onBlockDoubleClick={handleBlockDoubleClick}
      onBlockMove={handleBlockMove}
    />
    
    {#if editingBlock}
      {@const block = editingBlock}
      <div 
        bind:this={modalElement}
        class="absolute inset-0 bg-mantle/80 z-50 flex items-center justify-center rounded-lg"
        onclick={handleEditorClose}
        onkeydown={(e) => e.key === 'Escape' && handleEditorClose()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
      >
        <div 
          class="bg-surface1 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto border border-surface2"
          onclick={(e) => e.stopPropagation()}
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-text">Edit {block.type}</h3>
            <button 
              class="text-subtext0 hover:text-text transition-colors"
              onclick={handleEditorClose}
            >✕</button>
          </div>
          
          {#if block.type === 'TextBlock'}
            <TextBlockEditor 
              config={block.config}
              onChange={(config) => handleEditorSave(block.id, config)}
            />
          {:else}
            <p class="text-subtext0">No editor available for this block type</p>
          {/if}
          
          <div class="flex justify-end mt-4 pt-4 border-t border-surface2">
            <button
              class="px-4 py-2 text-sm text-subtext0 hover:text-text transition-colors"
              onclick={handleEditorClose}
            >Cancel</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="flex flex-col gap-4">
    <BlockPreview {graph} />
    <TogglePanel />
  </div>
</div>
