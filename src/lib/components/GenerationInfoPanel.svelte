<script lang="ts">
  import type { GenerationInfo } from '$lib/types';

  let { info, onclose } = $props<{
    info: GenerationInfo;
    onclose: () => void;
  }>();

  const inputTokens = $derived(info.inputTokens ?? 0);
  const outputTokens = $derived(info.outputTokens ?? 0);
  const totalTokens = $derived(inputTokens + outputTokens);

  const duration = $derived(
    info.durationMs != null
      ? info.durationMs >= 1000
        ? `${(info.durationMs / 1000).toFixed(1)}s`
        : `${info.durationMs}ms`
      : null,
  );

  const contextPercent = $derived(
    totalTokens > 0 ? Math.round((inputTokens / totalTokens) * 100) : 0
  );

  const barColor = $derived(
    contextPercent > 90
      ? 'bg-red/60'
      : contextPercent > 70
        ? 'bg-yellow/60'
        : 'bg-green/60'
  );
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="bg-mantle rounded-lg p-6 max-w-md w-full shadow-xl"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-text text-lg font-semibold">Generation Info</h2>
      <button
        onclick={onclose}
        class="text-subtext0 hover:text-text transition-colors p-1 rounded hover:bg-surface0"
        aria-label="Close"
      >
        <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>

    <!-- Model -->
    <div class="mb-4">
      <span class="text-subtext0 text-xs uppercase tracking-wide">Model</span>
      <p class="text-text text-sm mt-1">{info.model ?? 'Unknown Model'}</p>
    </div>

    <!-- Generation Time -->
    {#if duration}
      <div class="mb-4">
        <span class="text-subtext0 text-xs uppercase tracking-wide">Generation Time</span>
        <p class="text-text text-sm mt-1">{duration}</p>
      </div>
    {/if}

    <!-- Tokens -->
    <div class="grid grid-cols-2 gap-4 mb-5">
      <div>
        <span class="text-subtext0 text-xs uppercase tracking-wide">Input Tokens</span>
        <p class="text-text text-sm mt-1">{inputTokens.toLocaleString()}</p>
      </div>
      <div>
        <span class="text-subtext0 text-xs uppercase tracking-wide">Output Tokens</span>
        <p class="text-text text-sm mt-1">{outputTokens.toLocaleString()}</p>
      </div>
    </div>

    <!-- Context Usage Bar -->
    {#if totalTokens > 0}
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-subtext0 text-xs uppercase tracking-wide">Context Usage</span>
          <span class="text-subtext0 text-xs">{contextPercent}%</span>
        </div>
        <div class="w-full h-2 bg-surface0 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all {barColor}"
            style="width: {contextPercent}%"
          ></div>
        </div>
        <div class="flex justify-between mt-1">
          <span class="text-subtext0 text-xs">{inputTokens.toLocaleString()} input</span>
          <span class="text-subtext0 text-xs">{outputTokens.toLocaleString()} output</span>
        </div>
      </div>
    {:else}
      <div>
        <span class="text-subtext0 text-xs uppercase tracking-wide">Context Usage</span>
        <p class="text-subtext0 text-sm mt-1 italic">No token data available</p>
      </div>
    {/if}
  </div>
</div>
