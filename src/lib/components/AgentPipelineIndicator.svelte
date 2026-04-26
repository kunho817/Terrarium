<script lang="ts">
  import { agentProgress } from '$lib/stores/agent-progress';
  import AgentPipelineDetail from './AgentPipelineDetail.svelte';

  const statusIcon: Record<string, string> = {
    pending: '○',
    running: '●',
    done: '✓',
    failed: '✗',
    skipped: '—',
  };

  let showDetail = $state(false);
  let pipelineState = $derived($agentProgress);
</script>

{#if pipelineState.active}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex items-center justify-center gap-2 bg-surface0/90 backdrop-blur-sm text-text text-xs px-3 py-1.5 border-t border-surface0 animate-in cursor-pointer hover:bg-surface1 transition-colors"
    onclick={() => showDetail = true}
    role="button"
    tabindex="0"
    onkeydown={(e) => { if (e.key === 'Enter') showDetail = true; }}
  >
    {#each pipelineState.steps as step}
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

{#if showDetail}
  <AgentPipelineDetail onclose={() => showDetail = false} />
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
