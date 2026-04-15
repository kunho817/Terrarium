<script lang="ts">
  import type { Port as PortType } from '$lib/types';

  interface Props {
    port: PortType;
    isInput: boolean;
    isConnected: boolean;
    onDragStart?: (e: MouseEvent) => void;
  }

  let { port, isInput, isConnected, onDragStart }: Props = $props();

  // Port colors by type
  const portColors = {
    text: '#a6e3a1',      // Green
    boolean: '#cba6f7',   // Purple  
    number: '#74c7ec',    // Blue
    list: '#f9e2af',      // Yellow
  };

  const color = portColors[port.type] || '#cdd6f4';
</script>

<div
  class="port absolute w-3 h-3 rounded-full border-2 transition-all cursor-pointer"
  class:input-port={isInput}
  class:output-port={!isInput}
  class:connected={isConnected}
  style="
    background-color: {isConnected ? color : '#313244'};
    border-color: {color};
    {isInput ? 'left: -6px;' : 'right: -6px;'}
  "
  onmousedown={onDragStart}
  role="button"
  aria-label="{isInput ? 'Input' : 'Output'} port: {port.name}"
></div>

<style>
  .port {
    top: 50%;
    transform: translateY(-50%);
  }
  .port:hover {
    box-shadow: 0 0 0 4px rgba(203, 166, 247, 0.3);
    transform: translateY(-50%) scale(1.2);
  }
  .port.connected {
    box-shadow: 0 0 0 2px rgba(203, 166, 247, 0.5);
  }
</style>
