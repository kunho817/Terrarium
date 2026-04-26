<script lang="ts">
  import type { Connection, BlockInstance, Port } from '$lib/types';
  import { getBlockInputPorts, getBlockOutputPorts } from '$lib/blocks/ports';

  // Layout constants - must match BlockNode.svelte dimensions
  const HEADER_HEIGHT = 40; // Height of block header in pixels
  const PORT_Y_OFFSET = 17; // Starting Y offset for ports within block body
  const PORT_SPACING = 28; // Vertical spacing between ports in pixels
  const BLOCK_WIDTH = 288; // Total block width in pixels (18rem)
  const BEZIER_CONTROL_FACTOR = 0.5; // Control point offset as fraction of horizontal distance
  
  // Visual constants
  const CONNECTION_COLOR = '#a6e3a1'; // Green for connections
  const PREVIEW_COLOR = '#cba6f7'; // Purple for live preview
  const STROKE_WIDTH = 2;
  const OPACITY = 0.8;
  const ARROW_SIZE = 8; // Width of arrow head
  const ARROW_HALF_HEIGHT = 4; // Half-height of arrow head
  const DASH_PATTERN = '5,3'; // Dash pattern for live preview line

  interface Props {
    connections: Connection[];
    blocks: BlockInstance[];
    livePreview: {
      fromBlockId: string;
      fromPortId: string;
      mouseX: number;
      mouseY: number;
    } | null;
  }

  let { connections, blocks, livePreview }: Props = $props();

  /**
   * Calculate the absolute canvas position of a port.
   * Ports are positioned below the block header with 20px vertical spacing.
   * Input ports are at the left edge (x=0), output ports at the right edge (x=BLOCK_WIDTH).
   */
  function getPortPosition(blockId: string, portId: string, isInput: boolean): { x: number; y: number } | null {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return null;

    const ports = isInput ? getBlockInputPorts(block) : getBlockOutputPorts(block);
    const portIndex = ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return null;

    // Port Y position: below header + offset + spacing between ports
    // Port center aligns with container top due to top:50% + translateY(-50%) on 0-height container
    const portY = HEADER_HEIGHT + PORT_Y_OFFSET + portIndex * PORT_SPACING;
    
    return {
      x: block.position.x + (isInput ? 0 : BLOCK_WIDTH),
      y: block.position.y + portY,
    };
  }

  /**
   * Generate a cubic bezier curve path between two points.
   * Control points are placed horizontally outward from each endpoint
   * at a distance proportional to the horizontal separation (BEZIER_CONTROL_FACTOR * |dx|).
   * This creates smooth curves that flow naturally between blocks.
   */
  function getConnectionPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const dx = to.x - from.x;
    const controlOffset = Math.abs(dx) * BEZIER_CONTROL_FACTOR;
    
    return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`;
  }
</script>

<svg 
  class="connection-layer absolute pointer-events-none" 
  style="left: 0; top: 0; width: 12000px; height: 12000px; overflow: visible; z-index: 1;"
>
  <!-- Existing connections -->
  {#each connections as conn (conn.id)}
    {@const fromPos = getPortPosition(conn.from.blockId, conn.from.portId, false)}
    {@const toPos = getPortPosition(conn.to.blockId, conn.to.portId, true)}
    
    {#if fromPos && toPos}
      <path
        d={getConnectionPath(fromPos, toPos)}
        stroke={CONNECTION_COLOR}
        stroke-width={STROKE_WIDTH}
        fill="none"
        opacity={OPACITY}
      />
      <!-- Arrow head at target (points left toward input port) -->
      <polygon
        points="{toPos.x},{toPos.y} {toPos.x - ARROW_SIZE},{toPos.y - ARROW_HALF_HEIGHT} {toPos.x - ARROW_SIZE},{toPos.y + ARROW_HALF_HEIGHT}"
        fill={CONNECTION_COLOR}
        opacity={OPACITY}
      />
    {/if}
  {/each}

  <!-- Live preview line during port drag -->
  {#if livePreview}
    {@const fromPos = getPortPosition(livePreview.fromBlockId, livePreview.fromPortId, false)}
    {#if fromPos}
      <path
        d="M {fromPos.x} {fromPos.y} L {livePreview.mouseX} {livePreview.mouseY}"
        stroke={PREVIEW_COLOR}
        stroke-width={STROKE_WIDTH}
        stroke-dasharray={DASH_PATTERN}
        fill="none"
      />
    {/if}
  {/if}
</svg>
