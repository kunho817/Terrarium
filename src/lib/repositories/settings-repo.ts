/**
 * Settings repository — handles persistence for settings store.
 */

import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import * as settingsStorage from '$lib/storage/settings';
import { StorageError } from '$lib/errors/error-types';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG, migrateImagePromptDefaults } from '$lib/types/image-config';
import type { AppSettings } from '$lib/storage/settings';
import { DEFAULT_RESPONSE_LENGTH_TIER, clampTargetImageCount } from '$lib/types/chat-settings';
import type { ModelProfile, ModelSlot } from '$lib/types/config';
import { normalizePromptBlockToggles, presetToBlocks } from '$lib/blocks/preset-migration';
import {
  createDefaultAgentPrefills,
  createDefaultAgentPromptOverrides,
  migrateAgentPromptOverrides,
} from '$lib/core/agents/prompt-defaults';
import { createPromptScriptFromPreset } from '$lib/blocks/prompt-script';

let hasLoaded = false;
let loadInFlight: Promise<void> | null = null;

function migrateLegacyModelSlots(settings: AppSettings): boolean {
  const slots = settings.modelSlots ?? {};
  const profiles = { ...(settings.modelProfiles ?? {}) } as Record<string, ModelProfile>;
  let changed = false;

  for (const [slotId, slot] of Object.entries(slots)) {
    const candidate = slot as ModelSlot;
    if (candidate.profileId || !candidate.provider || !candidate.model) {
      continue;
    }

    const migratedId = `slot-${slotId}`;
    profiles[migratedId] = {
      id: migratedId,
      name: `${slotId} (Migrated)`,
      provider: candidate.provider,
      apiKey: candidate.apiKey,
      baseUrl: candidate.baseUrl,
      model: candidate.model,
      temperature: candidate.temperature,
      maxTokens: candidate.maxTokens,
    };
    slots[slotId] = {
      ...candidate,
      profileId: migratedId,
    };
    changed = true;
  }

  if (changed) {
    settings.modelProfiles = profiles;
    settings.modelSlots = slots;
  }

  return changed;
}

export const settingsRepo = {
  /**
   * Load settings from storage and apply migrations.
   */
  async load(): Promise<void> {
    if (loadInFlight) {
      return loadInFlight;
    }

    loadInFlight = (async () => {
    try {
      const settings = await settingsStorage.loadSettings();
      const migratedLegacyModelSlots = migrateLegacyModelSlots(settings);
      let migratedPromptDefaults = false;
      
      // Migrate: add default prompt preset if not present
      if (!settings.promptPresets) {
        settings.promptPresets = createDefaultPresetSettings();
      }
      
      // Migrate: add noiseSchedule to novelai config if missing
      if (settings.imageGeneration?.novelai && !settings.imageGeneration.novelai.noiseSchedule) {
        settings.imageGeneration.novelai.noiseSchedule = 'karras';
      }

      if (migrateImagePromptDefaults(settings.imageGeneration)) {
        migratedPromptDefaults = true;
      }

      if (migrateAgentPromptOverrides(settings.agentSettings?.promptOverrides)) {
        migratedPromptDefaults = true;
      }
      
      // Migrate: update outdated system prompt and Author's Note, add missing items
      if (settings.promptPresets) {
        let migrated = false;
        const defaultAgentOverrides = createDefaultAgentPromptOverrides();
        const defaultAgentPrefills = createDefaultAgentPrefills();
        const globalAgentOverrides = {
          ...defaultAgentOverrides,
          ...(settings.agentSettings?.promptOverrides ?? {}),
        };
        const globalAgentPrefills = {
          ...defaultAgentPrefills,
          ...(settings.agentSettings?.prefills ?? {}),
        };
        const globalAgentPromptGraphs = {
          ...(settings.agentSettings?.promptGraphs ?? {}),
        };
        const defaultImagePrompts = {
          planningSystemPrompt: DEFAULT_IMAGE_CONFIG.planningSystemPrompt ?? '',
          planningPrefill: DEFAULT_IMAGE_CONFIG.planningPrefill ?? '',
          imagePromptInstructions: DEFAULT_IMAGE_CONFIG.imagePromptInstructions ?? '',
          promptPrefill: DEFAULT_IMAGE_CONFIG.promptPrefill ?? '',
          backfillSystemPrompt: DEFAULT_IMAGE_CONFIG.backfillSystemPrompt ?? '',
          backfillPrefill: DEFAULT_IMAGE_CONFIG.backfillPrefill ?? '',
        };
        const globalImagePrompts = {
          planningSystemPrompt:
            settings.imageGeneration?.planningSystemPrompt ?? defaultImagePrompts.planningSystemPrompt,
          planningPrefill:
            settings.imageGeneration?.planningPrefill ?? defaultImagePrompts.planningPrefill,
          imagePromptInstructions:
            settings.imageGeneration?.imagePromptInstructions ?? defaultImagePrompts.imagePromptInstructions,
          promptPrefill:
            settings.imageGeneration?.promptPrefill ?? defaultImagePrompts.promptPrefill,
          backfillSystemPrompt:
            settings.imageGeneration?.backfillSystemPrompt ?? defaultImagePrompts.backfillSystemPrompt,
          backfillPrefill:
            settings.imageGeneration?.backfillPrefill ?? defaultImagePrompts.backfillPrefill,
        };
        const globalImagePromptGraphs = {
          ...(settings.imageGeneration?.promptGraphs ?? {}),
        };
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

          if (!preset.blockGraph) {
            preset.blockGraph = presetToBlocks(preset);
            migrated = true;
          }

          if (!preset.promptScript) {
            preset.promptScript = createPromptScriptFromPreset(preset);
            migrated = true;
          }

          const nextAgentOverrides = {
            ...globalAgentOverrides,
            ...(preset.agentPromptOverrides ?? {}),
          };
          if (
            JSON.stringify(nextAgentOverrides) !== JSON.stringify(preset.agentPromptOverrides ?? {})
          ) {
            preset.agentPromptOverrides = nextAgentOverrides;
            migrated = true;
          }

          const nextAgentPrefills = {
            ...globalAgentPrefills,
            ...(preset.agentPrefills ?? {}),
          };
          if (
            JSON.stringify(nextAgentPrefills) !== JSON.stringify(preset.agentPrefills ?? {})
          ) {
            preset.agentPrefills = nextAgentPrefills;
            migrated = true;
          }

          if (preset.agentJailbreak === undefined) {
            preset.agentJailbreak = settings.agentSettings?.jailbreak ?? '';
            migrated = true;
          }

          const nextAgentPromptGraphs = {
            ...globalAgentPromptGraphs,
            ...(preset.agentPromptGraphs ?? {}),
          };
          if (
            JSON.stringify(nextAgentPromptGraphs) !== JSON.stringify(preset.agentPromptGraphs ?? {})
          ) {
            preset.agentPromptGraphs = nextAgentPromptGraphs;
            migrated = true;
          }

          const nextImagePrompts = {
            ...globalImagePrompts,
            ...(preset.imagePrompts ?? {}),
          };
          if (
            JSON.stringify(nextImagePrompts) !== JSON.stringify(preset.imagePrompts ?? {})
          ) {
            preset.imagePrompts = nextImagePrompts;
            migrated = true;
          }

          if (preset.imageJailbreak === undefined) {
            preset.imageJailbreak =
              settings.imageGeneration?.jailbreak ?? DEFAULT_IMAGE_CONFIG.jailbreak ?? '';
            migrated = true;
          }

          const nextImagePromptGraphs = {
            ...globalImagePromptGraphs,
            ...(preset.imagePromptGraphs ?? {}),
          };
          if (
            JSON.stringify(nextImagePromptGraphs) !== JSON.stringify(preset.imagePromptGraphs ?? {})
          ) {
            preset.imagePromptGraphs = nextImagePromptGraphs;
            migrated = true;
          }

          const normalizedToggles = normalizePromptBlockToggles(
            preset.blockToggles,
            preset.blockGraph,
          );
          if (
            JSON.stringify(normalizedToggles) !== JSON.stringify(preset.blockToggles ?? [])
          ) {
            preset.blockToggles = normalizedToggles;
            migrated = true;
          }
        }
        if (migrated || migratedLegacyModelSlots || migratedPromptDefaults) {
          await settingsStorage.saveSettings(settings);
        }
      } else if (migratedLegacyModelSlots || migratedPromptDefaults) {
        await settingsStorage.saveSettings(settings);
      }
      
      // Ensure all required fields exist
      if (!settings.modelProfiles) {
        settings.modelProfiles = {};
      }
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
      if (settings.responseLengthTier === undefined) {
        settings.responseLengthTier = DEFAULT_RESPONSE_LENGTH_TIER;
      }
      if (settings.imageGeneration) {
        settings.imageGeneration.targetImageCount = clampTargetImageCount(
          settings.imageGeneration.targetImageCount,
          settings.responseLengthTier,
        );
      }
      
      settingsStore.set(settings);
      hasLoaded = true;
    } catch (error) {
      throw new StorageError(
        'loadSettings',
        'Failed to load settings',
        error as Error
      );
    } finally {
      loadInFlight = null;
    }
    })();

    return loadInFlight;
  },

  async ensureLoaded(): Promise<void> {
    if (hasLoaded) {
      return;
    }
    await this.load();
  },

  /**
   * Save current settings to storage.
   */
  async save(): Promise<void> {
    try {
      const state = get(settingsStore);
      await settingsStorage.saveSettings(state);
      hasLoaded = true;
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
