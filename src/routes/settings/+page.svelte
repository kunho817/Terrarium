<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { getRegistry } from '$lib/core/bootstrap';

  let loaded = $state(false);

  onMount(async () => {
    await settingsStore.load();
    loaded = true;
  });

  async function handleSave() {
    await settingsStore.save();
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
            Configure Providers →
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
        <h2 class="text-sm font-medium text-text">Theme</h2>
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
    </div>
  </div>
{/if}
