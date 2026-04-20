/**
 * Global settings read/write.
 * Settings stored in settings.json at the AppData root.
 */

import { readJson, writeJson, existsPath } from './database';
import { PATHS } from './paths';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { ModelSlot, MemorySettings, AgentSettings } from '$lib/types/config';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

export interface AppSettings {
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
  outputLanguage?: string;
  agentSettings?: AgentSettings;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  promptPresets: undefined,
  developerMode: false,
  imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as ImageGenerationConfig,
  modelSlots: {},
  memorySettings: {
    embeddingProvider: '',
    embeddingApiKey: '',
    embeddingModel: '',
    topK: 15,
    tokenBudget: 4096,
    extractionBatchSize: 5,
    summaryThreshold: 50,
  },
  outputLanguage: '',
  agentSettings: {
    director: { enabled: false, mode: 'light', tokenBudget: 1024 },
    scene: { enabled: true, tokenBudget: 2560 },
    character: { enabled: true, autoTrack: true, tokenBudget: 6400 },
  },
};

export async function loadSettings(): Promise<AppSettings> {
  if (!(await existsPath(PATHS.settings))) {
    return { ...DEFAULT_SETTINGS };
  }
  const loaded = await readJson<AppSettings>(PATHS.settings);
  return { ...DEFAULT_SETTINGS, ...loaded };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(PATHS.settings, settings);
}
