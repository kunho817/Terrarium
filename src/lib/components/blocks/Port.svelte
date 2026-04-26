<script lang="ts">
  import type { Port as PortType } from '$lib/types';

  interface Props {
    port: PortType;
    isInput: boolean;
    isConnected: boolean;
    onPress?: (e: MouseEvent | KeyboardEvent) => void;
    onRelease?: (e: MouseEvent | KeyboardEvent) => void;
  }

  let { port, isInput, isConnected, onPress, onRelease }: Props = $props();

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPress?.(e);
    }
  }

  function handlePress(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    onPress?.(e);
  }

  function handleRelease(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation();
    onRelease?.(e);
  }

  // Port colors by type
  const portColors = {
    text: '#a6e3a1',      // Green
    boolean: '#cba6f7',   // Purple  
    number: '#74c7ec',    // Blue
    list: '#f9e2af',      // Yellow
  };

  const color = $derived(portColors[port.type] || '#cdd6f4');
</script>

<div
  class="port-row flex items-center gap-2 rounded-md border border-surface2 bg-mantle/95 px-2 py-1 shadow-sm transition-all"
  class:input-row={isInput}
  class:output-row={!isInput}
  class:connected={isConnected}
  data-port-id={port.id}
  data-port-direction={isInput ? 'input' : 'output'}
  onmousedown={handlePress}
  onmouseup={handleRelease}
  onkeydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-label="{isInput ? 'Input' : 'Output'} port: {port.name}"
>
  {#if !isInput}
    <span class="truncate text-[11px] font-medium text-subtext0">{port.name}</span>
  {/if}

  <span
    class="port-dot inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2"
    style="background-color: {isConnected ? color : '#313244'}; border-color: {color};"
  ></span>

  {#if isInput}
    <span class="truncate text-[11px] font-medium text-subtext0">{port.name}</span>
  {/if}
</div>

<style>
  .port-row {
    min-width: 88px;
    max-width: 132px;
    cursor: pointer;
  }

  .input-row {
    justify-content: flex-start;
    transform: translateX(-12px);
  }

  .output-row {
    justify-content: flex-end;
    transform: translateX(12px);
  }

  .port-row:hover {
    box-shadow: 0 0 0 4px rgba(203, 166, 247, 0.3);
    border-color: rgba(203, 166, 247, 0.75);
  }

  .connected {
    box-shadow: 0 0 0 2px rgba(203, 166, 247, 0.5);
  }
</style>
