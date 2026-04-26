<script lang="ts">
  import type {
    BlockGraph,
    BlockInstance,
    ExecutionError,
    PromptBlockToggle,
    PromptFragment,
  } from '$lib/types';
  import { ExecutionEngine } from '$lib/blocks/execution-engine';
  import { executeBlock } from '$lib/blocks/executors';
  import { countTokens } from '$lib/utils/tokenizer';
  import BlockConfigEditor from './editors/BlockConfigEditor.svelte';

  interface Props {
    selectedBlock: BlockInstance | null;
    graph: BlockGraph;
    toggles: PromptBlockToggle[];
    onBlockChange?: (blockId: string, config: Record<string, unknown>) => void;
    onCloseEditor?: () => void;
    onToggleChange?: (toggleId: string, value: boolean) => void;
  }

  let {
    selectedBlock,
    graph,
    toggles,
    onBlockChange,
    onCloseEditor,
    onToggleChange,
  }: Props = $props();

  let fragments = $state<PromptFragment[]>([]);
  let output = $state('');
  let errors = $state<ExecutionError[]>([]);
  let isExecuting = $state(false);
  let lastSignature = $state('');

  const tokenCount = $derived(countTokens(output));

  $effect(() => {
    const signature = JSON.stringify({
      graph,
      toggles,
    });

    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;
    void executeGraph();
  });

  async function executeGraph() {
    if (isExecuting) {
      return;
    }

    isExecuting = true;
    try {
      const engine = new ExecutionEngine({ execute: executeBlock });
      const result = await engine.execute(graph, {
        variables: new Map(),
        toggles: new Map(toggles.map((toggle) => [toggle.id, toggle.value])),
      });
      fragments = result.fragments;
      output = result.output;
      errors = result.errors;
    } catch (error) {
      fragments = [];
      output = '';
      errors = [{
        blockId: '',
        blockType: 'TextBlock',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
      }];
    } finally {
      isExecuting = false;
    }
  }

  function handleConfigChange(config: Record<string, unknown>) {
    if (!selectedBlock || !onBlockChange) {
      return;
    }
    onBlockChange(selectedBlock.id, config);
  }
</script>

<div class="flex h-full flex-col overflow-hidden bg-surface1">
  {#if selectedBlock}
    <header class="flex items-center justify-between border-b border-surface2 px-4 py-3">
      <div>
        <h3 class="text-sm font-semibold text-text">{selectedBlock.type}</h3>
        <p class="text-xs text-subtext0">Selected block editor</p>
      </div>
      <button
        class="rounded border border-surface2 px-2 py-1 text-xs text-subtext0 transition-colors hover:border-mauve hover:text-text"
        onclick={onCloseEditor}
      >
        Back to Preview
      </button>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <BlockConfigEditor block={selectedBlock} onChange={handleConfigChange} />
    </div>
  {:else}
    <header class="flex items-center justify-between border-b border-surface2 px-4 py-3">
      <div>
        <h3 class="text-sm font-semibold text-text">Live Preview</h3>
        <p class="text-xs text-subtext0">Approx. {tokenCount} tokens</p>
      </div>
      {#if isExecuting}
        <span class="text-xs text-subtext0">Refreshing...</span>
      {/if}
    </header>

    {#if errors.length > 0}
      <div class="border-b border-red/20 bg-red/10 px-4 py-3">
        {#each errors as error}
          <p class="text-xs text-red">{error.blockType}: {error.message}</p>
        {/each}
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="rounded border border-surface2 bg-surface0 p-3">
        <div class="mb-2 text-xs uppercase tracking-wide text-subtext0">Output</div>
        <pre class="whitespace-pre-wrap break-words font-mono text-sm text-text">{output || '(No output yet)'}</pre>
      </div>

      {#if toggles.length > 0}
        <div class="rounded border border-surface2 bg-surface0 p-3">
          <div class="mb-2 text-xs uppercase tracking-wide text-subtext0">Preview Toggles</div>
          <div class="space-y-2">
            {#each toggles as toggle}
              <label class="flex items-center justify-between gap-3 rounded border border-surface2 px-3 py-2">
                <span class="text-sm text-text">{toggle.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={toggle.value}
                  aria-label={`Toggle ${toggle.name}`}
                  class="h-6 w-11 rounded-full transition-colors"
                  style="background: {toggle.value ? '#a6e3a1' : '#45475a'};"
                  onclick={() => onToggleChange?.(toggle.id, !toggle.value)}
                >
                  <span
                    class="block h-5 w-5 rounded-full bg-white transition-transform"
                    style="transform: translate({toggle.value ? 20 : 2}px, 0.5px);"
                  ></span>
                </button>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <div class="rounded border border-surface2 bg-surface0 p-3">
        <div class="mb-2 text-xs uppercase tracking-wide text-subtext0">Fragments</div>
        <div class="space-y-2">
          {#if fragments.length === 0}
            <p class="text-sm text-subtext0">No fragments generated.</p>
          {:else}
            {#each fragments as fragment, index}
              <div class="rounded border border-surface2 px-3 py-2">
                <div class="mb-1 flex items-center justify-between text-xs text-subtext0">
                  <span>{index + 1}. {fragment.sourceBlockType}</span>
                  <span>{countTokens(fragment.text)} tok</span>
                </div>
                <pre class="whitespace-pre-wrap break-words font-mono text-xs text-text">{fragment.text}</pre>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
