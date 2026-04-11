/**
 * Global settings read/write.
 * Settings stored in settings.json at the AppData root.
 */

import { readJson, writeJson, existsPath } from './database';
import { PATHS } from './paths';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

export interface AppSettings {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  promptPresets?: PromptPresetSettings;
  developerMode?: boolean;
  imageGeneration?: ImageGenerationConfig;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  promptPresets: undefined,
  developerMode: false,
  imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as ImageGenerationConfig,
};

export async function loadSettings(): Promise<AppSettings> {
  if (!(await existsPath(PATHS.settings))) {
    return { ...DEFAULT_SETTINGS };
  }
  return readJson<AppSettings>(PATHS.settings);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(PATHS.settings, settings);
}
