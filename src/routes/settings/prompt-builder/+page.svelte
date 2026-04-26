<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import PresetList from '$lib/components/editors/PresetList.svelte';
  import PromptScriptBuilder from '$lib/components/blocks/PromptScriptBuilder.svelte';
  import type {
    AgentPromptOverrideSettings,
    AgentPromptPrefillSettings,
    PromptPreset,
    PromptPresetSettings,
    PromptScript,
  } from '$lib/types';
  import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
  import { createDefaultPreset } from '$lib/core/presets/defaults';
  import {
    applyPromptScriptToPreset,
    createPromptScriptFromPreset,
  } from '$lib/blocks/prompt-script';
  import { cloneSerializable } from '$lib/utils/clone-serializable';

  type PanelId = 'presets' | 'guide' | null;

  let loaded = $state(false);
  let openPanel = $state<PanelId>(null);
  let localSettings = $state<PromptPresetSettings | null>(null);
  let promptScript = $state<PromptScript | null>(null);
  let hasUnsavedChanges = $state(false);
  let saveInFlight = $state<Promise<void> | null>(null);

  function hydratePreset(preset: PromptPreset): PromptPreset {
    const hydrated = cloneSerializable(preset);
    hydrated.promptScript = createPromptScriptFromPreset(hydrated);
    hydrated.agentPromptOverrides = { ...(hydrated.agentPromptOverrides ?? {}) };
    hydrated.agentPrefills = { ...(hydrated.agentPrefills ?? {}) };
    hydrated.agentPromptGraphs = { ...(hydrated.agentPromptGraphs ?? {}) };
    hydrated.imagePrompts = { ...(hydrated.imagePrompts ?? {}) };
    hydrated.imagePromptGraphs = { ...(hydrated.imagePromptGraphs ?? {}) };
    return hydrated;
  }

  function createFreshPreset(name: string): PromptPreset {
    const preset = hydratePreset({
      ...createDefaultPreset(),
      name,
    });
    preset.promptScript = createPromptScriptFromPreset(preset);
    return hydratePreset(preset);
  }

  function getCurrentPreset(): PromptPreset | null {
    return localSettings?.presets.find((preset) => preset.id === localSettings?.activePresetId) ?? null;
  }

  function setLocalSettings(nextSettings: PromptPresetSettings, markDirty = true) {
    localSettings = nextSettings;
    if (loaded && markDirty) {
      hasUnsavedChanges = true;
    }
  }

  function updateSettings(patch: Partial<PromptPresetSettings>, markDirty = true) {
    if (!localSettings) {
      return;
    }
    setLocalSettings({ ...localSettings, ...patch }, markDirty);
  }

  function updatePreset(updated: PromptPreset, markDirty = true) {
    if (!localSettings) {
      return;
    }
    updateSettings({
      presets: localSettings.presets.map((preset) =>
        preset.id === updated.id ? hydratePreset(updated) : preset,
      ),
    }, markDirty);
  }

  function activatePreset(presetId: string) {
    if (!localSettings) {
      return;
    }
    const preset = localSettings.presets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    updateSettings({ activePresetId: presetId });
    promptScript = createPromptScriptFromPreset(preset);
    openPanel = null;
  }

  function updateCurrentScript(nextScript: PromptScript) {
    const preset = getCurrentPreset();
    if (!preset) {
      return;
    }

    promptScript = cloneSerializable(nextScript);
    updatePreset({
      ...preset,
      promptScript: cloneSerializable(nextScript),
    });
  }

  async function persistPromptBuilder(options?: { closePanel?: boolean; force?: boolean }) {
    const closePanel = options?.closePanel ?? true;
    const force = options?.force ?? false;

    if (!force && !hasUnsavedChanges) {
      if (closePanel) {
        openPanel = null;
      }
      return;
    }

    if (saveInFlight) {
      await saveInFlight;
      if (closePanel) {
        openPanel = null;
      }
      return;
    }

    const task = (async () => {
      const preset = getCurrentPreset();
      const settingsSnapshot = localSettings;
      if (!settingsSnapshot || !preset || !promptScript) {
        return;
      }

      const nextPreset = applyPromptScriptToPreset(preset, promptScript);

      settingsStore.update((current) => ({
        ...current,
        promptPresets: {
          ...settingsSnapshot,
          activePresetId: settingsSnapshot.activePresetId,
          presets: settingsSnapshot.presets.map((entry) =>
            entry.id === nextPreset.id ? nextPreset : entry,
          ),
        },
        agentSettings: {
          ...(current.agentSettings ?? {
            enabled: true,
            jailbreak: '',
            turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048, timeoutMs: 240000 },
            extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
            director: { mode: 'light' as const },
            worldMode: { extractEntities: true, extractRelations: true, sectionWorldInjection: true },
          }),
          promptOverrides: (nextPreset.agentPromptOverrides as AgentPromptOverrideSettings | undefined) ?? current.agentSettings?.promptOverrides,
          prefills: (nextPreset.agentPrefills as AgentPromptPrefillSettings | undefined) ?? current.agentSettings?.prefills,
          jailbreak: nextPreset.agentJailbreak ?? '',
          promptGraphs: nextPreset.agentPromptGraphs ?? {},
          promptBoard: undefined,
        },
        imageGeneration: {
          ...(current.imageGeneration ?? DEFAULT_IMAGE_CONFIG),
          ...(nextPreset.imagePrompts ?? {}),
          jailbreak: nextPreset.imageJailbreak ?? DEFAULT_IMAGE_CONFIG.jailbreak,
          promptGraphs: nextPreset.imagePromptGraphs ?? {},
          promptBoard: undefined,
        },
      }));

      setLocalSettings({
        ...settingsSnapshot,
        presets: settingsSnapshot.presets.map((entry) =>
          entry.id === nextPreset.id ? hydratePreset(nextPreset) : entry,
        ),
      }, false);
      promptScript = createPromptScriptFromPreset(nextPreset);

      await settingsRepo.save();
      hasUnsavedChanges = false;
    })();

    saveInFlight = task;

    try {
      await task;
    } catch (error) {
      hasUnsavedChanges = true;
      throw error;
    } finally {
      if (saveInFlight === task) {
        saveInFlight = null;
      }
      if (closePanel) {
        openPanel = null;
      }
    }
  }

  function requestAutoSave() {
    if (hasUnsavedChanges) {
      void persistPromptBuilder({ closePanel: false });
    }
  }

  beforeNavigate((navigation) => {
    const leavingPage =
      navigation.willUnload ||
      navigation.to?.route?.id !== navigation.from?.route?.id;
    if (leavingPage) {
      requestAutoSave();
    }
  });

  onMount(() => {
    const handlePageHide = () => {
      requestAutoSave();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
    }

    void (async () => {
      await settingsRepo.load();

      const promptPresets = $settingsStore.promptPresets
        ? {
            ...cloneSerializable($settingsStore.promptPresets),
            presets: cloneSerializable($settingsStore.promptPresets.presets).map(hydratePreset),
          }
        : {
            presets: [createFreshPreset('Default')],
            activePresetId: '',
          };

      if (!promptPresets.activePresetId && promptPresets.presets.length > 0) {
        promptPresets.activePresetId = promptPresets.presets[0].id;
      }

      localSettings = promptPresets;
      const activePreset = promptPresets.presets.find((preset) => preset.id === promptPresets.activePresetId)
        ?? promptPresets.presets[0]
        ?? null;
      promptScript = activePreset ? createPromptScriptFromPreset(activePreset) : null;
      hasUnsavedChanges = false;
      loaded = true;
    })();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
      }
    };
  });

  onDestroy(() => {
    requestAutoSave();
  });

  function togglePanel(panel: Exclude<PanelId, null>) {
    openPanel = openPanel === panel ? null : panel;
  }

  function handleSelectPreset(id: string) {
    activatePreset(id);
  }

  function handleCreatePreset(name: string) {
    if (!localSettings) {
      return;
    }

    const nextPreset = createFreshPreset(name);
    updateSettings({
      presets: [...localSettings.presets, nextPreset],
      activePresetId: nextPreset.id,
    });
    promptScript = createPromptScriptFromPreset(nextPreset);
  }

  function handleDuplicatePreset(id: string) {
    if (!localSettings) {
      return;
    }
    const source = localSettings.presets.find((preset) => preset.id === id);
    if (!source) {
      return;
    }

    const duplicate = hydratePreset(source);
    duplicate.id = crypto.randomUUID();
    duplicate.name = `${source.name} (Copy)`;

    updateSettings({
      presets: [...localSettings.presets, duplicate],
      activePresetId: duplicate.id,
    });
    promptScript = createPromptScriptFromPreset(duplicate);
  }

  function handleRenamePreset(id: string, name: string) {
    if (!localSettings) {
      return;
    }
    updateSettings({
      presets: localSettings.presets.map((preset) =>
        preset.id === id ? { ...preset, name } : preset,
      ),
    });
  }

  function handleDeletePreset(id: string) {
    if (!localSettings || localSettings.presets.length <= 1) {
      return;
    }

    const nextPresets = localSettings.presets.filter((preset) => preset.id !== id);
    const nextActiveId = localSettings.activePresetId === id ? nextPresets[0].id : localSettings.activePresetId;
    updateSettings({
      presets: nextPresets,
      activePresetId: nextActiveId,
    });
    const nextPreset = nextPresets.find((preset) => preset.id === nextActiveId) ?? nextPresets[0];
    promptScript = createPromptScriptFromPreset(nextPreset);
  }

  async function handleSave() {
    await persistPromptBuilder({ closePanel: true, force: true });
  }

  const activePreset = $derived(getCurrentPreset());
  const scriptStats = $derived.by(() => {
    if (!promptScript) {
      return { stages: 0, targets: 0, blocks: 0 };
    }

    return {
      stages: promptScript.stages.length,
      targets: promptScript.stages.reduce((sum, stage) => sum + stage.targets.length, 0),
      blocks: promptScript.stages.reduce(
        (sum, stage) =>
          sum + stage.targets.reduce((targetSum, target) => targetSum + target.blocks.length, 0),
        0,
      ),
    };
  });
</script>

{#if !loaded}
  <div class="flex flex-1 items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="relative flex flex-1 min-h-0 overflow-hidden bg-base px-4 pb-4 pt-3">
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-surface2 bg-mantle shadow-2xl">
      <div class="prompt-board-bar">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <a href="/settings" class="prompt-board-back">&larr; Settings</a>
          <span class="prompt-board-chip strong">Prompt Script</span>
          {#if activePreset}
            <span class="prompt-board-chip truncate">{activePreset.name}</span>
          {/if}
          <span class="prompt-board-chip">{scriptStats.stages} stages</span>
          <span class="prompt-board-chip">{scriptStats.targets} targets</span>
          <span class="prompt-board-chip">{scriptStats.blocks} blocks</span>
          <span class={`prompt-board-chip ${hasUnsavedChanges ? 'dirty' : 'saved'}`}>
            {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>

        <button
          class={`prompt-board-save ${hasUnsavedChanges ? 'dirty' : ''}`}
          disabled={Boolean(saveInFlight)}
          onclick={() => void handleSave()}
        >
          {saveInFlight ? 'Saving...' : 'Save'}
        </button>
      </div>

      {#if promptScript}
        <div class="min-h-0 flex-1">
          <PromptScriptBuilder
            script={promptScript}
            onChange={updateCurrentScript}
          />
        </div>
      {/if}
    </div>

    <div class="prompt-floating-layer">
      {#if openPanel}
        <div class="prompt-floating-panel">
          <header class="prompt-floating-panel-header">
            <div>
              <div class="text-xs uppercase text-subtext0">
                {openPanel === 'presets' ? 'Presets' : 'Guide'}
              </div>
              <h2 class="text-sm font-semibold text-text">
                {openPanel === 'presets' ? 'Preset Browser' : 'Prompt Script Guide'}
              </h2>
            </div>
            <button
              type="button"
              class="prompt-panel-close"
              onclick={() => {
                openPanel = null;
              }}
            >
              Close
            </button>
          </header>

          <div class="prompt-floating-panel-body">
            {#if openPanel === 'presets'}
              <div class="space-y-3">
                <p class="text-xs text-subtext0">
                  Each preset carries a prompt script. The script is the editable source for main, agent, and image prompt text.
                </p>

                <div class="max-h-72 overflow-y-auto rounded-md border border-surface2 bg-surface0/70 p-3">
                  <PresetList
                    presets={localSettings?.presets ?? []}
                    activePresetId={localSettings?.activePresetId ?? ''}
                    onselect={handleSelectPreset}
                    oncreate={handleCreatePreset}
                    onduplicate={handleDuplicatePreset}
                    onrename={handleRenamePreset}
                    ondelete={handleDeletePreset}
                  />
                </div>
              </div>
            {:else}
              <div class="grid gap-4 lg:grid-cols-3">
                <section class="rounded-md border border-surface2 bg-surface0/70 p-3">
                  <h3 class="text-sm font-medium text-text">Block Stack</h3>
                  <ul class="mt-2 space-y-1 text-sm text-subtext0">
                    <li>Stages are selected on the left.</li>
                    <li>Targets inside a stage compile into runtime prompt slots.</li>
                    <li>Prompt, Text, Merge, and If blocks are stacked in order.</li>
                  </ul>
                </section>

                <section class="rounded-md border border-surface2 bg-surface0/70 p-3">
                  <h3 class="text-sm font-medium text-text">Targets</h3>
                  <div class="mt-2 space-y-2 text-xs text-subtext0">
                    <div class="rounded border border-surface2 px-3 py-2">`Generation` owns the main prompt and assistant prefill.</div>
                    <div class="rounded border border-surface2 px-3 py-2">`Planning / Extraction / Memory Update` own agent prompts.</div>
                    <div class="rounded border border-surface2 px-3 py-2">`Illustration` owns image prompt stages.</div>
                  </div>
                </section>

                <section class="rounded-md border border-surface2 bg-surface0/70 p-3">
                  <h3 class="text-sm font-medium text-text">Variables</h3>
                  <div class="mt-2 space-y-1 font-mono text-xs text-subtext0">
                    <div><span class="text-mauve">{`{{char}}`}</span> character name</div>
                    <div><span class="text-mauve">{`{{user}}`}</span> user name</div>
                    <div><span class="text-mauve">{`{{slot}}`}</span> wrapped slot content</div>
                    <div><span class="text-mauve">{`{{scene.location}}`}</span> current scene location</div>
                    <div><span class="text-mauve">{`{{var.*}}`}</span> variable store values</div>
                  </div>
                </section>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="prompt-floating-dock">
        <button
          class={`prompt-dock-button ${
            openPanel === 'presets'
              ? 'active'
              : ''
          }`}
          onclick={() => togglePanel('presets')}
        >
          Presets
        </button>

        <button
          class={`prompt-dock-button ${
            openPanel === 'guide'
              ? 'active'
              : ''
          }`}
          onclick={() => togglePanel('guide')}
        >
          Guide
        </button>

        <button
          class={`prompt-dock-button save ${hasUnsavedChanges ? 'dirty' : ''}`}
          disabled={Boolean(saveInFlight)}
          onclick={() => void handleSave()}
        >
          {saveInFlight ? 'Saving...' : hasUnsavedChanges ? 'Save *' : 'Saved'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .prompt-floating-layer {
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: 30;
  }

  .prompt-floating-dock {
    align-items: center;
    backdrop-filter: blur(12px);
    background: color-mix(in srgb, var(--surface1) 94%, transparent);
    border: 1px solid var(--surface2);
    border-radius: 8px;
    bottom: 1rem;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.28);
    display: flex;
    gap: 0.375rem;
    padding: 0.375rem;
    pointer-events: auto;
    position: absolute;
    right: 1rem;
  }

  .prompt-dock-button {
    background: var(--surface0);
    border: 1px solid var(--surface2);
    border-radius: 6px;
    color: var(--subtext0);
    font-size: 12px;
    line-height: 1;
    min-height: 34px;
    padding: 0 0.75rem;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
  }

  .prompt-dock-button:hover:not(:disabled),
  .prompt-dock-button.active {
    border-color: var(--mauve);
    color: var(--text);
  }

  .prompt-dock-button.active {
    background: color-mix(in srgb, var(--mauve) 12%, var(--surface0));
  }

  .prompt-dock-button.save {
    min-width: 72px;
  }

  .prompt-dock-button.save.dirty {
    background: var(--mauve);
    border-color: var(--mauve);
    color: var(--crust);
    font-weight: 600;
  }

  .prompt-dock-button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .prompt-floating-panel {
    backdrop-filter: blur(14px);
    background: color-mix(in srgb, var(--surface1) 96%, transparent);
    border: 1px solid var(--surface2);
    border-radius: 8px;
    bottom: 4.5rem;
    box-shadow: 0 22px 60px rgb(0 0 0 / 0.34);
    max-height: min(70vh, 560px);
    overflow: hidden;
    pointer-events: auto;
    position: absolute;
    right: 1rem;
    width: min(820px, calc(100vw - 21rem));
  }

  .prompt-board-bar {
    align-items: center;
    background: color-mix(in srgb, var(--surface1) 72%, var(--mantle));
    border-bottom: 1px solid var(--surface2);
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    min-height: 48px;
    padding: 0.5rem 0.75rem;
  }

  .prompt-board-back,
  .prompt-board-chip,
  .prompt-board-save {
    border: 1px solid var(--surface2);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1;
    min-height: 28px;
    padding: 0.45rem 0.625rem;
  }

  .prompt-board-back {
    background: var(--mauve);
    border-color: var(--mauve);
    color: var(--crust);
    font-weight: 700;
    text-decoration: none;
  }

  .prompt-board-back:hover {
    background: var(--lavender);
    border-color: var(--lavender);
  }

  .prompt-board-chip {
    background: var(--surface0);
    color: var(--subtext0);
    max-width: 14rem;
  }

  .prompt-board-chip.strong {
    color: var(--text);
    font-weight: 600;
  }

  .prompt-board-chip.dirty {
    background: color-mix(in srgb, var(--yellow) 14%, var(--surface0));
    border-color: color-mix(in srgb, var(--yellow) 38%, var(--surface2));
    color: var(--yellow);
  }

  .prompt-board-chip.saved {
    background: color-mix(in srgb, var(--green) 10%, var(--surface0));
    border-color: color-mix(in srgb, var(--green) 32%, var(--surface2));
    color: var(--green);
  }

  .prompt-board-save {
    background: var(--surface0);
    color: var(--text);
    min-width: 72px;
  }

  .prompt-board-save.dirty {
    background: var(--mauve);
    border-color: var(--mauve);
    color: var(--crust);
    font-weight: 700;
  }

  .prompt-board-save:hover:not(:disabled) {
    border-color: var(--mauve);
  }

  .prompt-board-save:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .prompt-floating-panel-header {
    align-items: center;
    border-bottom: 1px solid var(--surface2);
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    padding: 0.75rem 0.875rem;
  }

  .prompt-panel-close {
    border: 1px solid var(--surface2);
    border-radius: 6px;
    color: var(--subtext0);
    font-size: 12px;
    padding: 0.375rem 0.625rem;
  }

  .prompt-panel-close:hover {
    border-color: var(--mauve);
    color: var(--text);
  }

  .prompt-floating-panel-body {
    max-height: calc(min(70vh, 560px) - 3.75rem);
    overflow: auto;
    padding: 0.875rem;
  }

  @media (max-width: 760px) {
    .prompt-floating-panel {
      left: 1rem;
      right: 1rem;
      width: auto;
    }

    .prompt-floating-dock {
      bottom: 0.75rem;
      left: 1rem;
      overflow-x: auto;
      right: 1rem;
    }

    .prompt-dock-button {
      flex: 1 0 auto;
    }
  }
</style>
