/**
 * Default prompt preset — mirrors the assembly order of assemblePromptMessages()
 * in pipeline.ts so that migrating to the preset system produces identical output.
 */

import type { PromptItem, PromptPreset, PromptPresetSettings } from '$lib/types/prompt-preset';

function uid(): string {
  return crypto.randomUUID();
}

export function createDefaultPreset(): PromptPreset {
  const presetId = uid();

  const items: PromptItem[] = [
    {
      id: uid(),
      type: 'system',
      name: 'System Prompt',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'lorebook',
      name: 'Lorebook (Before Char)',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'before_char',
    },
    {
      id: uid(),
      type: 'lorebook',
      name: 'Lorebook (Before Scenario)',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'before_scenario',
    },
    {
      id: uid(),
      type: 'description',
      name: 'Description',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'personality',
      name: 'Personality',
      enabled: true,
      role: 'system',
      content: 'Personality: {{slot}}',
    },
    {
      id: uid(),
      type: 'scenario',
      name: 'Scenario',
      enabled: true,
      role: 'system',
      content: 'Scenario: {{slot}}',
    },
    {
      id: uid(),
      type: 'exampleMessages',
      name: 'Example Messages',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'lorebook',
      name: 'Lorebook (After Char)',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'after_char',
    },
    {
      id: uid(),
      type: 'chatHistory',
      name: 'Chat History',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'lorebook',
      name: 'Lorebook (After Messages)',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'after_messages',
    },
    {
      id: uid(),
      type: 'postHistoryInstructions',
      name: "Author's Note",
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'lorebook',
      name: 'Lorebook (Author Note)',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'author_note',
    },
    {
      id: uid(),
      type: 'jailbreak',
      name: 'Jailbreak',
      enabled: false,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'prefill',
      name: 'Assistant Prefill',
      enabled: false,
      role: 'assistant',
      content: '',
    },
  ];

  return {
    id: presetId,
    name: 'Default',
    items,
    assistantPrefill: '',
  };
}

export function createDefaultPresetSettings(): PromptPresetSettings {
  const preset = createDefaultPreset();
  return {
    presets: [preset],
    activePresetId: preset.id,
  };
}
