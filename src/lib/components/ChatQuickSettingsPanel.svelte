<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import ChatTuningControls from '$lib/components/editors/ChatTuningControls.svelte';
  import {
    DEFAULT_RESPONSE_LENGTH_TIER,
    clampTargetImageCount,
    type ResponseLengthTierId,
  } from '$lib/types/chat-settings';
  import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

  let {
    onclose,
  }: {
    onclose: () => void;
  } = $props();

  let responseLengthTier = $state<ResponseLengthTierId>(DEFAULT_RESPONSE_LENGTH_TIER);
  let outputLanguage = $state('');
  let autoGenerate = $state(false);
  let targetImageCount = $state(2);
  let saving = $state(false);

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

  async function handleApply() {
    saving = true;
    try {
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
    } finally {
      saving = false;
    }
  }

  loadFromStore();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex justify-end bg-overlay/50"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-[30rem] max-w-full h-full bg-mantle border-l border-surface0 flex flex-col shadow-xl"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface0">
      <div>
        <h2 class="text-sm font-semibold text-text">Chat Controls</h2>
        <p class="text-xs text-subtext0">Adjust high-impact chat settings without leaving the conversation.</p>
      </div>
      <button
        type="button"
        onclick={onclose}
        class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-1"
        aria-label="Close"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <ChatTuningControls
        bind:responseLengthTier
        bind:outputLanguage
        bind:autoGenerate
        bind:targetImageCount
        imageProviderAvailable={$settingsStore.imageGeneration?.provider !== 'none' && $settingsStore.imageGeneration?.provider !== undefined}
      />
    </div>

    <div class="border-t border-surface0 px-4 py-3 flex items-center justify-between gap-3">
      <a href="/settings/chat-controls" class="text-xs text-mauve hover:text-lavender">Open full settings</a>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={loadFromStore}
          disabled={saving}
          class="rounded-md border border-surface1 px-3 py-2 text-sm text-text hover:bg-surface0 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onclick={handleApply}
          disabled={saving}
          class="bg-mauve text-crust rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Apply'}
        </button>
      </div>
    </div>
  </div>
</div>
