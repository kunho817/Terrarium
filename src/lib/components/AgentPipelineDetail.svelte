<script lang="ts">
  import { agentProgress } from '$lib/stores/agent-progress';
  import PipelineDiagnosticsView from './PipelineDiagnosticsView.svelte';

  let { onclose } = $props<{ onclose: () => void }>();

  let pipelineState = $derived($agentProgress);
</script>

<div class="fixed inset-0 z-50 flex items-end justify-center">
  <button
    type="button"
    aria-label="Close agent pipeline detail"
    class="absolute inset-0 bg-overlay0/50 border-none p-0 m-0 cursor-pointer"
    onclick={onclose}
  ></button>
  <div class="relative w-full max-w-xl mb-8 bg-mantle border border-surface1 rounded-xl shadow-2xl overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface0">
      <span class="text-sm font-semibold text-text">Agent Pipeline</span>
      <button onclick={onclose} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer text-lg leading-none p-0">\u2715</button>
    </div>

    <div class="px-4 py-3 max-h-[70vh] overflow-y-auto">
      <PipelineDiagnosticsView
        steps={pipelineState.steps as any}
        startedAt={pipelineState.startedAt}
      />
    </div>
  </div>
</div>
