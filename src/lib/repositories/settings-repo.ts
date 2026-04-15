import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { ModelSlot, MemorySettings } from '$lib/types/config';
import type { AppSettings } from '$lib/storage/settings';

export const settingsRepo = {
  async load(): Promise<void> {
    try {
      const raw = await settingsStorage.loadSettings();
      const migrated = this.migrate(raw);
      settingsStore.update(() => migrated);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  async save(): Promise<void> {
    try {
      const state = this.getCurrentState();
      await settingsStorage.saveSettings(state);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },

  getCurrentState(): AppSettings {
    return get(settingsStore);
  },

  migrate(raw: any): AppSettings {
    if (!raw || typeof raw !== 'object') {
      raw = {};
    }

    if (!raw.promptPresets) {
      raw.promptPresets = createDefaultPresetSettings();
    }

    if (raw.imageGeneration?.novelai && !raw.imageGeneration.novelai.noiseSchedule) {
      raw.imageGeneration.noiseSchedule = 'karras';
    }

    if (raw.promptPresets?.presets) {
      for (const preset of raw.promptPresets.presets) {
        migratePresetItems(preset.items);
        
        const defaultPreset = createDefaultPreset();
        const existingTypes = new Set(preset.items.map((i: { type: string }) => i.type));
        for (const defaultItem of defaultPreset.items) {
          if (!existingTypes.has(defaultItem.type)) {
            preset.items.push({ ...defaultItem, id: crypto.randomUUID() });
          }
        }
      }
    }

    if (!raw.modelSlots) raw.modelSlots = {};
    if (!raw.memorySettings) {
      raw.memorySettings = {
        extractionBatchSize: 5,
        tokenBudget: 4096,
        topK: 15,
        summaryThreshold: 50,
        embeddingProvider: '',
        embeddingApiKey: '',
        embeddingModel: '',
      };
    }
    if (raw.outputLanguage === undefined) raw.outputLanguage = '';

    return raw as AppSettings;
  }
};
