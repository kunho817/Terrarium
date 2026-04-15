<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { getRegistry } from '$lib/core/bootstrap';

  let loaded = $state(false);
  let selectedProvider = $state('');
  let providerConfig = $state<Record<string, unknown>>({});

  const providers = getRegistry().listProviders();

  onMount(async () => {
    await settingsRepo.load();
    selectedProvider = $settingsStore.defaultProvider;
    if (selectedProvider) {
      providerConfig = { ...($settingsStore.providers[selectedProvider] || {}) };
    }
    loaded = true;
  });

  function selectProvider(id: string) {
    selectedProvider = id;
    providerConfig = { ...($settingsStore.providers[id] || {}) };
  }

  async function handleSave() {
    settingsStore.update({
      defaultProvider: selectedProvider,
      providers: {
        ...$settingsStore.providers,
        [selectedProvider]: providerConfig,
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
        <a href="/settings" class="text-subtext0 hover:text-text transition-colors">←</a>
        <h1 class="text-lg font-semibold text-text">Provider Settings</h1>
      </div>

      <!-- Provider tabs -->
      <div class="flex gap-1 border-b border-surface0">
        {#each providers as provider}
          <button
            onclick={() => selectProvider(provider.id)}
            class="px-4 py-2 text-sm transition-colors
                   {selectedProvider === provider.id
                     ? 'text-mauve border-b-2 border-mauve'
                     : 'text-subtext0 hover:text-text'}"
          >
            {provider.name}
          </button>
        {/each}
      </div>

      {#if selectedProvider}
        {@const currentProvider = providers.find(p => p.id === selectedProvider)}
        {#if currentProvider}
          <div class="space-y-4">
            {#each currentProvider.requiredConfig as field}
              <div class="space-y-1">
                <label for={field.key} class="text-sm text-text">{field.label}</label>
                {#if field.type === 'password'}
                  <input
                    id={field.key}
                    type="password"
                    value={providerConfig[field.key] || ''}
                    oninput={(e) => providerConfig[field.key] = (e.target as HTMLInputElement).value}
                    placeholder={field.placeholder || ''}
                    class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                           border border-surface1 focus:outline-none focus:border-mauve
                           placeholder:text-subtext0"
                  />
                {:else if field.type === 'number'}
                  <input
                    id={field.key}
                    type="number"
                    value={providerConfig[field.key] || field.defaultValue || ''}
                    oninput={(e) => providerConfig[field.key] = Number((e.target as HTMLInputElement).value)}
                    placeholder={field.placeholder || ''}
                    step="0.1"
                    class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                           border border-surface1 focus:outline-none focus:border-mauve
                           placeholder:text-subtext0"
                  />
                {:else if field.type === 'boolean'}
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!providerConfig[field.key]}
                      onchange={(e) => providerConfig[field.key] = (e.target as HTMLInputElement).checked}
                      class="accent-mauve"
                    />
                    <span class="text-sm text-subtext0">{field.label}</span>
                  </label>
                {:else}
                  <input
                    id={field.key}
                    type="text"
                    value={providerConfig[field.key] || ''}
                    oninput={(e) => providerConfig[field.key] = (e.target as HTMLInputElement).value}
                    placeholder={field.placeholder || ''}
                    class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                           border border-surface1 focus:outline-none focus:border-mauve
                           placeholder:text-subtext0"
                  />
                {/if}
              </div>
            {/each}

            <button
              onclick={handleSave}
              class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium
                     hover:bg-lavender transition-colors"
            >
              Save
            </button>
          </div>
        {/if}
      {:else}
        <p class="text-subtext0 text-sm">Select a provider to configure</p>
      {/if}
    </div>
  </div>
{/if}
