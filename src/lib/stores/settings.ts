/**
 * Settings store — reactive state for app settings.
 */

import { writable, get } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import type { AgentSettings } from '$lib/types/config';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  director: {
    enabled: true,
    mode: 'light',
    tokenBudget: 6400,
  },
  scene: {
    enabled: true,
    tokenBudget: 2560,
  },
  character: {
    enabled: true,
    autoTrack: true,
    tokenBudget: 6400,
  },
};

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
    agentSettings: { ...DEFAULT_AGENT_SETTINGS },
  });

  return {
    subscribe,
    set,
    update,
    
    async load() {
      const settings = await settingsStorage.loadSettings();
      set(settings);
    },
    
    async save() {
      const current = get({ subscribe });
      await settingsStorage.saveSettings(current);
    },
    
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
        agentSettings: { ...DEFAULT_AGENT_SETTINGS },
      });
    },
  };
}

export const settingsStore = createSettingsStore();
