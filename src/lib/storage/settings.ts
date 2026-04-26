/**
 * Global settings read/write.
 * Settings stored in settings.json at the AppData root.
 */

import { readJson, writeJson, existsPath } from './database';
import { PATHS } from './paths';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { ModelSlot, ModelProfile, MemorySettings, AgentSettings, ResponseLengthTierId } from '$lib/types/config';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
import {
  createDefaultAgentPrefills,
  createDefaultAgentPromptOverrides,
} from '$lib/core/agents/prompt-defaults';
import {
  DEFAULT_RESPONSE_LENGTH_TIER,
  clampTargetImageCount,
} from '$lib/types/chat-settings';

export interface AppSettings {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  promptPresets?: PromptPresetSettings;
  developerMode?: boolean;
  imageGeneration?: ImageGenerationConfig;
  defaultPersonaId?: string;
  customArtStylePresets?: ArtStylePreset[];
  modelProfiles?: Record<string, ModelProfile>;
  modelSlots?: Record<string, ModelSlot>;
  memorySettings?: MemorySettings;
  outputLanguage?: string;
  responseLengthTier?: ResponseLengthTierId;
  agentSettings?: AgentSettings;
  [key: string]: unknown;
}

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: true,
  jailbreak: '',
  turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048, timeoutMs: 240000 },
  extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
  director: { mode: 'light' },
  worldMode: {
    extractEntities: true,
    extractRelations: true,
    sectionWorldInjection: true,
  },
  promptOverrides: createDefaultAgentPromptOverrides(),
  prefills: createDefaultAgentPrefills(),
  promptGraphs: {},
  promptBoard: undefined,
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  promptPresets: undefined,
  developerMode: false,
  imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as ImageGenerationConfig,
  modelProfiles: {},
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
  responseLengthTier: DEFAULT_RESPONSE_LENGTH_TIER,
  agentSettings: { ...DEFAULT_AGENT_SETTINGS },
};

function normalizeAgentSettings(agentSettings?: AgentSettings): AgentSettings {
  const worldModeDefaults = DEFAULT_AGENT_SETTINGS.worldMode ?? {
    extractEntities: true,
    extractRelations: true,
    sectionWorldInjection: true,
  };
  const promptOverrides = {
    ...createDefaultAgentPromptOverrides(),
    ...(agentSettings?.promptOverrides ?? {}),
  };
  const prefills = {
    ...createDefaultAgentPrefills(),
    ...(agentSettings?.prefills ?? {}),
  };
  const promptGraphs = {
    ...(agentSettings?.promptGraphs ?? {}),
  };
  const promptBoard = agentSettings?.promptBoard;
  const worldMode = {
    ...worldModeDefaults,
    ...(agentSettings?.worldMode ?? {}),
  };

  return {
    enabled: agentSettings?.enabled ?? DEFAULT_AGENT_SETTINGS.enabled,
    jailbreak: agentSettings?.jailbreak ?? DEFAULT_AGENT_SETTINGS.jailbreak,
    turnMaintenance: {
      ...DEFAULT_AGENT_SETTINGS.turnMaintenance,
      ...(agentSettings?.turnMaintenance ?? {}),
    },
    extraction: {
      ...DEFAULT_AGENT_SETTINGS.extraction,
      ...(agentSettings?.extraction ?? {}),
    },
    director: {
      ...DEFAULT_AGENT_SETTINGS.director,
      ...(agentSettings?.director ?? {}),
    },
    worldMode,
    promptOverrides,
    prefills,
    promptGraphs,
    promptBoard,
  };
}

function normalizeSettings(settings?: AppSettings): AppSettings {
  const imageGeneration: ImageGenerationConfig = {
    ...DEFAULT_IMAGE_CONFIG,
    ...(settings?.imageGeneration ?? {}),
  };
  imageGeneration.targetImageCount = clampTargetImageCount(
    imageGeneration.targetImageCount,
    settings?.responseLengthTier ?? DEFAULT_RESPONSE_LENGTH_TIER,
  );
  const memorySettings: MemorySettings = {
    ...(DEFAULT_SETTINGS.memorySettings as MemorySettings),
    ...(settings?.memorySettings ?? {}),
  };

  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    imageGeneration,
    memorySettings,
    modelProfiles: {
      ...(DEFAULT_SETTINGS.modelProfiles ?? {}),
      ...(settings?.modelProfiles ?? {}),
    },
    modelSlots: {
      ...(DEFAULT_SETTINGS.modelSlots ?? {}),
      ...(settings?.modelSlots ?? {}),
    },
    providers: {
      ...(DEFAULT_SETTINGS.providers ?? {}),
      ...(settings?.providers ?? {}),
    },
    responseLengthTier: settings?.responseLengthTier ?? DEFAULT_RESPONSE_LENGTH_TIER,
    agentSettings: normalizeAgentSettings(settings?.agentSettings),
  };
}

export async function loadSettings(): Promise<AppSettings> {
  if (!(await existsPath(PATHS.settings))) {
    return normalizeSettings();
  }
  const loaded = await readJson<AppSettings>(PATHS.settings);
  return normalizeSettings(loaded);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(PATHS.settings, settings);
}
