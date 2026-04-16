<script lang="ts">
  import type { BlockGraph, BlockInstance, Connection } from '$lib/types';
  import BlockNode from './BlockNode.svelte';
  import ConnectionLayer from './ConnectionLayer.svelte';
  import { connectionDragStore } from '$lib/stores/connection-drag';
  import { blockBuilderStore } from '$lib/stores/block-builder';
  import { viewportStore } from '$lib/stores/viewport';

  interface Props {
    graph: BlockGraph;
    selectedBlockId: string | null;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    onBlockDoubleClick?: (blockId: string) => void;
  }

  let { graph, selectedBlockId, onBlockSelect, onBlockMove, onBlockDoubleClick }: Props = $props();

  let viewport = $state($viewportStore);
  $effect(() => { viewport = $viewportStore; });

  let isDragging = $state(false);
  let dragBlockId: string | null = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });

  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0 });
  let panOffsetStart = $state({ x: 0, y: 0 });

  function screenToCanvas(screenX: number, screenY: number, canvasRect: DOMRect) {
    const relX = screenX - canvasRect.left;
    const relY = screenY - canvasRect.top;
    return viewportStore.screenToCanvas(relX, relY);
  }

  function handleBlockMouseDown(block: BlockInstance, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    dragBlockId = block.id;
    const canvas = (e.currentTarget as HTMLElement).closest('.canvas-area') as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect);
    dragOffset = {
      x: canvasPos.x - block.position.x,
      y: canvasPos.y - block.position.y
    };
    onBlockSelect?.(block.id);
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      viewportStore.setOffset(
        panOffsetStart.x + deltaX,
        panOffsetStart.y + deltaY
      );
      return;
    }

    if (!isDragging || !dragBlockId) return;
    
    const canvas = document.querySelector('.canvas-area');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect as DOMRect);
    
    const newX = canvasPos.x - dragOffset.x;
    const newY = canvasPos.y - dragOffset.y;
    
    onBlockMove?.(dragBlockId, {
      x: Math.max(0, newX),
      y: Math.max(0, newY)
    });
  }

  function handleMouseUp() {
    isDragging = false;
    dragBlockId = null;
    isPanning = false;
  }

  function handleCanvasMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('canvas-area') || 
        target.classList.contains('grid-bg') ||
        target.classList.contains('transform-layer')) {
      if (e.button === 0) {
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        panOffsetStart = { x: viewport.offsetX, y: viewport.offsetY };
        e.preventDefault();
      }
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const canvas = document.querySelector('.canvas-area');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    viewportStore.zoomAt(relX, relY, delta);
  }

  function handleCanvasClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('canvas-area') || target.classList.contains('grid-bg')) {
      onBlockSelect?.(null);
    }
  }

  function handlePortClick(blockId: string, portId: string, isInput: boolean, e: MouseEvent) {
    if ($connectionDragStore.isDragging && isInput) {
      const fromBlockId = $connectionDragStore.fromBlockId;
      const fromPortId = $connectionDragStore.fromPortId;
      if (!fromBlockId || !fromPortId) return;
      
      if (fromBlockId === blockId) {
        connectionDragStore.endDrag();
        return;
      }
      
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

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const canvas = document.querySelector('.canvas-area');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect as DOMRect);
    console.log('Context menu at canvas position:', canvasPos);
  }
</script>

<svelte:window 
  onmousemove={handleMouseMove} 
  onmouseup={() => { handleMouseUp(); handleConnectionDragEnd(); }}
/>

<div 
  class="canvas-area relative w-full h-full bg-mantle rounded-lg overflow-hidden border-2 border-surface2"
  onmousedown={handleCanvasMouseDown}
  onclick={handleCanvasClick}
  oncontextmenu={handleContextMenu}
  onmousemove={handleCanvasMouseMove}
  onwheel={handleWheel}
  role="application"
  aria-label="Block canvas"
>
  <div 
    class="transform-layer absolute origin-top-left"
    style="transform: translate({viewport.offsetX}px, {viewport.offsetY}px) scale({viewport.scale});"
  >
    <div 
      class="grid-bg absolute pointer-events-none opacity-20"
      style="width: 10000px; height: 10000px; left: -5000px; top: -5000px; background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 20px 20px;"
    ></div>

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

    {#if graph.blocks.length === 0}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="transform: translate(5000px, 5000px);">
        <div class="text-center">
          <p class="text-text text-lg font-medium">Drag blocks from palette</p>
          <p class="text-subtext0 text-sm">or click to add them here</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .canvas-area {
    cursor: default;
  }
  .canvas-area:has([data-block-id]:active) {
    cursor: grabbing;
  }
  .canvas-area.panning {
    cursor: grabbing;
  }
</style>
