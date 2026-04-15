<script lang="ts">
  import type { BlockInstance, BlockGraph } from '$lib/types';
  import type { ExecutionError, PromptFragment } from '$lib/types';
  import { ExecutionEngine, executeBlock } from '$lib/blocks/execution-engine';
  import TextBlockEditor from './editors/TextBlockEditor.svelte';
  import LivePreview from './LivePreview.svelte';

  interface Props {
    mode: 'preview' | 'editor';
    selectedBlock: BlockInstance | null;
    graph: BlockGraph;
    onBlockChange?: (blockId: string, config: Record<string, unknown>) => void;
    onCloseEditor?: () => void;
  }

  let { 
    mode, 
    selectedBlock, 
    graph, 
    onBlockChange,
    onCloseEditor 
  }: Props = $props();

  // Execute graph for preview
  let fragments: PromptFragment[] = $state([]);
  let output: string = $state('');
  let errors: ExecutionError[] = $state([]);
  let isExecuting: boolean = $state(false);

  // Debounced execution
  let lastGraphJson = $state('');
  
  $effect(() => {
    const graphJson = JSON.stringify(graph);
    if (graphJson !== lastGraphJson) {
      lastGraphJson = graphJson;
      executeGraph();
    }
  });

  async function executeGraph() {
    if (isExecuting) return;
    isExecuting = true;

    try {
      const engine = new ExecutionEngine({ execute: executeBlock });
      const result = await engine.execute(graph, {
        variables: new Map(),
        toggles: new Map(),
      });
      fragments = result.fragments;
      output = result.output;
      errors = result.errors;
    } catch (e) {
      errors = [{ 
        blockId: '', 
        blockType: 'TextBlock', 
        message: String(e), 
        severity: 'error' 
      }];
    } finally {
      isExecuting = false;
    }
  }

  function handleConfigChange(config: Record<string, unknown>) {
    if (selectedBlock && onBlockChange) {
      onBlockChange(selectedBlock.id, config);
    }
  }

  // Dynamic editor component
  const EditorComponent = $derived(() => {
    if (!selectedBlock) return null;
    switch (selectedBlock.type) {
      case 'TextBlock':
        return TextBlockEditor;
      default:
        return null;
    }
  });
</script>

<div class="right-panel flex flex-col h-full bg-surface1 rounded-lg overflow-hidden">
  {#if mode === 'editor' && selectedBlock}
    <!-- Editor Mode -->
    <div class="flex items-center justify-between p-4 border-b border-surface2">
      <h3 class="text-sm font-semibold text-text">
        Edit {selectedBlock.type}
      </h3>
      <button
        class="text-xs text-subtext0 hover:text-text transition-colors"
        onclick={onCloseEditor}
      >
        ← Back to Preview
      </button>
    </div>
    
    <div class="flex-1 p-4 overflow-y-auto">
      {#if EditorComponent()}
        <svelte:component
          this={EditorComponent()}
          config={selectedBlock.config}
          onChange={handleConfigChange}
        />
      {:else}
        <p class="text-sm text-subtext0">
          No editor available for {selectedBlock.type}
        </p>
      {/if}
    </div>
  {:else}
    <!-- Preview Mode -->
    <LivePreview {fragments} {output} {errors} {isExecuting} />
  {/if}
</div>
