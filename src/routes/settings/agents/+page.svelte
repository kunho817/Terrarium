<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';

  let loaded = $state(false);

  let directorEnabled = $state(true);
  let directorMode = $state<'light' | 'strong' | 'absolute'>('light');
  let directorBudget = $state(6400);

  let sceneEnabled = $state(true);
  let sceneBudget = $state(2560);

  let characterEnabled = $state(true);
  let characterAutoTrack = $state(true);
  let characterBudget = $state(6400);

  onMount(async () => {
    await settingsRepo.load();
    const ag = $settingsStore.agentSettings;
    if (ag) {
      directorEnabled = ag.director?.enabled ?? true;
      directorMode = ag.director?.mode ?? 'light';
      directorBudget = ag.director?.tokenBudget ?? 6400;
      sceneEnabled = ag.scene?.enabled ?? true;
      sceneBudget = ag.scene?.tokenBudget ?? 2560;
      characterEnabled = ag.character?.enabled ?? true;
      characterAutoTrack = ag.character?.autoTrack ?? true;
      characterBudget = ag.character?.tokenBudget ?? 6400;
    }
    loaded = true;
  });

  async function handleSave() {
    settingsStore.update({
      agentSettings: {
        director: { enabled: directorEnabled, mode: directorMode, tokenBudget: directorBudget },
        scene: { enabled: sceneEnabled, tokenBudget: sceneBudget },
        character: { enabled: characterEnabled, autoTrack: characterAutoTrack, tokenBudget: characterBudget },
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
        Configure the AI agents that run during chat to manage scene state, character tracking, and narrative direction.
      </p>

      <!-- Director Agent -->
      <section class="space-y-4 rounded-lg border border-surface1 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium text-text">Director Agent</h2>
            <p class="text-xs text-subtext0">Guides narrative direction and plot progression.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={directorEnabled}
            onclick={() => directorEnabled = !directorEnabled}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                   transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                   {directorEnabled ? 'bg-mauve' : 'bg-surface1'}"
          >
            <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                         transition-transform duration-200 ease-in-out
                         {directorEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
          </button>
        </div>

        {#if directorEnabled}
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

          <div class="space-y-1">
            <label for="director-budget" class="text-sm text-text">Token Budget: {directorBudget}</label>
            <input
              id="director-budget"
              type="range"
              min="512"
              max="16384"
              step="512"
              value={directorBudget}
              oninput={(e) => { directorBudget = Number((e.target as HTMLInputElement).value); }}
              class="w-full accent-mauve"
            />
            <div class="flex justify-between text-xs text-subtext0">
              <span>512</span>
              <span>16384</span>
            </div>
          </div>
        {/if}
      </section>

      <!-- Scene State Agent -->
      <section class="space-y-4 rounded-lg border border-surface1 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium text-text">Scene State Agent</h2>
            <p class="text-xs text-subtext0">Tracks location, time, mood, and environmental context.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sceneEnabled}
            onclick={() => sceneEnabled = !sceneEnabled}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                   transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                   {sceneEnabled ? 'bg-mauve' : 'bg-surface1'}"
          >
            <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                         transition-transform duration-200 ease-in-out
                         {sceneEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
          </button>
        </div>

        {#if sceneEnabled}
          <div class="space-y-1">
            <label for="scene-budget" class="text-sm text-text">Token Budget: {sceneBudget}</label>
            <input
              id="scene-budget"
              type="range"
              min="256"
              max="8192"
              step="256"
              value={sceneBudget}
              oninput={(e) => { sceneBudget = Number((e.target as HTMLInputElement).value); }}
              class="w-full accent-mauve"
            />
            <div class="flex justify-between text-xs text-subtext0">
              <span>256</span>
              <span>8192</span>
            </div>
          </div>
        {/if}
      </section>

      <!-- Character State Agent -->
      <section class="space-y-4 rounded-lg border border-surface1 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium text-text">Character State Agent</h2>
            <p class="text-xs text-subtext0">Tracks character emotions, positions, and state changes.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={characterEnabled}
            onclick={() => characterEnabled = !characterEnabled}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                   transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                   {characterEnabled ? 'bg-mauve' : 'bg-surface1'}"
          >
            <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                         transition-transform duration-200 ease-in-out
                         {characterEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
          </button>
        </div>

        {#if characterEnabled}
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm text-text">Auto-Track Characters</label>
              <p class="text-xs text-subtext0">Automatically detect and track character states in world chats.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={characterAutoTrack}
              onclick={() => characterAutoTrack = !characterAutoTrack}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                     transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve
                     {characterAutoTrack ? 'bg-mauve' : 'bg-surface1'}"
            >
              <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow
                           transition-transform duration-200 ease-in-out
                           {characterAutoTrack ? 'translate-x-5' : 'translate-x-0'}"></span>
            </button>
          </div>

          <div class="space-y-1">
            <label for="char-budget" class="text-sm text-text">Token Budget: {characterBudget}</label>
            <input
              id="char-budget"
              type="range"
              min="512"
              max="16384"
              step="512"
              value={characterBudget}
              oninput={(e) => { characterBudget = Number((e.target as HTMLInputElement).value); }}
              class="w-full accent-mauve"
            />
            <div class="flex justify-between text-xs text-subtext0">
              <span>512</span>
              <span>16384</span>
            </div>
          </div>
        {/if}
      </section>

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
