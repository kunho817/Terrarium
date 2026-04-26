import type {
  AgentPromptOverrideSettings,
  AgentPromptPrefillSettings,
} from '$lib/types/config';
import {
  DEFAULT_AGENT_PROMPTS,
  createDefaultAgentPrefills,
  createDefaultAgentPromptOverrides,
} from './prompt-defaults';
import {
  getActiveAgentPrefills,
  getActiveAgentPromptOverrides,
} from '$lib/core/presets/active-preset';

const AGENT_PROMPT_OVERRIDE_MAP: Record<string, keyof AgentPromptOverrideSettings> = {
  EXTRACTION_SYSTEM: 'extractionSystem',
  EXTRACTION_WORLD_SYSTEM: 'extractionWorldSystem',
  EXTRACTION_FALLBACK_SYSTEM: 'extractionFallbackSystem',
  EXTRACTION_REPAIR_SYSTEM: 'extractionRepairSystem',
  STORY_AUTHOR_SYSTEM: 'storyAuthorSystem',
  DIRECTOR_SYSTEM: 'directorSystem',
  TURN_MAINTENANCE_SYSTEM: 'turnMaintenanceSystem',
  SECTION_WORLD_SYSTEM: 'sectionWorldSystem',
};

function getPromptOverride(key: string): string | undefined {
  const mappedKey = AGENT_PROMPT_OVERRIDE_MAP[key];
  if (!mappedKey) {
    return undefined;
  }

  const configured = getActiveAgentPromptOverrides()[mappedKey]?.trim();
  return configured || undefined;
}

export function getAgentPrefill(key: keyof AgentPromptPrefillSettings): string {
  return getActiveAgentPrefills()[key]?.trim() ?? '';
}

export const PROMPTS = Object.freeze({
  get: (key: string): string => getPromptOverride(key) || DEFAULT_AGENT_PROMPTS[key] || '',
  build: (key: string, vars: Record<string, string> = {}): string => {
    let template = String((getPromptOverride(key) || DEFAULT_AGENT_PROMPTS[key]) ?? '');
    if (!template) return '';
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(v ?? ''));
    }
    return template;
  },
  keys: (): string[] => Object.keys(DEFAULT_AGENT_PROMPTS),
});

export {
  DEFAULT_AGENT_PROMPTS,
  createDefaultAgentPrefills,
  createDefaultAgentPromptOverrides,
};
