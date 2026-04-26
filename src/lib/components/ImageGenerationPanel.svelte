<script lang="ts">
  import { imageGenerationPanelStore } from '$lib/stores/image-generation-panel';

  let {
    onclose,
    ongenerate,
    disabled = false,
  }: {
    onclose: () => void;
    ongenerate: () => Promise<void> | void;
    disabled?: boolean;
  } = $props();

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function labelForMode(mode: 'manual' | 'auto' | 'test'): string {
    if (mode === 'manual') return 'Manual';
    if (mode === 'auto') return 'Auto';
    return 'Test';
  }

  function labelForStatus(status: 'running' | 'completed' | 'failed'): string {
    if (status === 'running') return 'Running';
    if (status === 'completed') return 'Done';
    return 'Failed';
  }

  function statusClass(status: 'running' | 'completed' | 'failed'): string {
    if (status === 'running') return 'text-yellow border-yellow/30 bg-yellow/10';
    if (status === 'completed') return 'text-green border-green/30 bg-green/10';
    return 'text-red border-red/30 bg-red/10';
  }

  function logClass(level: 'info' | 'success' | 'error'): string {
    if (level === 'success') return 'text-green';
    if (level === 'error') return 'text-red';
    return 'text-subtext0';
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex justify-end bg-overlay/50"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-[28rem] max-w-full h-full bg-mantle border-l border-surface0 flex flex-col shadow-xl"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface0">
      <div>
        <h2 class="text-sm font-semibold text-text">Image Panel</h2>
        <p class="text-xs text-subtext0">Generation progress and recent results.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => imageGenerationPanelStore.clear()}
          class="text-xs text-subtext0 hover:text-text bg-transparent border border-surface1 rounded-md px-2 py-1"
        >
          Clear
        </button>
        <button
          type="button"
          onclick={onclose}
          class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-1"
          aria-label="Close"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>

    <div class="p-4 border-b border-surface0">
      <button
        type="button"
        onclick={ongenerate}
        disabled={disabled}
        class="w-full bg-mauve text-crust rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Generate Current Scene
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      {#if $imageGenerationPanelStore.length === 0}
        <div class="text-center text-sm text-subtext0 py-10">
          No image generation runs yet.
        </div>
      {:else}
        {#each $imageGenerationPanelStore as run (run.id)}
          <section class="rounded-md border border-surface1 bg-surface0/40 p-3 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-medium text-text">{run.title}</span>
                  <span class="text-[10px] uppercase text-subtext0 border border-surface1 rounded px-1.5 py-0.5">
                    {labelForMode(run.mode)}
                  </span>
                </div>
                <p class="text-xs text-subtext0 mt-1">
                  Started {formatTime(run.startedAt)}
                  {#if run.finishedAt}
                    · Finished {formatTime(run.finishedAt)}
                  {/if}
                </p>
              </div>
              <span class="shrink-0 text-[10px] uppercase rounded px-2 py-1 border {statusClass(run.status)}">
                {labelForStatus(run.status)}
              </span>
            </div>

            {#if run.results.length > 0}
              <div class="grid grid-cols-2 gap-2">
                {#each run.results as result (result.id)}
                  <div class="rounded-md overflow-hidden border border-surface1 bg-crust">
                    <img src={result.dataUrl} alt="Illustration preview" class="w-full aspect-square object-cover" />
                  </div>
                {/each}
              </div>
            {/if}

            <div class="space-y-1">
              {#each run.logs as log (log.id)}
                <div class="flex items-start justify-between gap-3 text-xs">
                  <p class="{logClass(log.level)}">{log.message}</p>
                  <span class="shrink-0 text-subtext0">{formatTime(log.timestamp)}</span>
                </div>
              {/each}
            </div>

            {#if run.error}
              <p class="text-xs text-red break-words">{run.error}</p>
            {/if}
          </section>
        {/each}
      {/if}
    </div>
  </div>
</div>
