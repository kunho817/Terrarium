<script lang="ts">
  import type { BlockGraph, BlockInstance, Port, Connection } from '$lib/types';
  import type { ViewportState } from '$lib/stores/viewport';
  import BlockNode from './BlockNode.svelte';
  import ConnectionLayer from './ConnectionLayer.svelte';
  import Toolbar from './Toolbar.svelte';

  interface Props {
    graph: BlockGraph;
    viewport: ViewportState;
    selectedBlockId: string | null;
    onBlockSelect: (blockId: string) => void;
    onBlockDoubleClick: (blockId: string) => void;
    onBlockDrag: (blockId: string, position: { x: number; y: number }) => void;
    onPortDragStart: (blockId: string, port: Port, e: MouseEvent) => void;
    onCanvasPan: (dx: number, dy: number) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomReset: () => void;
    onFitToScreen: () => void;
  }

  let {
    graph,
    viewport,
    selectedBlockId,
    onBlockSelect,
    onBlockDoubleClick,
    onBlockDrag,
    onPortDragStart,
    onCanvasPan,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onFitToScreen,
  }: Props = $props();

  // Canvas container ref
  let canvasContainer: HTMLDivElement;

  // Drag state
  let dragMode: 'none' | 'block' | 'pan' = $state('none');
  let dragStartPos = $state({ x: 0, y: 0 });
  let dragStartMouse = $state({ x: 0, y: 0 });
  let draggedBlockId: string | null = $state(null);

  // Track if space key is held for pan mode
  let isSpacePressed = $state(false);

  // Connected ports tracking - computed once per graph change
  const connectedPortIds = $derived.by(() => {
    const connected = new Set<string>();
    for (const conn of graph.connections) {
      connected.add(`${conn.from.blockId}-${conn.from.portId}`);
      connected.add(`${conn.to.blockId}-${conn.to.portId}`);
    }
    return connected;
  });

  // Transform style for canvas content
  const canvasTransform = $derived(
    `translate(${-viewport.x * viewport.zoom + 400}px, ${-viewport.y * viewport.zoom + 300}px) scale(${viewport.zoom})`
  );

  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = canvasContainer?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    return {
      x: (canvasX - 400) / viewport.zoom + viewport.x,
      y: (canvasY - 300) / viewport.zoom + viewport.y,
    };
  }

  // Mouse event handlers
  function handleMouseDown(e: MouseEvent) {
    // Middle mouse or Space+click = pan
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      dragMode = 'pan';
      dragStartMouse = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // Click on empty space = deselect
    if (e.target === canvasContainer || (e.target as HTMLElement).classList.contains('grid-background')) {
      onBlockSelect(''); // Deselect
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (dragMode === 'none') return;

    if (dragMode === 'pan') {
      const dx = e.clientX - dragStartMouse.x;
      const dy = e.clientY - dragStartMouse.y;
      onCanvasPan(-dx, -dy); // Negative because we're moving camera opposite
      dragStartMouse = { x: e.clientX, y: e.clientY };
    } else if (dragMode === 'block' && draggedBlockId) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      onBlockDrag(draggedBlockId, {
        x: worldPos.x - dragStartPos.x,
        y: worldPos.y - dragStartPos.y,
      });
    }
  }

  function handleMouseUp() {
    dragMode = 'none';
    draggedBlockId = null;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    if (e.deltaY > 0) {
      onZoomOut();
    } else {
      onZoomIn();
    }
  }

  // Block-specific handlers
  function handleBlockDragStart(blockId: string, e: MouseEvent) {
    dragMode = 'block';
    draggedBlockId = blockId;
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const block = graph.blocks.find(b => b.id === blockId);
    if (block) {
      dragStartPos = {
        x: worldPos.x - block.position.x,
        y: worldPos.y - block.position.y,
      };
    }
    dragStartMouse = { x: e.clientX, y: e.clientY };
  }

  // Handle port activation (BlockNode calls this for both mouse and keyboard)
  function handlePortActivate(blockId: string, port: Port, _isInput: boolean, e: MouseEvent | KeyboardEvent) {
    // Only handle mouse events for drag start
    if (e instanceof MouseEvent) {
      onPortDragStart(blockId, port, e);
    }
  }

  // Keyboard handlers
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === ' ') {
      isSpacePressed = true;
    }
    if (e.key === 'Delete' && selectedBlockId) {
      // Emit delete event (parent handles)
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === ' ') {
      isSpacePressed = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<div
  bind:this={canvasContainer}
  class="canvas-container relative w-full h-full overflow-hidden bg-base rounded-lg"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onwheel={handleWheel}
  tabindex="0"
  role="region"
  aria-label="Block canvas"
>
  <!-- Grid Background -->
  <div 
    class="grid-background absolute inset-0 opacity-10 pointer-events-none"
    style="
      background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px);
      background-size: 20px 20px;
      transform: {canvasTransform};
    "
  ></div>

  <!-- Connection Layer -->
  <div 
    class="absolute inset-0 pointer-events-none"
    style="transform: {canvasTransform};"
  >
    <ConnectionLayer 
      connections={graph.connections} 
      blocks={graph.blocks}
      livePreview={null}
    />
  </div>

  <!-- Blocks Layer -->
  <div 
    class="absolute inset-0"
    style="transform: {canvasTransform};"
  >
    {#each graph.blocks as block (block.id)}
      <BlockNode
        {block}
        isSelected={block.id === selectedBlockId}
        onSelect={() => onBlockSelect(block.id)}
        onDoubleClick={() => onBlockDoubleClick(block.id)}
        onDragStart={(e) => handleBlockDragStart(block.id, e)}
        onPortActivate={(port, isInput, e) => handlePortActivate(block.id, port, isInput, e)}
        {connectedPortIds}
      />
    {/each}
  </div>

  <!-- Empty State -->
  {#if graph.blocks.length === 0}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="text-center text-subtext0">
        <p class="text-lg mb-2">Drag blocks from palette</p>
        <p class="text-sm">or click to add them here</p>
      </div>
    </div>
  {/if}

  <!-- Toolbar (fixed position, not transformed) -->
  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
    <Toolbar
      {viewport}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onReset={onZoomReset}
      onFit={onFitToScreen}
    />
  </div>
</div>

<style>
  .canvas-container {
    cursor: grab;
  }
  .canvas-container:active {
    cursor: grabbing;
  }
</style>
