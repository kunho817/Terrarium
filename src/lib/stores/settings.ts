/**
 * Settings store — reactive state for app settings.
 */

import { writable, get } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import * as settingsStorage from '$lib/storage/settings';

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>({
    defaultProvider: '',
    theme: 'default',
    providers: {},
  });

  return {
    subscribe,

    async load() {
      const settings = await settingsStorage.loadSettings();
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
