<script lang="ts">
  import type { BlockGraph } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';

  interface Props {
    graph: BlockGraph;
    scale: number;
    offsetX: number;
    offsetY: number;
    containerWidth: number;
    containerHeight: number;
    onNavigate?: (x: number, y: number) => void;
  }

  let {
    graph,
    scale,
    offsetX,
    offsetY,
    containerWidth,
    containerHeight,
    onNavigate
  }: Props = $props();

  const MINIMAP_WIDTH = 160;
  const MINIMAP_HEIGHT = 100;
  const BLOCK_VISUAL_SIZE = 208;
  const PADDING = 20;

  const categoryColors: Record<string, string> = {
    foundation: '#89b4fa',
    logic: '#f38ba8',
    data: '#a6e3a1',
    structure: '#94e2d5',
  };

  const bounds = $derived(() => {
    if (graph.blocks.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const block of graph.blocks) {
      minX = Math.min(minX, block.position.x);
      minY = Math.min(minY, block.position.y);
      maxX = Math.max(maxX, block.position.x + BLOCK_VISUAL_SIZE);
      maxY = Math.max(maxY, block.position.y + BLOCK_VISUAL_SIZE);
    }

    return { minX, minY, maxX, maxY };
  });

  const minimapScale = $derived(() => {
    const b = bounds();
    const width = b.maxX - b.minX;
    const height = b.maxY - b.minY;
    return Math.min(
      (MINIMAP_WIDTH - PADDING * 2) / width,
      (MINIMAP_HEIGHT - PADDING * 2) / height
    );
  });

  function blockToMinimap(block: { position: { x: number; y: number } }): { x: number; y: number } {
    const b = bounds();
    return {
      x: (block.position.x - b.minX) * minimapScale() + PADDING,
      y: (block.position.y - b.minY) * minimapScale() + PADDING
    };
  }

  function getBlockColor(type: string): string {
    const definition = blockRegistry.get(type as any);
    if (definition && definition.category in categoryColors) {
      return categoryColors[definition.category];
    }
    return '#6c7086';
  }

  const viewportRect = $derived(() => {
    const b = bounds();
    const ms = minimapScale();
    const vx = (-offsetX - b.minX) * ms + PADDING;
    const vy = (-offsetY - b.minY) * ms + PADDING;
    const vw = containerWidth / scale * ms;
    const vh = containerHeight / scale * ms;
    return { x: vx, y: vy, width: vw, height: vh };
  });

  function handleClick(e: MouseEvent) {
    if (!onNavigate) return;

    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const b = bounds();
    const ms = minimapScale();

    const canvasX = (clickX - PADDING) / ms + b.minX;
    const canvasY = (clickY - PADDING) / ms + b.minY;

    onNavigate(-canvasX + containerWidth / scale / 2, -canvasY + containerHeight / scale / 2);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
    }
  }
</script>

<div class="minimap">
  <svg
    width={MINIMAP_WIDTH}
    height={MINIMAP_HEIGHT}
    role="button"
    tabindex="0"
    aria-label="Minimap - click to navigate"
    onclick={handleClick}
    onkeydown={handleKeyDown}
  >
    {#each graph.blocks as block}
      {@const pos = blockToMinimap(block)}
      {@const size = BLOCK_VISUAL_SIZE * minimapScale()}
      <rect
        x={pos.x}
        y={pos.y}
        width={size}
        height={size * 0.6}
        fill={getBlockColor(block.type)}
        rx="2"
      />
    {/each}

    <rect
      x={viewportRect().x}
      y={viewportRect().y}
      width={viewportRect().width}
      height={viewportRect().height}
      fill="none"
      stroke="#cba6f7"
      stroke-width="1"
      rx="2"
    />
  </svg>

  <span class="zoom-indicator">{Math.round(scale * 100)}%</span>
</div>

<style>
  .minimap {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 160px;
    height: 100px;
    background: rgba(30, 30, 46, 0.9);
    border: 1px solid #45475a;
    border-radius: 8px;
    overflow: hidden;
  }

  svg {
    display: block;
  }

  .zoom-indicator {
    position: absolute;
    bottom: 4px;
    right: 4px;
    font-size: 10px;
    color: #a6adc8;
    pointer-events: none;
  }
</style>
