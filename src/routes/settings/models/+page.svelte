<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { getRegistry } from '$lib/core/bootstrap';
  import { DEFAULT_EXTRACTION_PROMPT, DEFAULT_SUMMARY_PROMPT } from '$lib/types/memory';

  let loaded = $state(false);
  let activeTab = $state<'memory' | 'illustration'>('memory');

  const providers = getRegistry().listProviders();

  const PROVIDER_BASE_URLS: Record<string, string> = {
    nanogpt: 'https://api.nanogpt.io/v1',
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    'local-llm': 'http://localhost:11434/v1',
  };

  let memorySlot = $state({
    provider: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    temperature: 0.3,
    customExtractionPrompt: '',
    customSummaryPrompt: '',
  });

  let illustrationSlot = $state({
    provider: '',
    apiKey: '',
    baseUrl: '',
    model: '',
    temperature: 0.3,
    customPlanningPrompt: '',
  });

  onMount(async () => {
    await settingsStore.load();
    const ms = $settingsStore.modelSlots || {};
    if (ms.memory) {
      memorySlot = { ...memorySlot, ...(ms.memory as any) };
    }
    if (ms.illustration) {
      illustrationSlot = { ...illustrationSlot, ...(ms.illustration as any) };
    }
    loaded = true;
  });

  function onMemoryProviderChange(id: string) {
    memorySlot.provider = id;
    if (PROVIDER_BASE_URLS[id] && !memorySlot.baseUrl) {
      memorySlot.baseUrl = PROVIDER_BASE_URLS[id];
    }
  }

  function onIllustrationProviderChange(id: string) {
    illustrationSlot.provider = id;
    if (PROVIDER_BASE_URLS[id] && !illustrationSlot.baseUrl) {
      illustrationSlot.baseUrl = PROVIDER_BASE_URLS[id];
    }
  }

  async function handleSave() {
    settingsStore.update({
      modelSlots: {
        ...($settingsStore.modelSlots || {}),
        memory: { ...memorySlot } as any,
        illustration: { ...illustrationSlot } as any,
      },
    });
    await settingsStore.save();
  }
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-6">
      <div class="flex items-center gap-3">
        <a href="/settings" class="text-subtext0 hover:text-text transition-colors">&larr;</a>
        <h1 class="text-lg font-semibold text-text">Model Slots</h1>
      </div>

      <p class="text-xs text-subtext0">
        Configure dedicated model slots for memory extraction and image generation. Falls back to the default chat provider if not configured.
      </p>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-surface0">
        <button
          onclick={() => { activeTab = 'memory'; }}
          class="px-4 py-2 text-sm transition-colors
                 {activeTab === 'memory'
                   ? 'text-mauve border-b-2 border-mauve'
                   : 'text-subtext0 hover:text-text'}"
        >
          Memory Model
        </button>
        <button
          onclick={() => { activeTab = 'illustration'; }}
          class="px-4 py-2 text-sm transition-colors
                 {activeTab === 'illustration'
                   ? 'text-mauve border-b-2 border-mauve'
                   : 'text-subtext0 hover:text-text'}"
        >
          Illustration Model
        </button>
      </div>

      {#if activeTab === 'memory'}
        <section class="space-y-4 rounded-lg border border-surface1 p-4">
          <h2 class="text-sm font-medium text-text">Memory Model Configuration</h2>
          <p class="text-xs text-subtext0">
            Model used for extracting facts from conversation and generating summaries.
          </p>

          <div class="space-y-1">
            <label class="text-sm text-text">Provider</label>
            <select
              value={memorySlot.provider}
              onchange={(e) => { onMemoryProviderChange((e.target as HTMLSelectElement).value); }}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
            >
              <option value="">-- Use Default Provider --</option>
              {#each providers as provider}
                <option value={provider.id}>{provider.name}</option>
              {/each}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">API Key</label>
            <input
              type="password"
              value={memorySlot.apiKey}
              oninput={(e) => { memorySlot.apiKey = (e.target as HTMLInputElement).value; }}
              placeholder="Leave empty to use default provider key"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Base URL</label>
            <input
              type="text"
              value={memorySlot.baseUrl}
              oninput={(e) => { memorySlot.baseUrl = (e.target as HTMLInputElement).value; }}
              placeholder={PROVIDER_BASE_URLS[memorySlot.provider] || 'https://api.openai.com/v1'}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Model</label>
            <input
              type="text"
              value={memorySlot.model}
              oninput={(e) => { memorySlot.model = (e.target as HTMLInputElement).value; }}
              placeholder="gpt-4o-mini"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Temperature: {memorySlot.temperature}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={memorySlot.temperature}
              oninput={(e) => { memorySlot.temperature = Number((e.target as HTMLInputElement).value); }}
              class="w-full accent-mauve"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-sm text-text">Custom Extraction Prompt</label>
              <button
                type="button"
                onclick={() => { memorySlot.customExtractionPrompt = DEFAULT_EXTRACTION_PROMPT; }}
                class="text-xs text-mauve hover:text-lavender"
              >
                Reset to Default
              </button>
            </div>
            <textarea
              value={memorySlot.customExtractionPrompt}
              oninput={(e) => { memorySlot.customExtractionPrompt = (e.target as HTMLTextAreaElement).value; }}
              rows="4"
              placeholder={DEFAULT_EXTRACTION_PROMPT.slice(0, 80) + '...'}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0 resize-y"
            ></textarea>
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-sm text-text">Custom Summary Prompt</label>
              <button
                type="button"
                onclick={() => { memorySlot.customSummaryPrompt = DEFAULT_SUMMARY_PROMPT; }}
                class="text-xs text-mauve hover:text-lavender"
              >
                Reset to Default
              </button>
            </div>
            <textarea
              value={memorySlot.customSummaryPrompt}
              oninput={(e) => { memorySlot.customSummaryPrompt = (e.target as HTMLTextAreaElement).value; }}
              rows="4"
              placeholder={DEFAULT_SUMMARY_PROMPT.slice(0, 80) + '...'}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0 resize-y"
            ></textarea>
          </div>
        </section>
      {:else}
        <section class="space-y-4 rounded-lg border border-surface1 p-4">
          <h2 class="text-sm font-medium text-text">Illustration Model Configuration</h2>
          <p class="text-xs text-subtext0">
            Model used for generating image prompts and planning illustration composition.
          </p>

          <div class="space-y-1">
            <label class="text-sm text-text">Provider</label>
            <select
              value={illustrationSlot.provider}
              onchange={(e) => { onIllustrationProviderChange((e.target as HTMLSelectElement).value); }}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
            >
              <option value="">-- Use Default Provider --</option>
              {#each providers as provider}
                <option value={provider.id}>{provider.name}</option>
              {/each}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">API Key</label>
            <input
              type="password"
              value={illustrationSlot.apiKey}
              oninput={(e) => { illustrationSlot.apiKey = (e.target as HTMLInputElement).value; }}
              placeholder="Leave empty to use default provider key"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Base URL</label>
            <input
              type="text"
              value={illustrationSlot.baseUrl}
              oninput={(e) => { illustrationSlot.baseUrl = (e.target as HTMLInputElement).value; }}
              placeholder={PROVIDER_BASE_URLS[illustrationSlot.provider] || 'https://api.openai.com/v1'}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Model</label>
            <input
              type="text"
              value={illustrationSlot.model}
              oninput={(e) => { illustrationSlot.model = (e.target as HTMLInputElement).value; }}
              placeholder="gpt-4o-mini"
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Temperature: {illustrationSlot.temperature}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={illustrationSlot.temperature}
              oninput={(e) => { illustrationSlot.temperature = Number((e.target as HTMLInputElement).value); }}
              class="w-full accent-mauve"
            />
          </div>

          <div class="space-y-1">
            <label class="text-sm text-text">Custom Planning Prompt</label>
            <textarea
              value={illustrationSlot.customPlanningPrompt}
              oninput={(e) => { illustrationSlot.customPlanningPrompt = (e.target as HTMLTextAreaElement).value; }}
              rows="4"
              placeholder="Custom prompt for illustration planning..."
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                     border border-surface1 focus:outline-none focus:border-mauve
                     placeholder:text-subtext0 resize-y"
            ></textarea>
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
