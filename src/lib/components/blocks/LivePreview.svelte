<script lang="ts">
  import type { PromptFragment, ExecutionError } from '$lib/types';

  interface Props {
    fragments: PromptFragment[];
    output: string;
    errors: ExecutionError[];
    isExecuting: boolean;
  }

  let { fragments, output, errors, isExecuting }: Props = $props();
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between p-4 border-b border-surface2">
    <h3 class="text-sm font-semibold text-text">Live Preview</h3>
    {#if isExecuting}
      <span class="text-xs text-subtext0">Executing...</span>
    {/if}
  </div>

  {#if errors.length > 0}
    <div class="p-4 bg-red/10 border-b border-red/20">
      {#each errors as error}
        <p class="text-xs text-red">{error.blockType}: {error.message}</p>
      {/each}
    </div>
  {/if}

  <div class="flex-1 p-4 overflow-y-auto">
    <div class="text-xs text-subtext0 mb-2">Generated Output:</div>
    <pre class="text-sm text-text font-mono whitespace-pre-wrap bg-surface0 p-3 rounded">{output || '(No output)'}</pre>
    
    {#if fragments.length > 0}
      <div class="mt-4 pt-4 border-t border-surface2">
        <div class="text-xs text-subtext0 mb-2">Fragments ({fragments.length}):</div>
        {#each fragments as fragment, i}
          <div class="text-xs p-2 bg-surface0 rounded mb-1">
            {i + 1}. {fragment.sourceBlockType}: {fragment.text.slice(0, 50)}...
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
