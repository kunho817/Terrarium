<script lang="ts">
  import type { ScratchBlock as ScratchBlockType } from '$lib/types/scratch-blocks';
  import { getBlockDefinition } from '$lib/blocks/scratch-definitions';
  import SlotRenderer from './SlotRenderer.svelte';

  interface Props {
    block: ScratchBlockType;
  }

  let { block }: Props = $props();

  const definition = $derived(getBlockDefinition(block.type));

  function handleDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'existing-block',
      blockId: block.id,
    }));
    e.dataTransfer.effectAllowed = 'move';
  }
</script>

<div
  class="scratch-block"
  style="background: {definition?.color ?? '#45475a'}"
  draggable="true"
  ondragstart={handleDragStart}
  data-block-id={block.id}
  data-block-type={block.type}
  role="group"
  aria-label="{definition?.displayName ?? block.type} block"
>
  <div class="header">
    <span class="icon">{definition?.icon ?? '?'}</span>
    <span class="name">{definition?.displayName ?? block.type}</span>
  </div>

  <div class="content">
    {#if block.type === 'TextBlock'}
      <span class="text-content">{block.config.content ?? ''}</span>
    {:else if block.type === 'FieldBlock'}
      <span class="field-type">{block.config.fieldType ?? 'description'}</span>
    {:else if block.type === 'MemoryBlock'}
      <span class="memory-count">{block.config.count ?? 3} memories</span>
    {:else if block.type === 'LorebookBlock'}
      <span class="lorebook-mode">{block.config.activationMode ?? 'keyword'}</span>
    {:else if block.type === 'IfBlock'}
      <div class="slots">
        {#each definition?.slots ?? [] as slotDef}
          <SlotRenderer {slotDef} block={block.slots[slotDef.name] ?? null} />
        {/each}
      </div>
    {:else if block.type === 'ToggleBlock'}
      <span class="toggle-id">{block.config.toggleId ?? ''}</span>
    {:else if block.type === 'SwitchBlock'}
      <div class="slots">
        {#each definition?.slots ?? [] as slotDef}
          <SlotRenderer {slotDef} block={block.slots[slotDef.name] ?? null} />
        {/each}
      </div>
      <span class="cases">{(block.config.cases as Array<unknown>)?.length ?? 0} cases</span>
    {:else if block.type === 'MergeBlock'}
      <div class="slots">
        {#each definition?.slots ?? [] as slotDef}
          <SlotRenderer {slotDef} block={block.slots[slotDef.name] ?? null} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="notch"></div>
</div>

<style>
  .scratch-block {
    border-radius: 8px;
    padding: 8px;
    min-width: 100px;
    cursor: grab;
    position: relative;
    color: var(--crust, #11111b);
  }

  .scratch-block:active {
    cursor: grabbing;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .icon {
    font-size: 1rem;
  }

  .content {
    margin-top: 6px;
    font-size: 0.75rem;
  }

  .slots {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notch {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 16px;
    height: 6px;
    background: inherit;
    border-radius: 0 0 4px 4px;
  }

  .text-content,
  .field-type,
  .memory-count,
  .lorebook-mode,
  .toggle-id,
  .cases {
    display: block;
    padding: 2px 4px;
  }
</style>
