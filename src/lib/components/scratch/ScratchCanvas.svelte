<script lang="ts">
  import { scratchScriptStore } from '$lib/stores/scratch-script';
  import { createBlock } from '$lib/types/scratch-blocks';
  import { getBlockDefinition } from '$lib/blocks/scratch-definitions';
  import ScratchBlock from './ScratchBlock.svelte';
  import type { ScratchBlock as ScratchBlockType } from '$lib/types/scratch-blocks';

  let { }: {} = $props();

  const scriptState = $derived($scratchScriptStore);
  const hasBlocks = $derived(scriptState.currentScript !== null);

  function collectChain(block: ScratchBlockType | null): ScratchBlockType[] {
    if (!block) return [];
    return [block, ...collectChain(block.next)];
  }

  const chainBlocks = $derived(
    scriptState.currentScript?.root ? collectChain(scriptState.currentScript.root) : []
  );

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer) return;

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'new-block') {
        const definition = getBlockDefinition(parsed.blockType);
        const block = createBlock(parsed.blockType, crypto.randomUUID());
        if (definition?.defaultConfig) {
          block.config = { ...definition.defaultConfig };
        }

        if (!scriptState.currentScript) {
          scratchScriptStore.newScript('Untitled');
        }
        scratchScriptStore.appendToChain(block);
      }
    } catch (err) {
      console.error('Drop handling error:', err);
    }
  }
</script>

<div
  class="scratch-canvas"
  ondragover={handleDragOver}
  ondrop={handleDrop}
  role="region"
  aria-label="Script canvas"
>
  {#if hasBlocks && chainBlocks.length > 0}
    <div class="blocks">
      {#each chainBlocks as block}
        <ScratchBlock {block} isOnCanvas={true} />
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <p>Drag a block from the palette to start building your prompt</p>
    </div>
  {/if}
</div>

<style>
  .scratch-canvas {
    flex: 1;
    min-height: 200px;
    padding: 16px;
    background: var(--base, #1e1e2e);
    border-radius: 8px;
    overflow-y: auto;
  }

  .blocks {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 180px;
    color: var(--overlay0, #9399b2);
    text-align: center;
  }

  .empty-state p {
    margin: 0;
  }
</style>
