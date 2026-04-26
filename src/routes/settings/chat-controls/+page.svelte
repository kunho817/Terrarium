<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import ChatTuningControls from '$lib/components/editors/ChatTuningControls.svelte';
  import {
    DEFAULT_RESPONSE_LENGTH_TIER,
    clampTargetImageCount,
    type ResponseLengthTierId,
  } from '$lib/types/chat-settings';
  import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

  let loaded = $state(false);
  let responseLengthTier = $state<ResponseLengthTierId>(DEFAULT_RESPONSE_LENGTH_TIER);
  let outputLanguage = $state('');
  let autoGenerate = $state(false);
  let targetImageCount = $state(2);

  function loadFromStore() {
    const settings = $settingsStore;
    responseLengthTier = settings.responseLengthTier ?? DEFAULT_RESPONSE_LENGTH_TIER;
    outputLanguage = settings.outputLanguage ?? '';
    autoGenerate = settings.imageGeneration?.autoGenerate ?? false;
    targetImageCount = clampTargetImageCount(
      settings.imageGeneration?.targetImageCount,
      responseLengthTier,
    );
  }

  async function handleSave() {
    settingsStore.update((settings) => ({
      ...settings,
      outputLanguage,
      responseLengthTier,
      imageGeneration: {
        ...DEFAULT_IMAGE_CONFIG,
        ...(settings.imageGeneration ?? {}),
        autoGenerate,
        targetImageCount: clampTargetImageCount(targetImageCount, responseLengthTier),
      },
    }));
    await settingsRepo.save();
  }

  onMount(async () => {
    await settingsRepo.load();
    loadFromStore();
    loaded = true;
  });
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-text">Chat Controls</h1>
          <p class="text-sm text-subtext0">Response length, auto illustrations, and language overrides for active chats.</p>
        </div>
        <a
          href="/settings"
          class="text-mauve hover:text-lavender text-sm"
        >
          &larr; Back to Settings
        </a>
      </div>

      <ChatTuningControls
        bind:responseLengthTier
        bind:outputLanguage
        bind:autoGenerate
        bind:targetImageCount
        imageProviderAvailable={$settingsStore.imageGeneration?.provider !== 'none' && $settingsStore.imageGeneration?.provider !== undefined}
      />

      <div class="pt-2 pb-6">
        <button
          type="button"
          onclick={handleSave}
          class="bg-mauve text-crust rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Save Settings
        </button>
      </div>
    </div>
  </div>
{/if}
