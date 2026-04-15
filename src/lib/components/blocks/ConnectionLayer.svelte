<script lang="ts">
  import type { Connection, BlockInstance, Port } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';

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

  function getPortPosition(blockId: string, portId: string, isInput: boolean): { x: number; y: number } | null {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return null;

    const definition = blockRegistry.get(block.type);
    if (!definition) return null;

    const ports = isInput ? definition.inputPorts : definition.outputPorts;
    const portIndex = ports.findIndex(p => p.id === portId);
    if (portIndex === -1) return null;

    // Port positions relative to block
    const portY = 40 + portIndex * 20; // Below header + spacing
    
    return {
      x: block.position.x + (isInput ? 0 : 208), // 0 for input (left), 208 for output (right, block width 200 + margin)
      y: block.position.y + portY,
    };
  }

  function getConnectionPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const dx = to.x - from.x;
    const controlOffset = Math.abs(dx) * 0.5;
    
    return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`;
  }
</script>

<svg class="connection-layer absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
  <!-- Existing connections -->
  {#each connections as conn (conn.id)}
    {@const fromPos = getPortPosition(conn.from.blockId, conn.from.portId, false)}
    {@const toPos = getPortPosition(conn.to.blockId, conn.to.portId, true)}
    
    {#if fromPos && toPos}
      <path
        d={getConnectionPath(fromPos, toPos)}
        stroke="#a6e3a1"
        stroke-width="2"
        fill="none"
        opacity="0.8"
      />
      <!-- Arrow head at target -->
      <polygon
        points="{toPos.x},{toPos.y} {toPos.x - 8},{toPos.y - 4} {toPos.x - 8},{toPos.y + 4}"
        fill="#a6e3a1"
        opacity="0.8"
      />
    {/if}
  {/each}

  <!-- Live preview line -->
  {#if livePreview}
    {@const fromPos = getPortPosition(livePreview.fromBlockId, livePreview.fromPortId, false)}
    {#if fromPos}
      <path
        d="M {fromPos.x} {fromPos.y} L {livePreview.mouseX} {livePreview.mouseY}"
        stroke="#cba6f7"
        stroke-width="2"
        stroke-dasharray="5,3"
        fill="none"
      />
    {/if}
  {/if}
</svg>
