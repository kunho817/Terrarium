<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';

  let loaded = $state(false);

  let enabled = $state(true);
  let turnMaintenanceEnabled = $state(true);
  let contextMessages = $state(20);
  let tmBudget = $state(2048);

  let extractionEnabled = $state(true);
  let extractionBudget = $state(1024);
  let repairAttempts = $state(2);

  let directorMode = $state<'light' | 'strong' | 'absolute'>('light');

  onMount(async () => {
    await settingsRepo.load();
    const ag = $settingsStore.agentSettings;
    if (ag) {
      enabled = ag.enabled ?? true;
      turnMaintenanceEnabled = ag.turnMaintenance?.enabled ?? true;
      contextMessages = ag.turnMaintenance?.contextMessages ?? 20;
      tmBudget = ag.turnMaintenance?.tokenBudget ?? 2048;
      extractionEnabled = ag.extraction?.enabled ?? true;
      extractionBudget = ag.extraction?.tokenBudget ?? 1024;
      repairAttempts = ag.extraction?.repairAttempts ?? 2;
      directorMode = ag.director?.mode ?? 'light';
    }
    loaded = true;
  });

  async function handleSave() {
    settingsStore.update({
      agentSettings: {
        enabled,
        turnMaintenance: { enabled: turnMaintenanceEnabled, contextMessages, tokenBudget: tmBudget },
        extraction: { enabled: extractionEnabled, tokenBudget: extractionBudget, repairAttempts },
        director: { mode: directorMode },
      },
    });
    await settingsRepo.save();
  }
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <div class="flex items-center gap-3">
        <a href="/settings" class="text-subtext0 hover:text-text transition-colors">&larr;</a>
        <h1 class="text-lg font-semibold text-text">Agent Settings</h1>
      </div>

      <p class="text-xs text-subtext0">
        Configure the agent pipeline that handles memory, narrative planning, and scene extraction.
      </p>

      <!-- Global Toggle -->
      <section class="space-y-4 rounded-lg border border-surface1 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium text-text">Agent Pipeline</h2>
            <p class="text-xs text-subtext0">Enable or disable the entire agent pipeline.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Agent pipeline"
            onclick={() => enabled = !enabled}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                   transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                   {enabled ? 'bg-mauve' : 'bg-surface1'}"
          >
            <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                         transition-transform duration-200 ease-in-out
                         {enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
          </button>
        </div>
      </section>

      {#if enabled}
        <!-- Turn Maintenance -->
        <section class="space-y-4 rounded-lg border border-surface1 p-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-medium text-text">Turn Maintenance</h2>
              <p class="text-xs text-subtext0">Narrative planning and director guidance before each generation.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={turnMaintenanceEnabled}
              aria-label="Turn maintenance"
              onclick={() => turnMaintenanceEnabled = !turnMaintenanceEnabled}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                     transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                     {turnMaintenanceEnabled ? 'bg-mauve' : 'bg-surface1'}"
            >
              <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                           transition-transform duration-200 ease-in-out
                           {turnMaintenanceEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
            </button>
          </div>

          {#if turnMaintenanceEnabled}
            <div class="space-y-1">
              <label for="context-messages" class="text-sm text-text">Context Messages: {contextMessages}</label>
              <input
                id="context-messages"
                type="range"
                min="5"
                max="50"
                step="5"
                value={contextMessages}
                oninput={(e) => { contextMessages = Number((e.target as HTMLInputElement).value); }}
                class="w-full accent-mauve"
              />
            </div>

            <div class="space-y-1">
              <label for="tm-budget" class="text-sm text-text">Token Budget: {tmBudget}</label>
              <input
                id="tm-budget"
                type="range"
                min="512"
                max="8192"
                step="256"
                value={tmBudget}
                oninput={(e) => { tmBudget = Number((e.target as HTMLInputElement).value); }}
                class="w-full accent-mauve"
              />
            </div>
          {/if}
        </section>

        <!-- Extraction -->
        <section class="space-y-4 rounded-lg border border-surface1 p-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-medium text-text">Extraction</h2>
              <p class="text-xs text-subtext0">Extract scene state, character info, and events from AI responses.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={extractionEnabled}
              aria-label="Extraction"
              onclick={() => extractionEnabled = !extractionEnabled}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                     transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                     {extractionEnabled ? 'bg-mauve' : 'bg-surface1'}"
            >
              <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                           transition-transform duration-200 ease-in-out
                           {extractionEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
            </button>
          </div>

          {#if extractionEnabled}
            <div class="space-y-1">
              <label for="ext-budget" class="text-sm text-text">Token Budget: {extractionBudget}</label>
              <input
                id="ext-budget"
                type="range"
                min="256"
                max="4096"
                step="256"
                value={extractionBudget}
                oninput={(e) => { extractionBudget = Number((e.target as HTMLInputElement).value); }}
                class="w-full accent-mauve"
              />
            </div>

            <div class="space-y-1">
              <label for="repair-attempts" class="text-sm text-text">Repair Attempts: {repairAttempts}</label>
              <input
                id="repair-attempts"
                type="range"
                min="0"
                max="5"
                step="1"
                value={repairAttempts}
                oninput={(e) => { repairAttempts = Number((e.target as HTMLInputElement).value); }}
                class="w-full accent-mauve"
              />
            </div>
          {/if}
        </section>

        <!-- Director -->
        <section class="space-y-4 rounded-lg border border-surface1 p-4">
          <div>
            <h2 class="text-sm font-medium text-text">Director Mode</h2>
            <p class="text-xs text-subtext0">Controls how strongly the director influences narrative direction.</p>
          </div>

          <div class="space-y-1">
            <label for="director-mode" class="text-sm text-text">Guidance Mode</label>
            <select
              id="director-mode"
              value={directorMode}
              onchange={(e) => { directorMode = (e.target as HTMLSelectElement).value as 'light' | 'strong' | 'absolute'; }}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
            >
              <option value="light">Light — Subtle suggestions</option>
              <option value="strong">Strong — Firm direction</option>
              <option value="absolute">Absolute — Strict control</option>
            </select>
          </div>
        </section>
      {/if}

      <button
        onclick={handleSave}
        class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender transition-colors"
      >
        Save
      </button>
    </div>
  </div>
{/if}
