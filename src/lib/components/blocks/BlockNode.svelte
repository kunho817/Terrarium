<script lang="ts">
  import type { BlockInstance } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';
  import { getBlockInputPorts, getBlockOutputPorts, getMergeInputCount } from '$lib/blocks/ports';
  import Port from './Port.svelte';

  interface Props {
    block: BlockInstance;
    isSelected: boolean;
    onSelect?: () => void;
    onDoubleClick?: () => void;
    onEdit?: () => void;
    onDragStart?: (event: MouseEvent) => void;
    onPortMouseDown?: (portId: string, isInput: boolean, event: MouseEvent) => void;
    onPortMouseUp?: (portId: string, isInput: boolean, event: MouseEvent) => void;
    connectedPorts?: Set<string>;
    onCollapse?: () => void;
  }

  let {
    block,
    isSelected,
    onSelect = () => {},
    onDoubleClick = () => {},
    onEdit = () => {},
    onDragStart = () => {},
    onPortMouseDown,
    onPortMouseUp,
    connectedPorts = new Set(),
    onCollapse,
  }: Props = $props();

  const definition = $derived(blockRegistry.get(block.type));
  const inputPorts = $derived(getBlockInputPorts(block));
  const outputPorts = $derived(getBlockOutputPorts(block));

  const categoryColors = {
    foundation: '#89b4fa',
    logic: '#f38ba8',
    data: '#a6e3a1',
    structure: '#94e2d5',
  } as const;

  const headerColor = $derived(
    definition ? categoryColors[definition.category] : '#6c7086',
  );

  const summary = $derived(() => {
    if (block.type === 'StageBlock') {
      return String(block.config.description || block.config.stageLabel || 'Workflow stage');
    }
    if (block.type === 'TextBlock') {
      return String(block.config.content || '').trim() || 'Empty text block';
    }
    if (block.type === 'FieldBlock') {
      return String(block.config.fieldType || 'field');
    }
    if (block.type === 'MemoryBlock') {
      return `Top ${Number(block.config.count ?? 3)} memories`;
    }
    if (block.type === 'LorebookBlock') {
      return String(block.config.lorebookPosition || 'before_char');
    }
    if (block.type === 'ToggleBlock') {
      return String(block.config.toggleName || block.config.toggleId || 'Toggle');
    }
    if (block.type === 'MergeBlock') {
      return `Combine ${getMergeInputCount(block)} incoming text lane(s)`;
    }
    if (block.type === 'IfBlock') {
      return 'Conditional branch';
    }
    if (block.type === 'SwitchBlock') {
      return 'Value-based routing';
    }
    if (block.type === 'OutputBlock') {
      return String(block.config.outputLabel || block.config.outputKey || 'Output target');
    }
    return block.type;
  });

  const blockWidthClass = $derived(block.type === 'StageBlock' ? 'w-[21rem]' : 'w-[18rem]');

  const portAreaHeight = $derived(() => {
    const inputCount = inputPorts.length;
    const outputCount = outputPorts.length;
    const rows = Math.max(inputCount, outputCount, 1);
    return rows * 28 + 12;
  });

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) {
      return;
    }
    onSelect();
    onDragStart(event);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }

  function handleCollapseClick(event: MouseEvent) {
    event.stopPropagation();
    onCollapse?.();
  }

  function handleEditClick(event: MouseEvent) {
    event.stopPropagation();
    onEdit();
  }
</script>

<div
  class={`block-node relative z-0 isolate ${blockWidthClass} select-none overflow-hidden rounded-lg`}
  class:selected={isSelected}
  onmousedown={handleMouseDown}
  ondblclick={onDoubleClick}
  onkeydown={handleKeyDown}
  role="button"
  aria-label={`Block: ${block.type}`}
  tabindex="0"
>
  <div
    class="flex items-center gap-2 px-3 py-2"
    style="background: linear-gradient(135deg, {headerColor} 0%, {headerColor}dd 100%);"
  >
    <span class="min-w-[2.25rem] rounded bg-black/10 px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-crust">
      {definition?.icon || 'BLK'}
    </span>
    <span class="flex-1 truncate text-sm font-semibold text-crust">
      {definition?.displayName || block.type}
    </span>
    <button
      class="edit-btn rounded px-1 py-0.5 text-xs text-crust/80 transition-colors hover:bg-black/10 hover:text-crust"
      onclick={handleEditClick}
      title="Edit"
    >
      Edit
    </button>
    <button
      class="collapse-btn rounded px-1 py-0.5 text-xs text-crust/80 transition-colors hover:bg-black/10 hover:text-crust"
      onclick={handleCollapseClick}
      title={block.collapsed ? 'Expand' : 'Collapse'}
    >
      {block.collapsed ? 'Expand' : 'Collapse'}
    </button>
  </div>

  <div
    class="relative border-x border-b border-surface2 bg-surface1"
    style="min-height: {Math.max(portAreaHeight() + (block.collapsed ? 0 : 84), 80)}px;"
  >
    {#each inputPorts as port, index}
      {@const portKey = `${block.id}-${port.id}`}
      <div class="absolute left-0 z-10" style="top: {10 + index * 28}px;">
        <Port
          {port}
          isInput={true}
          isConnected={connectedPorts.has(portKey)}
          onPress={(event) => onPortMouseDown?.(port.id, true, event as MouseEvent)}
          onRelease={(event) => onPortMouseUp?.(port.id, true, event as MouseEvent)}
        />
      </div>
    {/each}

    {#if !block.collapsed}
      <div
        class="block-body px-20 py-3 text-xs text-subtext0"
        style="padding-top: {portAreaHeight() + 8}px;"
      >
        <div class="line-clamp-4 whitespace-pre-wrap break-words">{summary()}</div>
      </div>
    {/if}

    {#each outputPorts as port, index}
      {@const portKey = `${block.id}-${port.id}`}
      <div class="absolute right-0 z-10" style="top: {10 + index * 28}px;">
        <Port
          {port}
          isInput={false}
          isConnected={connectedPorts.has(portKey)}
          onPress={(event) => onPortMouseDown?.(port.id, false, event as MouseEvent)}
          onRelease={(event) => onPortMouseUp?.(port.id, false, event as MouseEvent)}
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .block-node {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
  }

  .block-node:hover {
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-1px);
  }

  .block-node.selected {
    box-shadow: 0 0 0 2px #cba6f7, 0 6px 18px rgba(0, 0, 0, 0.35);
  }

  .block-node:focus-visible {
    outline: 2px solid #cba6f7;
    outline-offset: 2px;
  }

  .line-clamp-4 {
    display: -webkit-box;
    line-clamp: 4;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
