import { describe, expect, it } from 'vitest';
import {
  getActiveAgentJailbreak,
  getActiveAgentPrefills,
  getActiveAgentPromptOverrides,
  getActiveImagePromptConfig,
  getActivePresetMainJailbreak,
} from '$lib/core/presets/active-preset';
import { createDefaultPresetSettings } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

describe('active-preset', () => {
  it('prefers active preset agent and image prompt data over global settings', () => {
    const promptPresets = createDefaultPresetSettings();
    const preset = promptPresets.presets[0];
    preset.agentPromptOverrides = {
      ...(preset.agentPromptOverrides ?? {}),
      storyAuthorSystem: 'Preset planning override',
    };
    preset.agentPrefills = {
      ...(preset.agentPrefills ?? {}),
      storyAuthor: 'Preset prefill',
    };
    preset.agentJailbreak = 'Preset agent jailbreak';
    preset.imagePrompts = {
      ...(preset.imagePrompts ?? {}),
      planningSystemPrompt: 'Preset image planning',
    };
    preset.imageJailbreak = 'Preset image jailbreak';

    const settings = {
      promptPresets,
      agentSettings: {
        enabled: true,
        jailbreak: 'Global agent jailbreak',
        turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048, timeoutMs: 240000 },
        extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
        director: { mode: 'light' as const },
        worldMode: { extractEntities: true, extractRelations: true, sectionWorldInjection: true },
        promptOverrides: {
          ...(preset.agentPromptOverrides ?? {}),
          storyAuthorSystem: 'Global planning override',
        },
        prefills: {
          ...(preset.agentPrefills ?? {}),
          storyAuthor: 'Global prefill',
        },
        promptGraphs: {},
      },
      imageGeneration: {
        ...DEFAULT_IMAGE_CONFIG,
        planningSystemPrompt: 'Global image planning',
        jailbreak: 'Global image jailbreak',
      },
    } as any;

    expect(getActiveAgentPromptOverrides(settings).storyAuthorSystem).toBe('Preset planning override');
    expect(getActiveAgentPrefills(settings).storyAuthor).toBe('Preset prefill');
    expect(getActiveAgentJailbreak(settings)).toBe('Preset agent jailbreak');
    expect(getActiveImagePromptConfig(settings).planningSystemPrompt).toBe('Preset image planning');
    expect(getActiveImagePromptConfig(settings).jailbreak).toBe('Preset image jailbreak');
    expect(getActiveImagePromptConfig(settings).provider).toBe(DEFAULT_IMAGE_CONFIG.provider);
  });

  it('does not leak hidden global prompt text when an active preset exists', () => {
    const promptPresets = createDefaultPresetSettings();
    const preset = promptPresets.presets[0];
    const presetStoryAuthor = preset.agentPromptOverrides?.storyAuthorSystem;
    const presetImagePlanning = preset.imagePrompts?.planningSystemPrompt;

    const settings = {
      promptPresets,
      agentSettings: {
        enabled: true,
        jailbreak: 'Hidden global jailbreak',
        turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048, timeoutMs: 240000 },
        extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
        director: { mode: 'light' as const },
        worldMode: { extractEntities: true, extractRelations: true, sectionWorldInjection: true },
        promptOverrides: {
          ...(preset.agentPromptOverrides ?? {}),
          storyAuthorSystem: 'Hidden global planning',
        },
        prefills: {
          ...(preset.agentPrefills ?? {}),
        },
        promptGraphs: {},
      },
      imageGeneration: {
        ...DEFAULT_IMAGE_CONFIG,
        provider: 'comfyui',
        planningSystemPrompt: 'Hidden global image planning',
        jailbreak: 'Hidden global image jailbreak',
      },
    } as any;

    expect(getActiveAgentPromptOverrides(settings).storyAuthorSystem).toBe(presetStoryAuthor);
    expect(getActiveAgentJailbreak(settings)).toBe('');
    expect(getActiveImagePromptConfig(settings).planningSystemPrompt).toBe(presetImagePlanning);
    expect(getActiveImagePromptConfig(settings).provider).toBe('comfyui');
  });

  it('reads the enabled main jailbreak item from the active preset', () => {
    const promptPresets = createDefaultPresetSettings();
    const preset = promptPresets.presets[0];
    const jailbreak = preset.items.find((item) => item.type === 'jailbreak');
    if (!jailbreak) {
      throw new Error('Expected default preset jailbreak item');
    }
    jailbreak.enabled = true;
    jailbreak.content = 'Preset main jailbreak';

    expect(getActivePresetMainJailbreak({ promptPresets } as any)).toBe('Preset main jailbreak');
  });
});
