<script lang="ts">
  interface Props {
    x: number;
    y: number;
    type: 'canvas' | 'node' | 'port';
    blockId?: string;
    portId?: string;
    onAction: (action: string, data?: Record<string, string>) => void;
    onClose: () => void;
  }

  let { x, y, type, blockId, portId, onAction, onClose }: Props = $props();

  const canvasItems = [
    { label: 'Add Block...', action: 'add-block' },
    { label: '---', action: '' },
    { label: 'Clear Canvas', action: 'clear-canvas' }
  ];

  const nodeItems = [
    { label: 'Edit', action: 'edit' },
    { label: 'Duplicate', action: 'duplicate' },
    { label: 'Collapse', action: 'collapse' },
    { label: '---', action: '' },
    { label: 'Delete', action: 'delete', danger: true }
  ];

  const portItems = [
    { label: 'Disconnect All', action: 'disconnect-all' }
  ];

  const items = $derived(
    type === 'canvas' ? canvasItems :
    type === 'node' ? nodeItems :
    portItems
  );

  function handleClick(action: string) {
    if (!action) return;
    const data: Record<string, string> = {};
    if (blockId) data.blockId = blockId;
    if (portId) data.portId = portId;
    onAction(action, data);
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onclick={onClose} onkeydown={handleKeydown} />

<div 
  class="context-menu"
  style="left: {x}px; top: {y}px;"
  role="menu"
  oncontextmenu={(e) => e.preventDefault()}
  onclick={(e) => e.stopPropagation()}
>
  {#each items as item}
    {#if item.label === '---'}
      <div class="divider"></div>
    {:else}
      <button
        class="menu-item"
        class:danger={item.danger}
        onclick={() => handleClick(item.action!)}
        role="menuitem"
      >
        {item.label}
      </button>
    {/if}
  {/each}
</div>

<style>
  .context-menu {
    position: fixed;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    padding: 4px 0;
    min-width: 160px;
    z-index: 1000;
  }

  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    height: 32px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: #cdd6f4;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }

  .menu-item:hover {
    background: #45475a;
  }

  .menu-item.danger {
    color: #f38ba8;
  }

  .menu-item.danger:hover {
    background: rgba(243, 139, 168, 0.15);
  }

  .divider {
    height: 1px;
    background: #45475a;
    margin: 4px 0;
  }
</style>
