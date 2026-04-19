<script lang="ts">
  import { agentProgress } from '$lib/stores/agent-progress';

  const statusIcon: Record<string, string> = {
    pending: '○',
    running: '●',
    done: '✓',
    failed: '✗',
  };

  let state = $derived($agentProgress);
</script>

{#if state.active}
  <div class="flex items-center justify-center gap-2 bg-surface0/90 backdrop-blur-sm text-text text-xs px-3 py-1.5 border-t border-surface0 animate-in">
    {#each state.steps as step}
      <span class="flex items-center gap-1 whitespace-nowrap">
        {#if step.status === 'running'}
          <span class="animate-pulse">{statusIcon[step.status]}</span>
        {:else}
          {statusIcon[step.status]}
        {/if}
        <span class="text-subtext0">{step.label}</span>
      </span>
    {/each}
  </div>
{/if}

<style>
  .animate-in {
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
