/**
 * Settings repository — handles persistence for settings store.
 */

import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import * as settingsStorage from '$lib/storage/settings';
import { StorageError } from '$lib/errors/error-types';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
import type { AppSettings } from '$lib/storage/settings';

export const settingsRepo = {
  /**
   * Load settings from storage and apply migrations.
   */
  async load(): Promise<void> {
    try {
      const settings = await settingsStorage.loadSettings();
      
      // Migrate: add default prompt preset if not present
      if (!settings.promptPresets) {
        settings.promptPresets = createDefaultPresetSettings();
      }
      
      // Migrate: add noiseSchedule to novelai config if missing
      if (settings.imageGeneration?.novelai && !settings.imageGeneration.novelai.noiseSchedule) {
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
      
      // Ensure all required fields exist
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
      
      settingsStore.set(settings);
    } catch (error) {
      throw new StorageError(
        'loadSettings',
        'Failed to load settings',
        error as Error
      );
    }
  },

  /**
   * Save current settings to storage.
   */
  async save(): Promise<void> {
    try {
      const state = get(settingsStore);
      await settingsStorage.saveSettings(state);
    } catch (error) {
      throw new StorageError(
        'saveSettings',
        'Failed to save settings',
        error as Error
      );
    }
  },
  
  /**
   * Get current state (synchronous, for non-async usage).
   */
  getCurrentState(): AppSettings {
    return get(settingsStore);
  },
};
