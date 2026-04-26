<script lang="ts">
  import type { PromptScript, PromptScriptStage, PromptScriptTarget } from '$lib/types';
  import { PROMPT_SCRIPT_STAGES } from '$lib/blocks/prompt-script';
  import { cloneSerializable } from '$lib/utils/clone-serializable';
  import PromptScriptBlockList from './PromptScriptBlockList.svelte';

  interface Props {
    script: PromptScript;
    onChange: (script: PromptScript) => void;
  }

  let { script, onChange }: Props = $props();
  let activeStageKey = $state('stage.generation');

  $effect(() => {
    if (!script.stages.some((stage) => stage.key === activeStageKey)) {
      activeStageKey = script.stages[0]?.key ?? 'stage.generation';
    }
  });

  const activeStage = $derived(
    script.stages.find((stage) => stage.key === activeStageKey) ?? script.stages[0] ?? null,
  );

  function emit(nextScript: PromptScript) {
    onChange(nextScript);
  }

  function updateStage(stageKey: string, patch: Partial<PromptScriptStage>) {
    emit({
      ...script,
      stages: script.stages.map((stage) =>
        stage.key === stageKey ? { ...stage, ...patch } : stage,
      ),
    });
  }

  function updateTarget(stageKey: string, targetId: string, patch: Partial<PromptScriptTarget>) {
    emit({
      ...script,
      stages: script.stages.map((stage) =>
        stage.key === stageKey
          ? {
              ...stage,
              targets: stage.targets.map((target) =>
                target.id === targetId ? { ...target, ...patch } : target,
              ),
            }
          : stage,
      ),
    });
  }

  function moveTarget(stageKey: string, targetId: string, delta: -1 | 1) {
    const stage = script.stages.find((entry) => entry.key === stageKey);
    if (!stage) {
      return;
    }
    const index = stage.targets.findIndex((target) => target.id === targetId);
    const nextIndex = index + delta;
    if (index === -1 || nextIndex < 0 || nextIndex >= stage.targets.length) {
      return;
    }
    const targets = [...stage.targets];
    const [target] = targets.splice(index, 1);
    targets.splice(nextIndex, 0, target);
    updateStage(stageKey, { targets });
  }

  function duplicateTarget(stageKey: string, targetId: string) {
    const stage = script.stages.find((entry) => entry.key === stageKey);
    if (!stage) {
      return;
    }
    const index = stage.targets.findIndex((target) => target.id === targetId);
    if (index === -1) {
      return;
    }
    const duplicate = cloneSerializable(stage.targets[index]);
    duplicate.id = crypto.randomUUID();
    duplicate.label = `${duplicate.label} Copy`;
    updateStage(stageKey, {
      targets: [
        ...stage.targets.slice(0, index + 1),
        duplicate,
        ...stage.targets.slice(index + 1),
      ],
    });
  }

  function targetSummary(target: PromptScriptTarget): string {
    const count = target.blocks.length;
    return `${target.key} / ${target.composeMode} / ${count} block${count === 1 ? '' : 's'}`;
  }
</script>

<div class="flex h-full min-h-0 bg-mantle">
  <aside class="flex w-64 shrink-0 flex-col border-r border-surface2 bg-surface1/60">
    <div class="border-b border-surface2 px-3 py-3">
      <div class="text-xs uppercase text-subtext0">Workflow</div>
      <div class="mt-1 text-sm font-semibold text-text">Prompt Script</div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      {#each PROMPT_SCRIPT_STAGES as stageMeta}
        {@const stage = script.stages.find((entry) => entry.key === stageMeta.key)}
        {#if stage}
          <button
            class={`mb-1 w-full rounded-md border px-3 py-2 text-left transition-colors ${
              activeStageKey === stage.key
                ? 'border-mauve bg-mauve/10 text-text'
                : 'border-transparent bg-transparent text-subtext0 hover:border-surface2 hover:bg-surface0 hover:text-text'
            }`}
            onclick={() => {
              activeStageKey = stage.key;
            }}
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-medium">{stage.label}</span>
              <span class="rounded bg-surface0 px-1.5 py-0.5 text-[10px] text-subtext0">
                {stage.targets.length}
              </span>
            </div>
            <div class="mt-1 line-clamp-2 text-xs text-subtext0">{stage.description}</div>
          </button>
        {/if}
      {/each}
    </div>
  </aside>

  <main class="min-w-0 flex-1 overflow-hidden">
    {#if activeStage}
      <div class="flex h-full min-h-0 flex-col">
        <header class="border-b border-surface2 bg-surface1/40 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="text-xs uppercase text-subtext0">Stage</div>
              <h2 class="truncate text-lg font-semibold text-text">{activeStage.label}</h2>
              <p class="mt-1 max-w-4xl text-sm text-subtext0">{activeStage.description}</p>
            </div>
            <label class="flex shrink-0 items-center gap-2 text-xs text-subtext0">
              <input
                type="checkbox"
                checked={Boolean(activeStage.collapsed)}
                onchange={(event) => updateStage(activeStage.key, { collapsed: event.currentTarget.checked })}
                class="accent-mauve"
              />
              Collapse targets
            </label>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <div class="mx-auto max-w-5xl space-y-3">
            {#each activeStage.targets as target, index (target.id)}
              <section class="rounded-md border border-surface2 bg-surface1/80 shadow-sm">
                <header class="flex items-center justify-between gap-3 border-b border-surface2 px-4 py-3">
                  <button
                    class="min-w-0 text-left"
                    onclick={() => updateTarget(activeStage.key, target.id, { collapsed: !target.collapsed })}
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate text-sm font-semibold text-text">{target.label}</span>
                      <span class="rounded bg-surface0 px-2 py-0.5 text-[11px] text-subtext0">{target.role}</span>
                      <span class="rounded bg-surface0 px-2 py-0.5 text-[11px] text-subtext0">{target.composeMode}</span>
                    </div>
                    <div class="mt-1 truncate text-xs text-subtext0">{targetSummary(target)}</div>
                  </button>

                  <div class="flex shrink-0 items-center gap-1">
                    <button class="tool-btn" disabled={index === 0} onclick={() => moveTarget(activeStage.key, target.id, -1)}>Up</button>
                    <button class="tool-btn" disabled={index === activeStage.targets.length - 1} onclick={() => moveTarget(activeStage.key, target.id, 1)}>Down</button>
                    <button class="tool-btn" onclick={() => duplicateTarget(activeStage.key, target.id)}>Copy</button>
                  </div>
                </header>

                {#if !target.collapsed && !activeStage.collapsed}
                  <div class="space-y-3 p-4">
                    <div class="grid gap-2 md:grid-cols-[1fr_9rem_9rem]">
                      <label class="field">
                        <span>Label</span>
                        <input
                          type="text"
                          value={target.label}
                          oninput={(event) => updateTarget(activeStage.key, target.id, { label: event.currentTarget.value })}
                        />
                      </label>
                      <label class="field">
                        <span>Role</span>
                        <select
                          value={target.role}
                          onchange={(event) => updateTarget(activeStage.key, target.id, { role: event.currentTarget.value as PromptScriptTarget['role'] })}
                        >
                          <option value="system">system</option>
                          <option value="assistant">assistant</option>
                          <option value="user">user</option>
                        </select>
                      </label>
                      <label class="field">
                        <span>Mode</span>
                        <select
                          value={target.composeMode}
                          onchange={(event) => updateTarget(activeStage.key, target.id, { composeMode: event.currentTarget.value as PromptScriptTarget['composeMode'] })}
                        >
                          <option value="replace">replace</option>
                          <option value="augment">augment</option>
                        </select>
                      </label>
                    </div>

                    <PromptScriptBlockList
                      blocks={target.blocks}
                      onChange={(nextBlocks) => updateTarget(activeStage.key, target.id, { blocks: nextBlocks })}
                    />
                  </div>
                {/if}
              </section>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .tool-btn {
    border: 1px solid var(--surface2);
    border-radius: 6px;
    color: var(--subtext0);
    font-size: 11px;
    padding: 4px 8px;
  }

  .tool-btn:hover:not(:disabled) {
    border-color: var(--mauve);
    color: var(--text);
  }

  .tool-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field span {
    color: var(--subtext0);
    font-size: 11px;
  }

  .field input,
  .field select {
    background: var(--crust);
    border: 1px solid var(--overlay0);
    border-radius: 6px;
    color: var(--text);
    color-scheme: dark;
    font-size: 13px;
    padding: 7px 9px;
  }

  .field select option {
    background: #f8fafc;
    color: #111827;
  }

  .field select {
    background: #f8fafc;
    color: #111827;
    color-scheme: light;
  }

  .field input:focus,
  .field select:focus {
    border-color: var(--mauve);
    outline: none;
  }
</style>
