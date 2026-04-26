import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import {
  createDefaultAgentPrefills,
  createDefaultAgentPromptOverrides,
} from '$lib/core/agents/prompt-defaults';
import { DEFAULT_IMAGE_CONFIG, type ImageGenerationConfig } from '$lib/types/image-config';
import type {
  AgentPromptGraphSettings,
  AgentPromptOverrideSettings,
  AgentPromptPrefillSettings,
  GraphPromptTemplate,
} from '$lib/types/config';
import type { AppSettings } from '$lib/storage/settings';
import type { ImagePromptGraphKey } from '$lib/types/image-config';
import type { PromptPreset } from '$lib/types/prompt-preset';

function getSettingsSnapshot(settings?: AppSettings): AppSettings {
  return settings ?? get(settingsStore);
}

export function getActivePromptPreset(settings?: AppSettings): PromptPreset | undefined {
  const snapshot = getSettingsSnapshot(settings);
  const presets = snapshot.promptPresets;
  if (!presets) {
    return undefined;
  }

  return presets.presets.find((preset) => preset.id === presets.activePresetId);
}

export function getActivePresetMainJailbreak(settings?: AppSettings): string {
  const preset = getActivePromptPreset(settings);
  if (!preset) {
    return '';
  }

  const jailbreak = preset.items.find((item) => item.type === 'jailbreak' && item.enabled);
  return jailbreak?.content?.trim() ?? '';
}

export function getActiveAgentPromptOverrides(settings?: AppSettings): AgentPromptOverrideSettings {
  const snapshot = getSettingsSnapshot(settings);
  const preset = getActivePromptPreset(snapshot);

  if (preset) {
    return {
      ...createDefaultAgentPromptOverrides(),
      ...(preset.agentPromptOverrides ?? {}),
    };
  }

  return {
    ...createDefaultAgentPromptOverrides(),
    ...(snapshot.agentSettings?.promptOverrides ?? {}),
  };
}

export function getActiveAgentPrefills(settings?: AppSettings): AgentPromptPrefillSettings {
  const snapshot = getSettingsSnapshot(settings);
  const preset = getActivePromptPreset(snapshot);

  if (preset) {
    return {
      ...createDefaultAgentPrefills(),
      ...(preset.agentPrefills ?? {}),
    };
  }

  return {
    ...createDefaultAgentPrefills(),
    ...(snapshot.agentSettings?.prefills ?? {}),
  };
}

export function getActiveAgentPromptGraphs(settings?: AppSettings): AgentPromptGraphSettings {
  const snapshot = getSettingsSnapshot(settings);
  const preset = getActivePromptPreset(snapshot);

  if (preset) {
    return {
      ...(preset.agentPromptGraphs ?? {}),
    };
  }

  return {
    ...(snapshot.agentSettings?.promptGraphs ?? {}),
  };
}

export function getActiveAgentJailbreak(settings?: AppSettings): string {
  const snapshot = getSettingsSnapshot(settings);
  const preset = getActivePromptPreset(snapshot);
  if (preset) {
    return preset.agentJailbreak?.trim() || getActivePresetMainJailbreak(snapshot) || '';
  }

  return snapshot.agentSettings?.jailbreak?.trim() || getActivePresetMainJailbreak(snapshot) || '';
}

export function getActiveImagePromptConfig(settings?: AppSettings): ImageGenerationConfig {
  const snapshot = getSettingsSnapshot(settings);
  const preset = getActivePromptPreset(snapshot);
  const runtimeConfig: Partial<ImageGenerationConfig> = snapshot.imageGeneration ?? {};

  if (preset) {
    const presetPrompts = preset.imagePrompts ?? {};
    return {
      ...DEFAULT_IMAGE_CONFIG,
      ...runtimeConfig,
      planningSystemPrompt:
        presetPrompts.planningSystemPrompt ?? DEFAULT_IMAGE_CONFIG.planningSystemPrompt,
      planningPrefill:
        presetPrompts.planningPrefill ?? DEFAULT_IMAGE_CONFIG.planningPrefill,
      imagePromptInstructions:
        presetPrompts.imagePromptInstructions ?? DEFAULT_IMAGE_CONFIG.imagePromptInstructions,
      promptPrefill:
        presetPrompts.promptPrefill ?? DEFAULT_IMAGE_CONFIG.promptPrefill,
      backfillSystemPrompt:
        presetPrompts.backfillSystemPrompt ?? DEFAULT_IMAGE_CONFIG.backfillSystemPrompt,
      backfillPrefill:
        presetPrompts.backfillPrefill ?? DEFAULT_IMAGE_CONFIG.backfillPrefill,
      promptGraphs: {
        ...(preset.imagePromptGraphs ?? {}),
      } as Partial<Record<ImagePromptGraphKey, GraphPromptTemplate>>,
      jailbreak: preset.imageJailbreak ?? DEFAULT_IMAGE_CONFIG.jailbreak,
    };
  }

  return {
    ...DEFAULT_IMAGE_CONFIG,
    ...runtimeConfig,
    promptGraphs: {
      ...(runtimeConfig.promptGraphs ?? {}),
    } as Partial<Record<ImagePromptGraphKey, GraphPromptTemplate>>,
    jailbreak: runtimeConfig.jailbreak ?? DEFAULT_IMAGE_CONFIG.jailbreak,
  };
}
