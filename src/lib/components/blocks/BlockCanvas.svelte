<script lang="ts">
  import type { BlockGraph, BlockInstance, Connection } from '$lib/types';
  import BlockNode from './BlockNode.svelte';
  import ConnectionLayer from './ConnectionLayer.svelte';
  import { connectionDragStore } from '$lib/stores/connection-drag';
  import { blockBuilderStore } from '$lib/stores/block-builder';

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
    if ($connectionDragStore.isDragging && isInput) {
      const fromBlockId = $connectionDragStore.fromBlockId;
      const fromPortId = $connectionDragStore.fromPortId;
      if (!fromBlockId || !fromPortId) return;
      
      // Prevent self-connection
      if (fromBlockId === blockId) {
        connectionDragStore.endDrag();
        return;
      }
      
      // Prevent duplicate
      const exists = graph.connections.some(c => 
        c.from.blockId === fromBlockId && c.from.portId === fromPortId &&
        c.to.blockId === blockId && c.to.portId === portId
      );
      if (exists) {
        connectionDragStore.endDrag();
        return;
      }
      
      const conn: Connection = {
        id: crypto.randomUUID(),
        from: { blockId: fromBlockId, portId: fromPortId },
        to: { blockId, portId },
      };
      blockBuilderStore.addConnection(conn);
      connectionDragStore.endDrag();
    } else if (!isInput) {
      const portRect = (e.target as HTMLElement).getBoundingClientRect();
      const canvas = document.querySelector('.canvas-area');
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        connectionDragStore.startDrag(blockId, portId, isInput, 
          portRect.left + portRect.width / 2 - canvasRect.left, 
          portRect.top + portRect.height / 2 - canvasRect.top
        );
      }
    }
  }

  function handleCanvasMouseMove(e: MouseEvent) {
    if ($connectionDragStore.isDragging) {
      const canvas = document.querySelector('.canvas-area');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        connectionDragStore.updateMouse(
          e.clientX - rect.left,
          e.clientY - rect.top
        );
      }
    }
  }
  
  function handleConnectionDragEnd() {
    if ($connectionDragStore.isDragging) {
      connectionDragStore.endDrag();
    }
  }
  
</script>

<svelte:window 
  onmousemove={handleMouseMove} 
  onmouseup={() => { handleMouseUp(); handleConnectionDragEnd(); }}
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
