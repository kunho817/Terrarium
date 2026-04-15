<script lang="ts">
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import ConnectionLine from './ConnectionLine.svelte';

  interface Props {
    graph: BlockGraph;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
  }

  let { graph, onBlockMove }: Props = $props();

  let canvasRef: HTMLDivElement;
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let draggedBlockId: string | null = $state(null);

  function handleMouseDown(e: MouseEvent, block: BlockInstance) {
    if (e.button !== 0) return;
    
    isDragging = true;
    draggedBlockId = block.id;
    dragOffset = {
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y,
    };
    
    e.stopPropagation();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !draggedBlockId) return;
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };
    
    onBlockMove?.(draggedBlockId, newPosition);
  }

  function handleMouseUp() {
    isDragging = false;
    draggedBlockId = null;
  }
</script>

<div
  bind:this={canvasRef}
  data-testid="block-canvas"
  class="relative w-full h-full bg-surface0 rounded-lg overflow-hidden"
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  role="region"
  aria-label="Block canvas"
>
  <!-- Grid background -->
  <div
    class="absolute inset-0 opacity-10"
    style="background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 20px 20px;"
  ></div>

  <!-- Empty state -->
  {#if graph.blocks.length === 0}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-subtext0">
        <p class="text-lg mb-2">Drag blocks here</p>
        <p class="text-sm">Connect them to build your prompt</p>
      </div>
    </div>
  {/if}

  <!-- Connection lines -->
  {#each graph.connections as connection (connection.id)}
    <ConnectionLine {connection} blocks={graph.blocks} />
  {/each}

  <!-- Blocks -->
  {#each graph.blocks as block (block.id)}
    <div
      class="absolute p-3 bg-surface1 rounded-lg border border-surface2 shadow-lg cursor-move select-none"
      style="left: {block.position.x}px; top: {block.position.y}px;"
      onmousedown={(e) => handleMouseDown(e, block)}
      role="button"
      aria-label="Block {block.type}"
    >
      <div class="text-sm font-medium text-text">{block.type}</div>
      <div class="text-xs text-subtext0 mt-1">ID: {block.id.slice(0, 8)}</div>
    </div>
  {/each}
</div>
