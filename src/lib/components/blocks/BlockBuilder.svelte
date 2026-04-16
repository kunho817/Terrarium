<script lang="ts">
  import type { BlockGraph } from '$lib/types';
  import BlockPalette from './BlockPalette.svelte';
  import BlockCanvas from './BlockCanvas.svelte';
  import BlockPreview from './BlockPreview.svelte';

  interface Props {
    graph: BlockGraph;
    onBlockAdd?: (blockType: string) => void;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    selectedBlockId?: string | null;
  }

  let { 
    graph, 
    onBlockAdd, 
    onBlockSelect,
    onBlockMove,
    selectedBlockId 
  }: Props = $props();

  function handleBlockClick(blockType: string) {
    onBlockAdd?.(blockType);
  }

  function handleBlockSelect(blockId: string) {
    onBlockSelect?.(blockId || null);
  }

  function handleBlockDrag(blockId: string, position: { x: number; y: number }) {
    onBlockMove?.(blockId, position);
  }

  function handleCanvasPan(_dx: number, _dy: number) {
    // Pan handler - would update viewport
  }

  function handleZoomIn() {
    // Zoom in handler
  }

  function handleZoomOut() {
    // Zoom out handler
  }

  function handleZoomReset() {
    // Reset zoom handler
  }

  function handleFitToScreen() {
    // Fit to screen handler
  }

  function handleBlockDoubleClick(_blockId: string) {
    // Double click handler
  }

  function handlePortDragStart(_blockId: string, _port: { id: string; type: string }, _e: MouseEvent) {
    // Port drag handler
  }
</script>

<div class="block-builder grid gap-4" style="grid-template-columns: 200px 1fr 250px; height: 500px;">
  <BlockPalette onBlockClick={handleBlockClick} />
  
  <BlockCanvas 
    {graph} 
    viewport={graph.viewport}
    selectedBlockId={selectedBlockId ?? null}
    onBlockSelect={handleBlockSelect}
    onBlockDoubleClick={handleBlockDoubleClick}
    onBlockDrag={handleBlockDrag}
    onPortDragStart={handlePortDragStart}
    onCanvasPan={handleCanvasPan}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
    onZoomReset={handleZoomReset}
    onFitToScreen={handleFitToScreen}
  />
  
  <BlockPreview {graph} />
</div>
