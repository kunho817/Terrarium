<script lang="ts">
  import type { BlockGraph } from '$lib/types';
  import { countTokens } from '$lib/utils/tokenizer';

  interface Props {
    graph: BlockGraph;
  }

  let { graph }: Props = $props();

  const previewText = $derived(() => {
    const texts: string[] = [];
    for (const block of graph.blocks) {
      if (block.type === 'TextBlock' && block.config.content) {
        const enabled = block.config.enabled ?? true;
        if (enabled) {
          texts.push(block.config.content as string);
        }
      }
    }
    return texts.join('\n\n');
  });

  const tokenCount = $derived(countTokens(previewText()));
</script>

<div class="preview-panel flex flex-col h-full bg-surface1 rounded-lg overflow-hidden">
  <div class="preview-header flex items-center justify-between px-4 py-3 border-b border-surface2">
    <h3 class="text-sm font-semibold text-text">Live Preview</h3>
    <span class="text-xs text-subtext0">{tokenCount} tokens</span>
  </div>
  
  <div class="flex-1 p-4 overflow-y-auto">
    {#if previewText().trim()}
      <pre class="text-sm text-text whitespace-pre-wrap font-mono">{previewText()}</pre>
    {:else}
      <p class="text-sm text-subtext0 italic">Add blocks to see preview...</p>
    {/if}
  </div>
  
  <div class="px-4 py-2 border-t border-surface2 text-xs text-subtext0">
    {graph.blocks.length} block{graph.blocks.length !== 1 ? 's' : ''}
  </div>
</div>
