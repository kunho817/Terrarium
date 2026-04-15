<script lang="ts">
  import type { Connection, BlockInstance } from '$lib/types';

  interface Props {
    connection: Connection;
    blocks: BlockInstance[];
    color?: string;
  }

  let { connection, blocks, color = '#a6e3a1' }: Props = $props();

  // Find source and target blocks
  const sourceBlock = $derived(blocks.find((b) => b.id === connection.from.blockId));
  const targetBlock = $derived(blocks.find((b) => b.id === connection.to.blockId));

  // Calculate connection points (simplified - assumes center of blocks)
  const sourceX = $derived((sourceBlock?.position.x || 0) + 110); // block width/2
  const sourceY = $derived((sourceBlock?.position.y || 0) + 30); // block height/2
  const targetX = $derived((targetBlock?.position.x || 0) - 10); // left edge
  const targetY = $derived((targetBlock?.position.y || 0) + 30); // block height/2

  // Bezier curve control points
  const controlOffset = $derived(50);
  const cp1x = $derived(sourceX + controlOffset);
  const cp1y = $derived(sourceY);
  const cp2x = $derived(targetX - controlOffset);
  const cp2y = $derived(targetY);

  const pathD = $derived(
    `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`
  );
</script>

{#if sourceBlock && targetBlock}
  <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
    <path
      d={pathD}
      stroke={color}
      stroke-width="2"
      fill="none"
      stroke-dasharray="0"
      opacity="0.8"
    />
    <!-- Arrow head -->
    <polygon
      points="{targetX},{targetY} {targetX - 8},{targetY - 4} {targetX - 8},{targetY + 4}"
      fill={color}
      opacity="0.8"
    />
  </svg>
{/if}
