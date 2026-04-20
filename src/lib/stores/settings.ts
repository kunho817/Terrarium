/**
 * Settings store — reactive state for app settings.
 */

import { writable, get, type Updater } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import type { AgentSettings } from '$lib/types/config';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: true,
  turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048 },
  extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
  director: { mode: 'light' },
};

function createSettingsStore() {
  const { subscribe, set, update: storeUpdate } = writable<AppSettings>({
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
    update(partialOrUpdater: Partial<AppSettings> | Updater<AppSettings>) {
      if (typeof partialOrUpdater === 'function') {
        storeUpdate(partialOrUpdater);
        return;
      }
      storeUpdate((s) => ({ ...s, ...partialOrUpdater }));
    },
    
    async load() {
      const settings = await settingsStorage.loadSettings();
      set(settings);
    },
    
    async save() {
      const current = get({ subscribe });
      await settingsStorage.saveSettings(current);
    },
    
    updatePartial(partial: Partial<AppSettings>) {
      storeUpdate((s) => ({ ...s, ...partial }));
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
