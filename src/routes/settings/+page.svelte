<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { getRegistry } from '$lib/core/bootstrap';

  let loaded = $state(false);

  onMount(async () => {
    await settingsRepo.load();
    loaded = true;
  });

  async function handleSave() {
    await settingsRepo.save();
  }
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-8">
      <h1 class="text-lg font-semibold text-text">Settings</h1>

      <!-- Provider Section -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">AI Providers</h2>
          <a
            href="/settings/providers"
            class="text-mauve hover:text-lavender text-sm"
          >
            Configure Providers &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Default provider: {$settingsStore.defaultProvider || 'None selected'}
        </p>
      </section>

      <!-- Default Provider -->
      <section class="space-y-3">
        <h2 class="text-sm font-medium text-text">Default Provider</h2>
        <select
          value={$settingsStore.defaultProvider}
          onchange={(e) => {
            settingsStore.update({ defaultProvider: (e.target as HTMLSelectElement).value });
            handleSave();
          }}
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve"
        >
          <option value="">-- Select --</option>
          {#each getRegistry().listProviders() as provider}
            <option value={provider.id}>{provider.name}</option>
          {/each}
        </select>
      </section>

      <!-- Theme -->
      <section class="space-y-3">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">Theme</h2>
          <a
            href="/settings/theme-editor"
            class="text-mauve hover:text-lavender text-sm"
          >
            Theme Editor &rarr;
          </a>
        </div>
        <select
          value={$settingsStore.theme}
          onchange={(e) => {
            settingsStore.update({ theme: (e.target as HTMLSelectElement).value });
            handleSave();
          }}
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve"
        >
          <option value="default">Default (Catppuccin Mocha)</option>
        </select>
      </section>

      <!-- Output Language -->
      <section class="space-y-3">
        <h2 class="text-sm font-medium text-text">Output Language</h2>
        <select
          value={$settingsStore.outputLanguage || ''}
          onchange={(e) => {
            settingsStore.update({ outputLanguage: (e.target as HTMLSelectElement).value });
            handleSave();
          }}
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve"
        >
          <option value="">No language override</option>
          <option value="English">English</option>
          <option value="Korean">Korean</option>
          <option value="Japanese">Japanese</option>
          <option value="Chinese (Simplified)">Chinese (Simplified)</option>
          <option value="Chinese (Traditional)">Chinese (Traditional)</option>
          <option value="Spanish">Spanish</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Portuguese">Portuguese</option>
          <option value="Russian">Russian</option>
          <option value="Italian">Italian</option>
          <option value="Thai">Thai</option>
          <option value="Vietnamese">Vietnamese</option>
          <option value="Indonesian">Indonesian</option>
          <option value="Arabic">Arabic</option>
          <option value="Turkish">Turkish</option>
          <option value="Dutch">Dutch</option>
          <option value="Polish">Polish</option>
        </select>
        <p class="text-xs text-subtext0">
          Forces the AI to write responses in the selected language.
        </p>
      </section>

      <!-- Developer Mode -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium text-text">Developer Mode</h2>
            <p class="text-xs text-subtext0">Enable advanced features and debug information.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={$settingsStore.developerMode ?? false}
            onclick={() => {
              settingsStore.update({ developerMode: !($settingsStore.developerMode ?? false) });
              handleSave();
            }}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                   transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-2 focus:ring-offset-base
                   {($settingsStore.developerMode ?? false) ? 'bg-mauve' : 'bg-surface1'}"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow ring-0
                     transition-transform duration-200 ease-in-out
                     {($settingsStore.developerMode ?? false) ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>
      </section>

      <!-- Image Generation -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">Image Generation</h2>
          <a
            href="/settings/image-generation"
            class="text-mauve hover:text-lavender text-sm"
          >
            Configure Images &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Set up illustration providers, art style presets, and auto-generation settings.
        </p>
      </section>

      <!-- Prompt Builder -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">Prompt Builder</h2>
          <a
            href="/settings/prompt-builder"
            class="text-mauve hover:text-lavender text-sm"
          >
            Configure Prompts &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Customize prompt assembly order, templates, and presets.
        </p>
      </section>

      <!-- Personas -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">User Personas</h2>
          <a
            href="/settings/personas"
            class="text-mauve hover:text-lavender text-sm"
          >
            Manage Personas &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Create and manage user personas for roleplay identity.
        </p>
      </section>

      <!-- Agent Settings -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">Agent Settings</h2>
          <a
            href="/settings/agents"
            class="text-mauve hover:text-lavender text-sm"
          >
            Configure Agents &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Enable/disable agents, set guidance modes, and configure token budgets for Director, Scene State, and Character State agents.
        </p>
      </section>

      <!-- Memory -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">Memory System</h2>
          <a
            href="/settings/memory"
            class="text-mauve hover:text-lavender text-sm"
          >
            Memory Settings &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Configure embedding provider, token budgets, and memory extraction parameters.
        </p>
      </section>

      <!-- Model Slots -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-text">Model Slots</h2>
          <a
            href="/settings/models"
            class="text-mauve hover:text-lavender text-sm"
          >
            Configure Models &rarr;
          </a>
        </div>
        <p class="text-xs text-subtext0">
          Dedicated model slots for memory extraction and illustration planning.
        </p>
      </section>
    </div>
  </div>
{/if}
