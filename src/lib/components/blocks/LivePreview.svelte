<script lang="ts">
  import { untrack } from 'svelte';
  import type { BlockGraph, ExecutionContext, PromptFragment } from '$lib/types';
  import { ExecutionEngine, executeBlock } from '$lib/blocks/execution-engine';

  interface Props {
    graph: BlockGraph;
    toggles?: Map<string, boolean>;
  }

  let { graph, toggles = new Map() }: Props = $props();

  let fragments: PromptFragment[] = $state([]);
  let output: string = $state('');
  let errors: string[] = $state([]);
  let isExecuting: boolean = $state(false);
  let lastGraphJson: string = $state('');

  // Re-execute when graph or toggles change (but not when our own state changes)
  $effect(() => {
    // Track the graph and toggles
    const currentGraph = graph;
    const currentToggles = toggles;
    
    // Create a stable representation of the graph
    const graphJson = JSON.stringify(currentGraph);
    
    // Only execute if graph actually changed
    if (graphJson !== lastGraphJson) {
      untrack(() => {
        lastGraphJson = graphJson;
      });
      executeGraph(currentGraph, currentToggles);
    }
  });

  async function executeGraph(currentGraph: BlockGraph, currentToggles: Map<string, boolean>) {
    if (isExecuting) return;
    
    // Use untrack to prevent reactive updates during execution check
    const alreadyRunning = untrack(() => isExecuting);
    if (alreadyRunning) return;
    
    isExecuting = true;

    try {
      const engine = new ExecutionEngine({ execute: executeBlock });
      const context: ExecutionContext = {
        variables: new Map(),
        toggles: currentToggles,
      };

      const result = await engine.execute(currentGraph, context);
      
      // Update state (this won't re-trigger the effect due to untrack in $effect)
      fragments = result.fragments;
      output = result.output;
      errors = result.errors.map((e) => `${e.blockType}: ${e.message}`);
    } catch (e) {
      errors = [e instanceof Error ? e.message : 'Execution failed'];
    } finally {
      isExecuting = false;
    }
  }
</script>

<div class="flex flex-col h-full bg-surface1 rounded-lg p-4">
  <h3 class="text-sm font-semibold text-text mb-3">Live Preview</h3>

  {#if isExecuting}
    <div class="flex items-center justify-center py-8 text-subtext0">
      <div class="w-4 h-4 border-2 border-surface2 border-t-mauve rounded-full animate-spin mr-2"></div>
      Executing...
    </div>
  {:else if errors.length > 0}
    <div class="bg-red/10 border border-red/30 rounded-lg p-3 mb-3">
      <div class="text-red text-sm font-medium mb-1">Errors:</div>
      {#each errors as error}
        <div class="text-red/80 text-xs">{error}</div>
      {/each}
    </div>
  {/if}

  <div class="flex-1 bg-surface0 rounded-lg p-3 overflow-y-auto min-h-[100px]">
    <div class="text-xs text-subtext0 mb-2">Generated Output:</div>
    <pre class="text-sm text-text font-mono whitespace-pre-wrap">{output || '(No output)'}</pre>
  </div>

  {#if fragments.length > 0}
    <div class="mt-3 pt-3 border-t border-surface2">
      <div class="text-xs text-subtext0 mb-2">Fragment Breakdown:</div>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        {#each fragments as fragment, i}
          <div class="text-xs p-2 bg-surface0 rounded flex items-center gap-2">
            <span class="text-mauve font-mono">{i + 1}.</span>
            <span class="text-subtext1 truncate">{fragment.sourceBlockType}</span>
            <span class="text-text truncate flex-1">{fragment.text.slice(0, 50)}{fragment.text.length > 50 ? '...' : ''}</span>
            {#if fragment.metadata?.isConditional}
              <span class="text-xs px-1 py-0.5 bg-yellow/20 text-yellow rounded">
                {fragment.metadata.conditionResult ? '✓' : '✗'}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
