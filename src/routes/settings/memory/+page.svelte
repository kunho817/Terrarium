<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';

  let loaded = $state(false);

  let embeddingProvider = $state('');
  let embeddingApiKey = $state('');
  let embeddingModel = $state('');
  let extractionBatchSize = $state(5);
  let tokenBudget = $state(4096);
  let topK = $state(15);
  let summaryThreshold = $state(50);

  let providerMaxTokens = $state(2048);

  function refreshProviderMaxTokens() {
    const settings = $settingsStore;
    const dp = settings.defaultProvider;
    if (dp && settings.providers[dp]) {
      providerMaxTokens = (settings.providers[dp].maxTokens as number) || 2048;
    } else {
      providerMaxTokens = 2048;
    }
  }

  onMount(async () => {
    await settingsRepo.load();
    const ms = $settingsStore.memorySettings;
    if (ms) {
      embeddingProvider = ms.embeddingProvider || '';
      embeddingApiKey = ms.embeddingApiKey || '';
      embeddingModel = ms.embeddingModel || '';
      extractionBatchSize = ms.extractionBatchSize ?? 5;
      tokenBudget = ms.tokenBudget ?? 4096;
      topK = ms.topK ?? 15;
      summaryThreshold = ms.summaryThreshold ?? 50;
    }
    refreshProviderMaxTokens();
    loaded = true;
  });

  async function handleSave() {
    settingsStore.update({
      memorySettings: {
        embeddingProvider,
        embeddingApiKey,
        embeddingModel,
        extractionBatchSize,
        tokenBudget,
        topK,
        summaryThreshold,
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
        <h1 class="text-lg font-semibold text-text">Memory Settings</h1>
      </div>

      <p class="text-xs text-subtext0">
        Configure the memory system that extracts and retrieves facts from conversation for context continuity.
      </p>

      <!-- Embedding Provider -->
      <section class="space-y-4 rounded-lg border border-surface1 p-4">
        <h2 class="text-sm font-medium text-text">Embedding Provider</h2>
        <p class="text-xs text-subtext0">
          Required for vector-based memory search. Used to embed messages and memories for similarity matching.
        </p>

        <div class="space-y-1">
          <label for="emb-provider" class="text-sm text-text">Provider</label>
          <select
            id="emb-provider"
            value={embeddingProvider}
            onchange={(e) => { embeddingProvider = (e.target as HTMLSelectElement).value; }}
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve"
          >
            <option value="">-- Disabled --</option>
            <option value="voyage">Voyage AI</option>
            <option value="openai-compatible">OpenAI-Compatible</option>
          </select>
        </div>

        <div class="space-y-1">
          <label for="emb-apikey" class="text-sm text-text">API Key</label>
          <input
            id="emb-apikey"
            type="password"
            value={embeddingApiKey}
            oninput={(e) => { embeddingApiKey = (e.target as HTMLInputElement).value; }}
            placeholder="Enter API key"
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                   border border-surface1 focus:outline-none focus:border-mauve
                   placeholder:text-subtext0"
          />
        </div>

        <div class="space-y-1">
          <label for="emb-model" class="text-sm text-text">Model</label>
          <input
            id="emb-model"
            type="text"
            value={embeddingModel}
            oninput={(e) => { embeddingModel = (e.target as HTMLInputElement).value; }}
            placeholder={embeddingProvider === 'voyage' ? 'voyage-3' : 'text-embedding-3-small'}
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                   border border-surface1 focus:outline-none focus:border-mauve
                   placeholder:text-subtext0"
          />
        </div>
      </section>

      <!-- Memory Parameters -->
      <section class="space-y-4 rounded-lg border border-surface1 p-4">
        <h2 class="text-sm font-medium text-text">Memory Parameters</h2>

        <div class="space-y-1">
          <label for="batch-size" class="text-sm text-text">Extraction Batch Size</label>
          <input
            id="batch-size"
            type="number"
            min="1"
            max="20"
            value={extractionBatchSize}
            oninput={(e) => { extractionBatchSize = Number((e.target as HTMLInputElement).value) || 5; }}
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                   border border-surface1 focus:outline-none focus:border-mauve"
          />
          <p class="text-xs text-subtext0">Number of turns between memory extractions.</p>
        </div>

        <div class="space-y-1">
          <label for="token-budget" class="text-sm text-text">Token Budget: {tokenBudget}</label>
          <input
            id="token-budget"
            type="range"
            min="256"
            max={providerMaxTokens}
            step="256"
            value={tokenBudget}
            oninput={(e) => { tokenBudget = Number((e.target as HTMLInputElement).value); }}
            class="w-full accent-mauve"
          />
          <div class="flex justify-between text-xs text-subtext0">
            <span>256</span>
            <span>{providerMaxTokens}</span>
          </div>
          <p class="text-xs text-subtext0">
            Maximum tokens for injected memory context per turn.
            Capped by the default provider's Max Tokens setting ({providerMaxTokens}).
          </p>
        </div>

        <div class="space-y-1">
          <label for="top-k" class="text-sm text-text">Top-K Memories</label>
          <input
            id="top-k"
            type="number"
            min="1"
            max="50"
            value={topK}
            oninput={(e) => { topK = Number((e.target as HTMLInputElement).value) || 15; }}
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                   border border-surface1 focus:outline-none focus:border-mauve"
          />
          <p class="text-xs text-subtext0">Number of similar memories to retrieve per query.</p>
        </div>

        <div class="space-y-1">
          <label for="summary-threshold" class="text-sm text-text">Summary Threshold</label>
          <input
            id="summary-threshold"
            type="number"
            min="10"
            max="200"
            value={summaryThreshold}
            oninput={(e) => { summaryThreshold = Number((e.target as HTMLInputElement).value) || 50; }}
            class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2
                   border border-surface1 focus:outline-none focus:border-mauve"
          />
          <p class="text-xs text-subtext0">Number of turns before triggering conversation summarization.</p>
        </div>
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
