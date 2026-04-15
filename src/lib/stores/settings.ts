/**
 * Settings store — pure reactive state only.
 * Persistence handled by settingsRepo in repositories/settings-repo.ts
 */

import { writable } from 'svelte/store';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { ModelSlot, MemorySettings } from '$lib/types/config';

export interface SettingsState {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  promptPresets?: PromptPresetSettings;
  developerMode?: boolean;
  imageGeneration?: ImageGenerationConfig;
  defaultPersonaId?: string;
  customArtStylePresets?: ArtStylePreset[];
  modelSlots?: Record<string, ModelSlot>;
  memorySettings?: MemorySettings;
  outputLanguage: string;
}

const DEFAULT_STATE: SettingsState = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  outputLanguage: '',
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<SettingsState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    // Custom update that accepts partial object (backward compatible)
    update: (partial: Partial<SettingsState>) => {
      update((s) => ({ ...s, ...partial }));
    },
    reset: () => set(DEFAULT_STATE),
  };
}

export const settingsStore = createSettingsStore();
