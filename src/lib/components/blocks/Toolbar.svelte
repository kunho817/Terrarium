<script lang="ts">
  import type { ViewportState } from '$lib/stores/viewport';

  interface Props {
    viewport: ViewportState;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onResetView: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
  }

  let { 
    viewport, 
    onZoomIn, 
    onZoomOut, 
    onFitView, 
    onResetView,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo
  }: Props = $props();

  const zoomPercent = $derived(Math.round(viewport.scale * 100));
</script>

<div class="toolbar flex items-center gap-2 px-4 py-2 bg-surface1 border-b border-surface2">
  {#if onUndo || onRedo}
    <div class="flex gap-1">
      <button
        class="p-1.5 rounded hover:bg-surface2 transition-colors disabled:opacity-30 text-text"
        disabled={!canUndo}
        onclick={onUndo}
        title="Undo"
      >
        ↩
      </button>
      <button
        class="p-1.5 rounded hover:bg-surface2 transition-colors disabled:opacity-30 text-text"
        disabled={!canRedo}
        onclick={onRedo}
        title="Redo"
      >
        ↪
      </button>
    </div>

    <div class="w-px h-6 bg-surface2"></div>
  {/if}

  <div class="flex items-center gap-1">
    <button
      class="px-2 py-1 rounded hover:bg-surface2 transition-colors text-text font-bold"
      onclick={onZoomOut}
      title="Zoom Out"
    >
      −
    </button>
    <span class="text-sm text-text min-w-[3rem] text-center tabular-nums">
      {zoomPercent}%
    </span>
    <button
      class="px-2 py-1 rounded hover:bg-surface2 transition-colors text-text font-bold"
      onclick={onZoomIn}
      title="Zoom In"
    >
      +
    </button>
  </div>

  <div class="w-px h-6 bg-surface2"></div>

  <div class="flex gap-1">
    <button
      class="px-3 py-1 rounded hover:bg-surface2 transition-colors text-sm text-text"
      onclick={onFitView}
      title="Fit to Screen"
    >
      Fit View
    </button>
    <button
      class="px-3 py-1 rounded hover:bg-surface2 transition-colors text-sm text-text"
      onclick={onResetView}
      title="Reset View"
    >
      Reset
    </button>
  </div>
</div>
