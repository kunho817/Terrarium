<script lang="ts">
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import BlockNode from './BlockNode.svelte';
  import ConnectionLayer from './ConnectionLayer.svelte';
  import { connectionDragStore } from '$lib/stores/connection-drag';

  interface Props {
    graph: BlockGraph;
    selectedBlockId: string | null;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    onBlockDoubleClick?: (blockId: string) => void;
  }

  let { graph, selectedBlockId, onBlockSelect, onBlockMove, onBlockDoubleClick }: Props = $props();

  // Drag state
  let isDragging = $state(false);
  let dragBlockId: string | null = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });

  function handleBlockMouseDown(block: BlockInstance, e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    dragBlockId = block.id;
    dragOffset = {
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y
    };
    onBlockSelect?.(block.id);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !dragBlockId) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    onBlockMove?.(dragBlockId, {
      x: Math.max(0, newX),
      y: Math.max(0, newY)
    });
  }

  function handleMouseUp() {
    isDragging = false;
    dragBlockId = null;
  }

  function handleCanvasClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('canvas-area')) {
      onBlockSelect?.(null);
    }
  }

  function handlePortClick(blockId: string, portId: string, isInput: boolean, e: MouseEvent) {
    if (!isInput) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      connectionDragStore.startDrag(blockId, portId, isInput, 
        rect.left + rect.width / 2, 
        rect.top + rect.height / 2
      );
    }
  }

  function handleCanvasMouseMove(e: MouseEvent) {
    if ($connectionDragStore.isDragging) {
      connectionDragStore.updateMouse(e.clientX, e.clientY);
    }
  }
  
</script>

<svelte:window 
  onmousemove={handleMouseMove} 
  onmouseup={handleMouseUp} 
/>

<div 
  class="canvas-area relative w-full h-full bg-mantle rounded-lg overflow-hidden border-2 border-surface2"
  onclick={handleCanvasClick}
  onmousemove={handleCanvasMouseMove}
  role="application"
  aria-label="Block canvas"
>
  <!-- Grid background (fixed) -->
  <div 
    class="absolute inset-0 pointer-events-none opacity-20"
    style="background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 20px 20px;"
  ></div>

  <!-- Connection Layer -->
  <ConnectionLayer 
    connections={graph.connections}
    blocks={graph.blocks}
    livePreview={$connectionDragStore.isDragging ? {
      fromBlockId: $connectionDragStore.fromBlockId!,
      fromPortId: $connectionDragStore.fromPortId!,
      mouseX: $connectionDragStore.mouseX,
      mouseY: $connectionDragStore.mouseY,
    } : null}
  />

  <!-- Blocks -->
  {#each graph.blocks as block (block.id)}
    <div
      data-block-id={block.id}
      class="absolute"
      style="left: {block.position.x}px; top: {block.position.y}px;"
    >
      <BlockNode
        {block}
        isSelected={block.id === selectedBlockId}
        onSelect={() => onBlockSelect?.(block.id)}
        onDoubleClick={() => onBlockDoubleClick?.(block.id)}
        onDragStart={(e) => handleBlockMouseDown(block, e)}
        onPortClick={(portId, isInput, e) => handlePortClick(block.id, portId, isInput, e)}
      />
    </div>
  {/each}

  <!-- Empty state -->
  {#if graph.blocks.length === 0}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="text-center">
        <p class="text-text text-lg font-medium">Drag blocks from palette</p>
        <p class="text-subtext0 text-sm">or click to add them here</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .canvas-area {
    cursor: default;
  }
  .canvas-area:has([data-block-id]:active) {
    cursor: grabbing;
  }
</style>
