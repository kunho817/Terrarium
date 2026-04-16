<script lang="ts">
  import { scratchScriptStore } from '$lib/stores/scratch-script';
  import ScratchBlock from './ScratchBlock.svelte';

  let { }: {} = $props();

  const scriptState = $derived($scratchScriptStore);
  const hasBlocks = $derived(scriptState.currentScript !== null);

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

    const parsed = JSON.parse(data);
    if (parsed.type === 'new-block') {
      import('$lib/types/scratch-blocks').then(({ createBlock }) => {
        const block = createBlock(parsed.blockType, crypto.randomUUID());
        scratchScriptStore.appendToChain(block);
      });
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
  {#if hasBlocks && scriptState.currentScript?.root}
    <div class="blocks">
      <ScratchBlock block={scriptState.currentScript.root} />
      {#if scriptState.currentScript.root.next}
        <ScratchBlock block={scriptState.currentScript.root.next} />
      {/if}
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
