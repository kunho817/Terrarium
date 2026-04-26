<script lang="ts">
  import type { ViewportState } from '$lib/stores/viewport';

  interface Props {
    viewport: ViewportState;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onResetView: () => void;
    onArrange?: () => void;
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
    onArrange,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
  }: Props = $props();

  const zoomPercent = $derived(Math.round(viewport.scale * 100));
</script>

<div class="flex items-center gap-2 border-b border-surface2 bg-surface1 px-4 py-2">
  {#if onUndo || onRedo}
    <div class="flex gap-1">
      <button
        class="rounded border border-surface2 px-2 py-1 text-xs text-text transition-colors hover:border-mauve disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canUndo}
        onclick={onUndo}
        title="Undo"
      >
        Undo
      </button>
      <button
        class="rounded border border-surface2 px-2 py-1 text-xs text-text transition-colors hover:border-mauve disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canRedo}
        onclick={onRedo}
        title="Redo"
      >
        Redo
      </button>
    </div>

    <div class="mx-1 h-6 w-px bg-surface2"></div>
  {/if}

  <div class="flex items-center gap-1">
    <button
      class="rounded border border-surface2 px-2 py-1 text-sm text-text transition-colors hover:border-mauve"
      onclick={onZoomOut}
      title="Zoom out"
    >
      -
    </button>
    <span class="min-w-[3.25rem] text-center text-sm tabular-nums text-text">{zoomPercent}%</span>
    <button
      class="rounded border border-surface2 px-2 py-1 text-sm text-text transition-colors hover:border-mauve"
      onclick={onZoomIn}
      title="Zoom in"
    >
      +
    </button>
  </div>

  <div class="mx-1 h-6 w-px bg-surface2"></div>

  <div class="flex gap-1">
    {#if onArrange}
      <button
        class="rounded border border-surface2 px-3 py-1 text-sm text-text transition-colors hover:border-mauve"
        onclick={onArrange}
        title="Arrange blocks into a cleaner shared layout"
      >
        Clean Layout
      </button>
    {/if}
    <button
      class="rounded border border-surface2 px-3 py-1 text-sm text-text transition-colors hover:border-mauve"
      onclick={onFitView}
      title="Fit all blocks into view"
    >
      Fit View
    </button>
    <button
      class="rounded border border-surface2 px-3 py-1 text-sm text-text transition-colors hover:border-mauve"
      onclick={onResetView}
      title="Reset zoom and pan"
    >
      Reset
    </button>
  </div>
</div>
