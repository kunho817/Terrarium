<script lang="ts">
  import type { BlockInstance } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';

  interface Props {
    block: BlockInstance;
    isSelected: boolean;
    onSelect?: () => void;
    onDoubleClick?: () => void;
    onDragStart?: (e: MouseEvent) => void;
    onPortClick?: (portId: string, isInput: boolean, e: MouseEvent) => void;
    connectedPorts?: Set<string>;
  }

  let { 
    block, 
    isSelected, 
    onSelect = () => {},
    onDoubleClick = () => {},
    onDragStart = () => {},
    onPortClick,
    connectedPorts = new Set()
  }: Props = $props();

  const definition = $derived(blockRegistry.get(block.type));
  
  const categoryColors = {
    foundation: '#89b4fa',
    logic: '#f38ba8',
    data: '#a6e3a1',
    structure: '#94e2d5',
  };
  
  const headerColor = $derived(
    definition ? categoryColors[definition.category] : '#6c7086'
  );

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      onSelect();
      onDragStart(e);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }
</script>

<div
  class="block-node w-52 rounded-lg overflow-hidden select-none"
  class:selected={isSelected}
  onmousedown={handleMouseDown}
  ondblclick={onDoubleClick}
  onkeydown={handleKeyDown}
  role="button"
  aria-label="Block: {block.type}"
  tabindex="0"
>
  <!-- Header -->
  <div 
    class="block-header px-3 py-2 flex items-center gap-2"
    style="background: linear-gradient(135deg, {headerColor} 0%, {headerColor}dd 100%);"
  >
    <span class="text-lg">{definition?.icon || '🔷'}</span>
    <span class="text-sm font-semibold text-crust truncate flex-1">
      {definition?.displayName || block.type}
    </span>
    {#if isSelected}
      <span class="text-xs text-crust/70">●</span>
    {/if}
  </div>
  
  <!-- Content Preview -->
  <div class="block-body bg-surface1 p-3 border-x border-b border-surface2 relative">
    <div class="text-xs text-subtext0 line-clamp-3">
      {#if block.config.content}
        {block.config.content}
      {:else}
        <span class="italic opacity-50">Double-click to edit...</span>
      {/if}
    </div>
    
    <!-- Input ports (left side) -->
    {#each definition?.inputPorts || [] as port}
      {@const portKey = `${block.id}-${port.id}`}
      <button
        data-port-id={port.id}
        data-port-type={port.type}
        class="port input absolute w-3 h-3 rounded-full border-2 cursor-pointer transition-all"
        style="left: -6px; top: 50%; transform: translateY(-50%);
               background: {connectedPorts.has(portKey) ? (port.type === 'text' ? '#a6e3a1' : port.type === 'boolean' ? '#cba6f7' : port.type === 'number' ? '#74c7ec' : '#f9e2af') : '#313244'};
               border-color: {port.type === 'text' ? '#a6e3a1' : port.type === 'boolean' ? '#cba6f7' : port.type === 'number' ? '#74c7ec' : '#f9e2af'};"
        onclick={(e) => {
          e.stopPropagation();
          onPortClick?.(port.id, true, e);
        }}
        title="{port.name} (input)"
      ></button>
    {/each}
    
    <!-- Output ports (right side) -->
    {#each definition?.outputPorts || [] as port}
      {@const portKey = `${block.id}-${port.id}`}
      <button
        data-port-id={port.id}
        data-port-type={port.type}
        class="port output absolute w-3 h-3 rounded-full border-2 cursor-pointer transition-all"
        style="right: -6px; top: 50%; transform: translateY(-50%);
               background: {connectedPorts.has(portKey) ? (port.type === 'text' ? '#a6e3a1' : port.type === 'boolean' ? '#cba6f7' : port.type === 'number' ? '#74c7ec' : '#f9e2af') : '#313244'};
               border-color: {port.type === 'text' ? '#a6e3a1' : port.type === 'boolean' ? '#cba6f7' : port.type === 'number' ? '#74c7ec' : '#f9e2af'};"
        onclick={(e) => {
          e.stopPropagation();
          onPortClick?.(port.id, false, e);
        }}
        title="{port.name} (output)"
      ></button>
    {/each}
  </div>
</div>

<style>
  .block-node {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: box-shadow 0.2s;
  }
  .block-node:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .block-node.selected {
    box-shadow: 0 0 0 2px #cba6f7, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .block-node:focus-visible {
    outline: 2px solid #cba6f7;
    outline-offset: 2px;
  }
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .port:hover {
    box-shadow: 0 0 0 4px rgba(203, 166, 247, 0.3);
    transform: translateY(-50%) scale(1.2) !important;
  }
</style>
