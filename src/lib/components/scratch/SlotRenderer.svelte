<script lang="ts">
  import type { SlotDefinition, ScratchBlock as ScratchBlockType } from '$lib/types/scratch-blocks';
  import { createBlock } from '$lib/types/scratch-blocks';
  import { getBlockDefinition } from '$lib/blocks/scratch-definitions';
  import { scratchScriptStore } from '$lib/stores/scratch-script';
  import ScratchBlock from './ScratchBlock.svelte';

  interface Props {
    slotDef: SlotDefinition;
    block?: ScratchBlockType | null;
    parentBlockId?: string;
  }

  let { slotDef, block = null, parentBlockId }: Props = $props();

  const slotClass = $derived(
    slotDef.type === 'text' ? 'text-slot' :
    slotDef.type === 'boolean' ? 'boolean-slot' :
    slotDef.type === 'chain' ? 'chain-slot' :
    slotDef.type === 'number' ? 'number-slot' :
    slotDef.type === 'list' ? 'list-slot' :
    'text-slot'
  );

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer) return;

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'new-block' && parentBlockId) {
        const definition = getBlockDefinition(parsed.blockType);
        const newBlock = createBlock(parsed.blockType, crypto.randomUUID());
        if (definition?.defaultConfig) {
          newBlock.config = { ...definition.defaultConfig };
        }
        scratchScriptStore.nestInSlot(parentBlockId, slotDef.name, newBlock);
      }
    } catch (err) {
      console.error('Slot drop error:', err);
    }
  }
</script>

<div 
  class="slot {slotClass}"
  data-slot-name={slotDef.name}
  data-slot-type={slotDef.type}
  role="region"
  aria-label="{slotDef.name} slot"
  ondragover={handleDragOver}
  ondrop={handleDrop}
>
  {#if block}
    <ScratchBlock {block} />
  {:else}
    <span class="placeholder">{slotDef.name}</span>
  {/if}
</div>

<style>
  .slot {
    min-height: 24px;
    padding: 4px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface0, #1e1e2e);
    border: 1px dashed var(--surface2, #45475a);
    transition: all 0.2s ease;
  }

  .placeholder {
    color: var(--overlay0, #6c7086);
    font-size: 0.75rem;
    text-transform: capitalize;
  }

  .text-slot {
    border-radius: 12px;
  }

  .boolean-slot {
    clip-path: polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%);
    border-radius: 0;
  }

  .chain-slot {
    border-radius: 4px;
    min-height: 48px;
    flex-direction: column;
    align-items: stretch;
  }

  .number-slot {
    border-radius: 12px;
  }

  .list-slot {
    border-radius: 12px;
    min-height: 48px;
  }
</style>
