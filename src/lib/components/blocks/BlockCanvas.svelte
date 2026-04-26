<script lang="ts">
  import type { BlockGraph, BlockInstance, Connection } from '$lib/types';
  import BlockNode from './BlockNode.svelte';
  import ConnectionLayer from './ConnectionLayer.svelte';
  import Minimap from './Minimap.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import { connectionDragStore } from '$lib/stores/connection-drag';
  import { viewportStore } from '$lib/stores/viewport';
  import { describeConnectionMode, validateConnection } from '$lib/blocks/connection-rules';

  interface Props {
    graph: BlockGraph;
    selectedBlockId: string | null;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    onBlockDoubleClick?: (blockId: string) => void;
    onBlockEdit?: (blockId: string) => void;
    onConnectionAdd?: (connection: Connection) => void;
    onBlockDelete?: (blockId: string) => void;
    onBlockDuplicate?: (blockId: string) => void;
    onBlockCollapse?: (blockId: string, collapsed: boolean) => void;
    onClearCanvas?: () => void;
    onAddBlock?: (blockType: string, position: { x: number; y: number }) => void;
    onCanvasInteract?: () => void;
  }

  let {
    graph,
    selectedBlockId,
    onBlockSelect,
    onBlockMove,
    onBlockDoubleClick,
    onBlockEdit,
    onConnectionAdd,
    onBlockDelete,
    onBlockDuplicate,
    onBlockCollapse,
    onClearCanvas,
    onAddBlock,
    onCanvasInteract,
  }: Props = $props();

  let viewport = $state($viewportStore);
  $effect(() => {
    viewport = $viewportStore;
  });

  let isDragging = $state(false);
  let dragBlockId = $state<string | null>(null);
  let dragOffset = $state({ x: 0, y: 0 });

  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0 });
  let panOffsetStart = $state({ x: 0, y: 0 });

  let contextMenu = $state<{
    visible: boolean;
    x: number;
    y: number;
    type: 'canvas' | 'node';
    blockId?: string;
    canvasX?: number;
    canvasY?: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    type: 'canvas',
  });

  let containerWidth = $state(800);
  let containerHeight = $state(600);
  let canvasElement: HTMLDivElement | null = $state(null);
  let connectionStatus = $state<{ tone: 'info' | 'error' | 'success'; message: string } | null>(null);
  let statusResetHandle: ReturnType<typeof setTimeout> | null = null;

  const connectedPorts = $derived(() => {
    const ports = new Set<string>();
    for (const connection of graph.connections) {
      ports.add(`${connection.from.blockId}-${connection.from.portId}`);
      ports.add(`${connection.to.blockId}-${connection.to.portId}`);
    }
    return ports;
  });

  function screenToCanvas(screenX: number, screenY: number, canvasRect: DOMRect) {
    const relativeX = screenX - canvasRect.left;
    const relativeY = screenY - canvasRect.top;
    return viewportStore.screenToCanvas(relativeX, relativeY);
  }

  function setConnectionStatus(message: string, tone: 'info' | 'error' | 'success' = 'info') {
    connectionStatus = { tone, message };
    if (statusResetHandle) {
      clearTimeout(statusResetHandle);
    }
    if (tone !== 'info') {
      statusResetHandle = setTimeout(() => {
        connectionStatus = null;
        statusResetHandle = null;
      }, 2200);
    }
  }

  function handleBlockMouseDown(block: BlockInstance, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    isDragging = true;
    dragBlockId = block.id;
    const rect = canvasElement?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const canvasPosition = screenToCanvas(event.clientX, event.clientY, rect);
    dragOffset = {
      x: canvasPosition.x - block.position.x,
      y: canvasPosition.y - block.position.y,
    };
    onBlockSelect?.(block.id);
  }

  function handleMouseMove(event: MouseEvent) {
    if (isPanning) {
      const deltaX = event.clientX - panStart.x;
      const deltaY = event.clientY - panStart.y;
      viewportStore.setOffset(
        panOffsetStart.x + deltaX,
        panOffsetStart.y + deltaY,
      );
      return;
    }

    if (!isDragging || !dragBlockId) {
      return;
    }

    if (!canvasElement) {
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const canvasPosition = screenToCanvas(event.clientX, event.clientY, rect);
    onBlockMove?.(dragBlockId, {
      x: Math.max(0, canvasPosition.x - dragOffset.x),
      y: Math.max(0, canvasPosition.y - dragOffset.y),
    });
  }

  function handleMouseUp() {
    isDragging = false;
    dragBlockId = null;
    isPanning = false;
  }

  function handleCanvasMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      target.classList.contains('canvas-area') ||
      target.classList.contains('grid-bg') ||
      target.classList.contains('transform-layer')
    ) {
      onCanvasInteract?.();
      if ($connectionDragStore.isDragging) {
        connectionDragStore.endDrag();
        connectionStatus = null;
        event.preventDefault();
        return;
      }
      if (event.button === 0) {
        isPanning = true;
        panStart = { x: event.clientX, y: event.clientY };
        panOffsetStart = { x: viewport.offsetX, y: viewport.offsetY };
        event.preventDefault();
      }
    }
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!canvasElement) {
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    viewportStore.zoomAt(relativeX, relativeY, event.deltaY > 0 ? -0.1 : 0.1);
  }

  function handleCanvasClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('canvas-area') || target.classList.contains('grid-bg')) {
      if ($connectionDragStore.isDragging) {
        connectionDragStore.endDrag();
        connectionStatus = null;
      }
      onBlockSelect?.(null);
    }
  }

  function handlePortMouseDown(blockId: string, portId: string, isInput: boolean, event: MouseEvent) {
    if (isInput) {
      return;
    }

    if (!canvasElement) {
      return;
    }

    const portRect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
      ?? (event.target as HTMLElement).getBoundingClientRect();
    const canvasRect = canvasElement.getBoundingClientRect();
    const position = viewportStore.screenToCanvas(
      portRect.left + portRect.width / 2 - canvasRect.left,
      portRect.top + portRect.height / 2 - canvasRect.top,
    );

    if (
      $connectionDragStore.isDragging &&
      $connectionDragStore.fromBlockId === blockId &&
      $connectionDragStore.fromPortId === portId
    ) {
      connectionDragStore.endDrag();
      connectionStatus = null;
      return;
    }

    connectionDragStore.startDrag(blockId, portId, false, position.x, position.y);
    setConnectionStatus(
      describeConnectionMode(graph, { blockId, portId }),
      'info',
    );
  }

  function handlePortMouseUp(blockId: string, portId: string, isInput: boolean, _event: MouseEvent) {
    if (!$connectionDragStore.isDragging || !isInput) {
      return;
    }

    const fromBlockId = $connectionDragStore.fromBlockId;
    const fromPortId = $connectionDragStore.fromPortId;
    if (!fromBlockId || !fromPortId) {
      connectionDragStore.endDrag();
      connectionStatus = null;
      return;
    }

    const validation = validateConnection(
      graph,
      { blockId: fromBlockId, portId: fromPortId },
      { blockId, portId },
    );

    if (!validation.ok) {
      setConnectionStatus(validation.reason || 'Connection failed.', 'error');
      if (fromBlockId === blockId) {
        return;
      }
      return;
    }

    onConnectionAdd?.({
      id: crypto.randomUUID(),
      from: { blockId: fromBlockId, portId: fromPortId },
      to: { blockId, portId },
    });
    connectionDragStore.endDrag();
    setConnectionStatus(
      `Connected ${validation.sourceType ?? 'source'} to ${validation.targetType ?? 'target'}.`,
      'success',
    );
  }

  function handleCanvasMouseMove(event: MouseEvent) {
    if (!$connectionDragStore.isDragging) {
      return;
    }

    if (!canvasElement) {
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const position = viewportStore.screenToCanvas(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    connectionDragStore.updateMouse(position.x, position.y);
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    const target = event.target as HTMLElement;
    const blockElement = target.closest('[data-block-id]');

    if (blockElement) {
      contextMenu = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        blockId: blockElement.getAttribute('data-block-id') || undefined,
      };
      return;
    }

    if (!canvasElement) {
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const canvasPosition = screenToCanvas(event.clientX, event.clientY, rect);
    containerWidth = rect.width;
    containerHeight = rect.height;
    contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'canvas',
      canvasX: canvasPosition.x,
      canvasY: canvasPosition.y,
    };
  }

  function handleContextMenuAction(action: string, data?: Record<string, string>) {
    const blockId = data?.blockId;

    if (action === 'edit' && blockId) {
      onBlockEdit?.(blockId);
      return;
    }

    if (action === 'delete' && blockId) {
      onBlockDelete?.(blockId);
      return;
    }

    if (action === 'duplicate' && blockId) {
      onBlockDuplicate?.(blockId);
      return;
    }

    if (action === 'collapse' && blockId) {
      const block = graph.blocks.find((entry) => entry.id === blockId);
      if (block) {
        onBlockCollapse?.(blockId, !block.collapsed);
      }
      return;
    }

    if (action === 'clear-canvas') {
      onClearCanvas?.();
      return;
    }

    if (action === 'add-block') {
      onAddBlock?.('TextBlock', {
        x: contextMenu.canvasX ?? 120,
        y: contextMenu.canvasY ?? 120,
      });
    }
  }

  function handleMinimapNavigate(offsetX: number, offsetY: number) {
    viewportStore.setOffset(offsetX, offsetY);
  }
</script>

<svelte:window
  onmousemove={handleMouseMove}
  onmouseup={() => {
    handleMouseUp();
  }}
/>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="canvas-area relative h-full w-full overflow-hidden rounded-lg border border-surface2 bg-mantle"
  class:panning={isPanning}
  bind:this={canvasElement}
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  onmousedown={handleCanvasMouseDown}
  onclick={handleCanvasClick}
  oncontextmenu={handleContextMenu}
  onmousemove={handleCanvasMouseMove}
  onwheel={handleWheel}
  onkeydown={(event) => {
    if (event.key === 'Escape') {
      if ($connectionDragStore.isDragging) {
        connectionDragStore.endDrag();
        connectionStatus = null;
      }
      onBlockSelect?.(null);
    }
    if (event.key === 'Delete' && selectedBlockId) {
      onBlockDelete?.(selectedBlockId);
    }
  }}
  role="application"
  aria-label="Prompt builder canvas"
  tabindex="0"
>
  <div
    class="transform-layer absolute origin-top-left"
    style="transform: translate({viewport.offsetX}px, {viewport.offsetY}px) scale({viewport.scale});"
  >
    <div
      class="grid-bg pointer-events-none absolute opacity-20"
      style="left: -5000px; top: -5000px; width: 10000px; height: 10000px; background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 24px 24px;"
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
        style="left: {block.position.x}px; top: {block.position.y}px; z-index: {block.id === selectedBlockId ? 20 : 10};"
      >
        <BlockNode
          {block}
          isSelected={block.id === selectedBlockId}
          connectedPorts={connectedPorts()}
          onSelect={() => onBlockSelect?.(block.id)}
          onDoubleClick={() => onBlockDoubleClick?.(block.id)}
          onEdit={() => onBlockEdit?.(block.id)}
          onDragStart={(event) => handleBlockMouseDown(block, event)}
          onPortMouseDown={(portId, isInput, event) => handlePortMouseDown(block.id, portId, isInput, event)}
          onPortMouseUp={(portId, isInput, event) => handlePortMouseUp(block.id, portId, isInput, event)}
          onCollapse={() => onBlockCollapse?.(block.id, !block.collapsed)}
        />
      </div>
    {/each}

    {#if graph.blocks.length === 0}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="transform: translate(5000px, 5000px);">
        <div class="text-center">
          <p class="text-lg font-medium text-text">Drag blocks from the palette</p>
          <p class="text-sm text-subtext0">or right-click to drop a text block here</p>
        </div>
      </div>
    {/if}
  </div>

  {#if graph.blocks.length > 0}
    <Minimap
      {graph}
      scale={viewport.scale}
      offsetX={viewport.offsetX}
      offsetY={viewport.offsetY}
      {containerWidth}
      {containerHeight}
      onNavigate={handleMinimapNavigate}
    />
  {/if}

  {#if connectionStatus || $connectionDragStore.isDragging}
    <div class="pointer-events-none absolute bottom-4 left-4 z-30 max-w-md rounded-md border border-surface2 bg-surface1/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p
        class:text-subtext0={!connectionStatus || connectionStatus.tone === 'info'}
        class:text-red={connectionStatus?.tone === 'error'}
        class:text-green={connectionStatus?.tone === 'success'}
      >
        {connectionStatus?.message ?? describeConnectionMode(graph, $connectionDragStore.fromBlockId && $connectionDragStore.fromPortId
          ? { blockId: $connectionDragStore.fromBlockId, portId: $connectionDragStore.fromPortId }
          : null)}
      </p>
    </div>
  {/if}
</div>

{#if contextMenu.visible}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    type={contextMenu.type}
    blockId={contextMenu.blockId}
    onAction={handleContextMenuAction}
    onClose={() => {
      contextMenu.visible = false;
    }}
  />
{/if}

<style>
  .canvas-area {
    cursor: default;
  }

  .canvas-area:has([data-block-id]:active),
  .canvas-area.panning {
    cursor: grabbing;
  }
</style>
