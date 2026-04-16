<script lang="ts">
  import type { ViewportState } from '$lib/stores/viewport';

  interface Props {
    viewport: ViewportState;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    onFit: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
  }

  let { 
    viewport, 
    onZoomIn, 
    onZoomOut, 
    onReset, 
    onFit,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo
  }: Props = $props();

  const zoomPercent = $derived(Math.round(viewport.scale * 100));
</script>

<div class="toolbar flex items-center gap-2 p-2 bg-surface1 rounded-lg">
  <!-- Undo/Redo -->
  <div class="flex gap-1">
    <button
      class="p-1.5 rounded hover:bg-surface2 transition-colors disabled:opacity-30"
      disabled={!canUndo}
      onclick={onUndo}
      title="Undo"
    >
      ↩️
    </button>
    <button
      class="p-1.5 rounded hover:bg-surface2 transition-colors disabled:opacity-30"
      disabled={!canRedo}
      onclick={onRedo}
      title="Redo"
    >
      ↪️
    </button>
  </div>

  <div class="w-px h-6 bg-surface2"></div>

  <!-- Zoom Controls -->
  <div class="flex items-center gap-1">
    <button
      class="p-1.5 rounded hover:bg-surface2 transition-colors"
      onclick={onZoomOut}
      title="Zoom Out"
    >
      ➖
    </button>
    <span class="text-sm text-text min-w-[3rem] text-center">
      {zoomPercent}%
    </span>
    <button
      class="p-1.5 rounded hover:bg-surface2 transition-colors"
      onclick={onZoomIn}
      title="Zoom In"
    >
      ➕
    </button>
  </div>

  <div class="w-px h-6 bg-surface2"></div>

  <!-- View Controls -->
  <div class="flex gap-1">
    <button
      class="p-1.5 rounded hover:bg-surface2 transition-colors text-sm"
      onclick={onFit}
      title="Fit to Screen"
    >
      ⌘ Fit
    </button>
    <button
      class="p-1.5 rounded hover:bg-surface2 transition-colors text-sm"
      onclick={onReset}
      title="Reset View"
    >
      ⌂ Reset
    </button>
  </div>
</div>

<style>
  .toolbar {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
</style>
