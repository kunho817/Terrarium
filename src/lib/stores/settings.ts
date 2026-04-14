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

    async load() {
      const settings = await settingsStorage.loadSettings();
      // Migrate: add default prompt preset if not present
      if (!settings.promptPresets) {
        settings.promptPresets = createDefaultPresetSettings();
      }
      // Migrate: add noiseSchedule to novelai config if missing
      if (settings.imageGeneration?.novelai && !(settings.imageGeneration.novelai as any).noiseSchedule) {
        settings.imageGeneration.novelai.noiseSchedule = 'karras';
      }
      // Migrate: update outdated system prompt and Author's Note, add missing items
      if (settings.promptPresets) {
        let migrated = false;
        for (const preset of settings.promptPresets.presets) {
          if (migratePresetItems(preset.items)) {
            migrated = true;
          }
          // Add missing default items (e.g., jailbreak) to old presets
          const defaultPreset = createDefaultPreset();
          const defaultItemsByType = new Map(defaultPreset.items.map(i => [i.type, i]));
          const existingTypes = new Set(preset.items.map(i => i.type));
          for (const [type, defaultItem] of defaultItemsByType) {
            if (!existingTypes.has(type)) {
              preset.items.push({ ...defaultItem, id: crypto.randomUUID() });
              migrated = true;
            }
          }
        }
        if (migrated) {
          await settingsStorage.saveSettings(settings);
        }
      }
      if (!settings.modelSlots) {
        settings.modelSlots = {};
      }
      if (!settings.memorySettings) {
        settings.memorySettings = {
          extractionBatchSize: 5,
          tokenBudget: 4096,
          topK: 15,
          summaryThreshold: 50,
          embeddingProvider: '',
          embeddingApiKey: '',
          embeddingModel: '',
        };
      }
      if (settings.outputLanguage === undefined) {
        settings.outputLanguage = '';
      }
      set(settings);
    },

    update(partial: Partial<AppSettings>) {
      update((s) => ({ ...s, ...partial }));
    },

    async save() {
      const state = get({ subscribe });
      await settingsStorage.saveSettings(state);
    },
  };
}

export const settingsStore = createSettingsStore();
