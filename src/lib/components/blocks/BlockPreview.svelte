<script lang="ts">
  import type { BlockGraph } from '$lib/types';

  interface Props {
    graph: BlockGraph;
  }

  let { graph }: Props = $props();
</script>

<div class="block-preview h-full bg-surface1 rounded-lg p-4 overflow-y-auto">
  <h3 class="text-sm font-semibold text-text mb-4">Preview</h3>
  <div class="text-sm text-subtext0">
    {#if graph.blocks.length === 0}
      <p>No blocks to preview</p>
    {:else}
      <p>{graph.blocks.length} block(s)</p>
    {/if}
  </div>
</div>
