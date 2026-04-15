<script lang="ts">
  import type { BlockInstance, Port } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';
  import PortComponent from './Port.svelte';

  interface Props {
    block: BlockInstance;
    isSelected: boolean;
    onSelect: () => void;
    onDoubleClick: () => void;
    onDragStart: (e: MouseEvent) => void;
    onPortActivate: (port: Port, isInput: boolean, e: MouseEvent | KeyboardEvent) => void;
    connectedPortIds: Set<string>;
  }

  let { 
    block, 
    isSelected, 
    onSelect, 
    onDoubleClick, 
    onDragStart,
    onPortActivate,
    connectedPortIds
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
  class="block-node absolute w-52 rounded-lg overflow-hidden select-none"
  class:selected={isSelected}
  style="left: {block.position.x}px; top: {block.position.y}px;"
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
  <div class="block-body bg-surface1 p-3 border-x border-b border-surface2">
    <div class="text-xs text-subtext0 line-clamp-3">
      {#if block.config.content}
        {block.config.content}
      {:else}
        <span class="italic opacity-50">Double-click to edit...</span>
      {/if}
    </div>
    
    <!-- Ports Row -->
    <div class="ports-row relative h-6 mt-2">
      <!-- Input Ports (Left) -->
      {#each definition?.inputPorts || [] as port, i}
        <div style="position: absolute; left: 0; top: {4 + i * 20}px;">
          <PortComponent
            {port}
            isInput={true}
            isConnected={connectedPortIds.has(`${block.id}-${port.id}`)}
            onActivate={(e) => onPortActivate(port, true, e)}
          />
        </div>
      {/each}
      
      <!-- Output Ports (Right) -->
      {#each definition?.outputPorts || [] as port, i}
        <div style="position: absolute; right: 0; top: {4 + i * 20}px;">
          <PortComponent
            {port}
            isInput={false}
            isConnected={connectedPortIds.has(`${block.id}-${port.id}`)}
            onActivate={(e) => onPortActivate(port, false, e)}
          />
        </div>
      {/each}
    </div>
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
</style>
