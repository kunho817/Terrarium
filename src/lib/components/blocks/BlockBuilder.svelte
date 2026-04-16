<script lang="ts">
  import { tick } from 'svelte';
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import BlockPalette from './BlockPalette.svelte';
  import BlockCanvas from './BlockCanvas.svelte';
  import BlockPreview from './BlockPreview.svelte';
  import Toolbar from './Toolbar.svelte';
  import TextBlockEditor from './editors/TextBlockEditor.svelte';
  import { viewportStore } from '$lib/stores/viewport';

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
  let previewCollapsed = $state(false);
  let canvasContainer: HTMLElement | undefined = $state();

  let viewport = $state($viewportStore);
  $effect(() => { viewport = $viewportStore; });

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

  function handleZoomIn() {
    viewportStore.setScale(viewport.scale + 0.1);
  }

  function handleZoomOut() {
    viewportStore.setScale(viewport.scale - 0.1);
  }

  function handleFitView() {
    if (!canvasContainer || graph.blocks.length === 0) return;
    const rect = canvasContainer.getBoundingClientRect();
    viewportStore.fitToContent(
      graph.blocks.map(b => ({ position: b.position })),
      rect.width - (previewCollapsed ? 40 : 320),
      rect.height,
      100
    );
  }

  function handleResetView() {
    viewportStore.reset();
  }

  function togglePreview() {
    previewCollapsed = !previewCollapsed;
  }
</script>

<div class="block-builder h-full flex flex-col bg-mantle">
  <Toolbar 
    viewport={viewport}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
    onFitView={handleFitView}
    onResetView={handleResetView}
  />
  
  <div class="flex-1 flex min-h-0">
    <div class="w-[200px] border-r border-surface2 overflow-hidden">
      <BlockPalette onBlockClick={handleBlockClick} />
    </div>
    
    <div class="flex-1 relative overflow-hidden" bind:this={canvasContainer}>
      <BlockCanvas 
        {graph} 
        selectedBlockId={selectedBlockId ?? null}
        onBlockSelect={handleBlockSelect}
        onBlockDoubleClick={handleBlockDoubleClick}
        onBlockMove={handleBlockMove}
      />
      
      <div 
        class="preview-dock absolute right-0 top-0 bottom-0 flex transition-all duration-300 ease-in-out"
        style="width: {previewCollapsed ? '40px' : '320px'};"
      >
        {#if previewCollapsed}
          <button 
            class="collapsed-bar w-full h-full flex items-center justify-center bg-surface1 border-l border-surface2 hover:bg-surface2 transition-colors"
            onclick={togglePreview}
            title="Expand preview"
          >
            <span class="text-xs text-subtext0 font-medium writing-vertical">Preview</span>
          </button>
        {:else}
          <div class="flex flex-col h-full w-full bg-surface1 border-l border-surface2">
            <header class="flex items-center justify-between px-4 py-3 border-b border-surface2">
              <span class="text-sm font-semibold text-text">Preview</span>
              <button 
                class="p-1 rounded hover:bg-surface2 text-subtext0 hover:text-text transition-colors"
                onclick={togglePreview}
                title="Collapse preview"
              >
                ▶
              </button>
            </header>
            <div class="flex-1 overflow-hidden">
              <BlockPreview {graph} />
            </div>
          </div>
        {/if}
      </div>
      
      {#if editingBlock}
        {@const block = editingBlock}
        <div 
          bind:this={modalElement}
          class="absolute inset-0 bg-mantle/80 z-50 flex items-center justify-center"
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
                class="p-1 rounded hover:bg-surface2 text-subtext0 hover:text-text transition-colors"
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
  </div>
</div>

<style>
  .writing-vertical {
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }
</style>
