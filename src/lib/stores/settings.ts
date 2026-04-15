/**
 * Settings store — reactive state for app settings.
 */

import { writable, get } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>({
    defaultProvider: '',
    theme: 'default',
    providers: {},
    developerMode: false,
    imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as import('$lib/types/image-config').ImageGenerationConfig,
    modelSlots: {},
    memorySettings: {
      extractionBatchSize: 5,
      tokenBudget: 4096,
      topK: 15,
      summaryThreshold: 50,
      embeddingProvider: '',
      embeddingApiKey: '',
      embeddingModel: '',
    },
    outputLanguage: '',
  });

  return {
    subscribe,
    set,
    update,
    
    // Helper for partial updates (backward compatible)
    updatePartial(partial: Partial<AppSettings>) {
      update((s) => ({ ...s, ...partial }));
    },
    
    reset() {
      set({
        defaultProvider: '',
        theme: 'default',
        providers: {},
        developerMode: false,
        imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as import('$lib/types/image-config').ImageGenerationConfig,
        modelSlots: {},
        memorySettings: {
          extractionBatchSize: 5,
          tokenBudget: 4096,
          topK: 15,
          summaryThreshold: 50,
          embeddingProvider: '',
          embeddingApiKey: '',
          embeddingModel: '',
        },
        outputLanguage: '',
      });
    },
  };
}

export const settingsStore = createSettingsStore();
