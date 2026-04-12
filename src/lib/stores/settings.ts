/**
 * Settings store — reactive state for app settings.
 */

import { writable, get } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>({
    defaultProvider: '',
    theme: 'default',
    providers: {},
    developerMode: false,
    imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as import('$lib/types/image-config').ImageGenerationConfig,
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
      // Migrate: update outdated system prompt and Author's Note
      if (settings.promptPresets) {
        for (const preset of settings.promptPresets.presets) {
          migratePresetItems(preset.items);
        }
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
