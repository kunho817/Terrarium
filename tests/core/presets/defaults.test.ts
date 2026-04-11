import { describe, it, expect } from 'vitest';
import { createDefaultPreset, createDefaultPresetSettings } from '$lib/core/presets/defaults';

describe('createDefaultPreset', () => {
  const preset = createDefaultPreset();

  it('returns a preset with exactly 15 items', () => {
    expect(preset.items).toHaveLength(15);
  });

  it('has correct types in order', () => {
    const types = preset.items.map((item) => item.type);
    expect(types).toEqual([
      'system',
      'lorebook',
      'lorebook',
      'persona',
      'description',
      'personality',
      'scenario',
      'exampleMessages',
      'lorebook',
      'chatHistory',
      'lorebook',
      'postHistoryInstructions',
      'lorebook',
      'jailbreak',
      'prefill',
    ]);
  });

  it('has correct names in order', () => {
    const names = preset.items.map((item) => item.name);
    expect(names).toEqual([
      'System Prompt',
      'Lorebook (Before Char)',
      'Lorebook (Before Scenario)',
      'User Persona',
      'Description',
      'Personality',
      'Scenario',
      'Example Messages',
      'Lorebook (After Char)',
      'Chat History',
      'Lorebook (After Messages)',
      "Author's Note",
      'Lorebook (Author Note)',
      'Jailbreak',
      'Assistant Prefill',
    ]);
  });

  it('has correct roles for all items', () => {
    for (const item of preset.items) {
      if (item.type === 'prefill') {
        expect(item.role).toBe('assistant');
      } else {
        expect(item.role).toBe('system');
      }
    }
  });

  it('has jailbreak (item 14) disabled', () => {
    const jailbreak = preset.items[13];
    expect(jailbreak.type).toBe('jailbreak');
    expect(jailbreak.enabled).toBe(false);
  });

  it('has prefill (item 15) disabled', () => {
    const prefill = preset.items[14];
    expect(prefill.type).toBe('prefill');
    expect(prefill.enabled).toBe(false);
  });

  it('has all items except jailbreak and prefill enabled', () => {
    for (let i = 0; i < preset.items.length; i++) {
      if (i === 13 || i === 14) continue; // jailbreak, prefill
      expect(preset.items[i].enabled, `item ${i} (${preset.items[i].name}) should be enabled`).toBe(true);
    }
  });

  it('has correct lorebookPosition values on lorebook items', () => {
    const lorebookItems = preset.items.filter((item) => item.type === 'lorebook');
    const positions = lorebookItems.map((item) => item.lorebookPosition);
    expect(positions).toEqual([
      'before_char',
      'before_scenario',
      'after_char',
      'after_messages',
      'author_note',
    ]);
  });

  it('non-lorebook items have no lorebookPosition', () => {
    for (const item of preset.items) {
      if (item.type !== 'lorebook') {
        expect(item.lorebookPosition).toBeUndefined();
      }
    }
  });

  it('Personality item has bracketed label format', () => {
    const personality = preset.items.find((item) => item.type === 'personality');
    expect(personality).toBeDefined();
    expect(personality!.content).toBe("[{{char}}'s Personality]\n{{slot}}");
  });

  it('Scenario item has bracketed label format', () => {
    const scenario = preset.items.find((item) => item.type === 'scenario');
    expect(scenario).toBeDefined();
    expect(scenario!.content).toBe('[Scenario]\n{{slot}}');
  });

  it('System Prompt has roleplay instructions', () => {
    const sys = preset.items.find((item) => item.type === 'system');
    expect(sys).toBeDefined();
    expect(sys!.content).toContain('{{user}}');
    expect(sys!.content).toContain('roleplay');
  });

  it('Author\'s Note has style instruction', () => {
    const note = preset.items.find((item) => item.type === 'postHistoryInstructions');
    expect(note).toBeDefined();
    expect(note!.content).toContain('Style');
  });

  it('Jailbreak has content but is disabled', () => {
    const jailbreak = preset.items.find((item) => item.type === 'jailbreak');
    expect(jailbreak).toBeDefined();
    expect(jailbreak!.enabled).toBe(false);
    expect(jailbreak!.content.length).toBeGreaterThan(0);
  });

  it('has unique IDs for every item', () => {
    const ids = preset.items.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('assistantPrefill is empty string', () => {
    expect(preset.assistantPrefill).toBe('');
  });
});

describe('createDefaultPresetSettings', () => {
  it('wraps the default preset with matching activePresetId', () => {
    const settings = createDefaultPresetSettings();
    expect(settings.presets).toHaveLength(1);
    expect(settings.activePresetId).toBe(settings.presets[0].id);
  });
});
