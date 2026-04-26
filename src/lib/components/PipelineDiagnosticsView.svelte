<script lang="ts">
  import type { PipelineStepSnapshot, StepDiagnostic, PipelineSubTaskDiagnostic } from '$lib/types';

  let {
    steps,
    startedAt,
    finishedAt = null,
  }: {
    steps: PipelineStepSnapshot[];
    startedAt: number;
    finishedAt?: number | null;
  } = $props();

  const statusIcon: Record<string, string> = {
    pending: '\u25CB',
    running: '\u25CF',
    done: '\u2713',
    failed: '\u2717',
    skipped: '\u2014',
  };

  const statusColor: Record<string, string> = {
    pending: 'text-subtext0',
    running: 'text-blue',
    done: 'text-green',
    failed: 'text-red',
    skipped: 'text-subtext0',
  };

  function formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function duration(start: number | null, end: number | null): string {
    if (!start) return '';
    return formatDuration((end || Date.now()) - start);
  }

  function elapsed(): string {
    if (!startedAt) return '';
    return formatDuration((finishedAt || Date.now()) - startedAt);
  }

  function tokenLine(diagnostic: StepDiagnostic | PipelineSubTaskDiagnostic): string {
    const inputTokens = diagnostic.inputTokens ?? 0;
    const outputTokens = diagnostic.outputTokens ?? 0;
    if (inputTokens <= 0 && outputTokens <= 0) {
      return '';
    }
    return `${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`;
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <span class="text-xs text-subtext0">Total: {elapsed()}</span>
    <span class="text-xs text-subtext0">{steps.length} step(s)</span>
  </div>

  {#each steps as step}
    <div class="rounded-lg bg-crust border border-surface0 p-3">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-base {statusColor[step.status]}">{statusIcon[step.status]}</span>
          <span class="text-sm font-medium text-text">{step.label}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-subtext0">
          <span>{step.status}</span>
          {#if step.diagnostic.startedAt}
            <span>{duration(step.diagnostic.startedAt, step.diagnostic.finishedAt)}</span>
          {/if}
        </div>
      </div>

      <div class="mt-2 grid gap-1 text-xs">
        {#if step.diagnostic.providerId || step.diagnostic.model}
          <div class="text-subtext0">
            {step.diagnostic.providerId || 'provider'} {#if step.diagnostic.model}/ {step.diagnostic.model}{/if}
          </div>
        {/if}
        {#if step.diagnostic.temperature !== null}
          <div class="text-subtext0">Temperature: {step.diagnostic.temperature}</div>
        {/if}
        {#if step.diagnostic.maxTokens !== null}
          <div class="text-subtext0">Max Tokens: {step.diagnostic.maxTokens?.toLocaleString()}</div>
        {/if}
        {#if step.diagnostic.timeoutMs !== null}
          <div class="text-subtext0">Timeout: {formatDuration(step.diagnostic.timeoutMs)}</div>
        {/if}
        {#if step.diagnostic.inputChars > 0}
          <div class="text-subtext0">Input: {step.diagnostic.inputChars.toLocaleString()} chars</div>
        {/if}
        {#if step.diagnostic.outputChars > 0}
          <div class="text-subtext0">Output: {step.diagnostic.outputChars.toLocaleString()} chars</div>
        {/if}
        {#if tokenLine(step.diagnostic)}
          <div class="text-subtext0">Tokens: {tokenLine(step.diagnostic)}</div>
        {/if}
        {#if step.diagnostic.resultPreview}
          <div class="text-subtext1 bg-surface0 rounded px-2 py-1.5 whitespace-pre-wrap break-words">{step.diagnostic.resultPreview}</div>
        {/if}
        {#if step.diagnostic.error}
          <div class="text-red bg-red/10 rounded px-2 py-1.5 whitespace-pre-wrap break-words">{step.diagnostic.error}</div>
        {/if}
      </div>

      {#if step.diagnostic.subTasks.length > 0}
        <div class="mt-3 space-y-2">
          <div class="text-[11px] uppercase tracking-wide text-subtext0">Agent Runs</div>
          {#each step.diagnostic.subTasks as subTask}
            <details class="rounded-md border border-surface1 bg-surface0/60 px-2 py-1.5">
              <summary class="cursor-pointer list-none flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <span class="{statusColor[subTask.status]}">{statusIcon[subTask.status]}</span>
                  <span class="text-xs text-text">{subTask.label}</span>
                </div>
                <div class="text-[11px] text-subtext0">{duration(subTask.startedAt, subTask.finishedAt)}</div>
              </summary>
              <div class="mt-2 space-y-1 text-[11px]">
                {#if subTask.providerId || subTask.model}
                  <div class="text-subtext0">{subTask.providerId || 'provider'} {#if subTask.model}/ {subTask.model}{/if}</div>
                {/if}
                {#if subTask.temperature != null}
                  <div class="text-subtext0">Temperature: {subTask.temperature}</div>
                {/if}
                {#if subTask.maxTokens != null}
                  <div class="text-subtext0">Max Tokens: {subTask.maxTokens.toLocaleString()}</div>
                {/if}
                {#if subTask.inputChars}
                  <div class="text-subtext0">Input: {subTask.inputChars.toLocaleString()} chars</div>
                {/if}
                {#if subTask.outputChars}
                  <div class="text-subtext0">Output: {subTask.outputChars.toLocaleString()} chars</div>
                {/if}
                {#if tokenLine(subTask)}
                  <div class="text-subtext0">Tokens: {tokenLine(subTask)}</div>
                {/if}
                {#if subTask.error}
                  <div class="text-red bg-red/10 rounded px-2 py-1.5 whitespace-pre-wrap break-words">{subTask.error}</div>
                {/if}
                {#if subTask.result}
                  <pre class="bg-base rounded px-2 py-2 whitespace-pre-wrap break-words max-h-64 overflow-y-auto text-subtext1 font-mono">{subTask.result}</pre>
                {/if}
              </div>
            </details>
          {/each}
        </div>
      {/if}

      {#if step.diagnostic.resultFull}
        <details class="mt-3 rounded-md border border-surface1 bg-surface0/60 px-2 py-1.5">
          <summary class="cursor-pointer list-none text-xs text-text">Full Result</summary>
          <pre class="mt-2 bg-base rounded px-2 py-2 whitespace-pre-wrap break-words max-h-72 overflow-y-auto text-subtext1 font-mono">{step.diagnostic.resultFull}</pre>
        </details>
      {/if}
    </div>
  {/each}
</div>
