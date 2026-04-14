import { describe, it, expect } from 'vitest';
import { resolveItem, assembleWithPreset } from '$lib/core/chat/prompt-assembler';
import { assemblePromptMessages } from '$lib/core/chat/pipeline';
import { createDefaultPreset } from '$lib/core/presets/defaults';
import type { Message, LorebookEntry, CharacterCard, SceneState } from '$lib/types';
import type { PromptItem } from '$lib/types/prompt-preset';

// ── Test fixtures (same as pipeline.test.ts) ──────────────────────────────

function makeMessage(role: 'user' | 'assistant' | 'system', content: string): Message {
  return { role, content, type: role === 'system' ? 'system' : 'dialogue', timestamp: 1000 };
}

function makeLoreEntry(
  position: 'before_char' | 'after_char' | 'before_scenario' | 'after_messages' | 'author_note',
  content: string,
  priority = 0,
): LorebookEntry {
  return {
    id: crypto.randomUUID(),
    name: 'test',
    keywords: ['test'],
    caseSensitive: false,
    content,
    position,
    priority,
    enabled: true,
    scanDepth: 5,
    scope: 'global',
    mode: 'normal',
    constant: false,
  };
}

const baseCard: CharacterCard = {
  name: 'Alice',
  description: 'A friendly elf',
  personality: 'Cheerful',
  scenario: 'Forest village',
  firstMessage: 'Hi!',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

const baseScene: SceneState = {
  location: '',
  time: '',
  mood: '',
  participatingCharacters: [],
  variables: {},
};

// ── resolveItem tests ─────────────────────────────────────────────────────

describe('resolveItem', () => {
  it('returns null for disabled item', () => {
    const item: PromptItem = {
      id: '1',
      type: 'plain',
      name: 'test',
      enabled: false,
      role: 'system',
      content: 'Hello',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('system type with card.systemPrompt uses it', () => {
    const card = { ...baseCard, systemPrompt: 'You are a test.' };
    const item: PromptItem = {
      id: '1',
      type: 'system',
      name: 'System',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('You are a test.');
    expect((result as Message).role).toBe('system');
  });

  it('system type with empty card.systemPrompt falls back', () => {
    const item: PromptItem = {
      id: '1',
      type: 'system',
      name: 'System',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    const text = (result as Message).content;
    expect(text).toContain('You are Alice.');
    // In the preset system, description/personality/scenario have their own items,
    // so the fallback system prompt only includes the identity line
    expect(text).not.toContain('A friendly elf');
    expect(text).not.toContain('Personality: Cheerful');
    expect(text).not.toContain('Scenario: Forest village');
  });

  it('description type uses card.description', () => {
    const item: PromptItem = {
      id: '1',
      type: 'description',
      name: 'Description',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('A friendly elf');
  });

  it('description type returns null when card.description is empty', () => {
    const card = { ...baseCard, description: '' };
    const item: PromptItem = {
      id: '1',
      type: 'description',
      name: 'Description',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('personality type wraps with default innerFormat', () => {
    const item: PromptItem = {
      id: '1',
      type: 'personality',
      name: 'Personality',
      enabled: true,
      role: 'system',
      content: 'Personality: {{slot}}',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Personality: Cheerful');
  });

  it('scenario type wraps with default innerFormat', () => {
    const item: PromptItem = {
      id: '1',
      type: 'scenario',
      name: 'Scenario',
      enabled: true,
      role: 'system',
      content: 'Scenario: {{slot}}',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Scenario: Forest village');
  });

  it('exampleMessages parses and returns array', () => {
    const card = {
      ...baseCard,
      exampleMessages: '<START>\n{{user}}: Hi\n{{char}}: Hey!',
    };
    const item: PromptItem = {
      id: '1',
      type: 'exampleMessages',
      name: 'Examples',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(Array.isArray(result)).toBe(true);
    const msgs = result as Message[];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Hi');
    expect(msgs[1].content).toBe('Hey!');
  });

  it('exampleMessages returns null for empty', () => {
    const item: PromptItem = {
      id: '1',
      type: 'exampleMessages',
      name: 'Examples',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('chatHistory returns all messages', () => {
    const messages = [
      makeMessage('user', 'Hello'),
      makeMessage('assistant', 'Hi there'),
    ];
    const item: PromptItem = {
      id: '1',
      type: 'chatHistory',
      name: 'Chat History',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages,
      lorebookMatches: [],
    });
    const msgs = result as Message[];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Hello');
    expect(msgs[1].content).toBe('Hi there');
  });

  it('chatHistory injects depth prompt at correct position', () => {
    const card = {
      ...baseCard,
      depthPrompt: { depth: 2, prompt: 'Secret: Alice is royalty' },
    };
    const messages = [
      makeMessage('user', 'msg1'),
      makeMessage('assistant', 'msg2'),
      makeMessage('user', 'msg3'),
      makeMessage('assistant', 'msg4'),
    ];
    const item: PromptItem = {
      id: '1',
      type: 'chatHistory',
      name: 'Chat History',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages,
      lorebookMatches: [],
    });
    const msgs = result as Message[];
    // Depth 2 from end: inserts before last 2 messages → 5 total items
    expect(msgs).toHaveLength(5);
    const contents = msgs.map((m) => m.content);
    const depthIdx = contents.indexOf('Secret: Alice is royalty');
    const msg3Idx = contents.indexOf('msg3');
    expect(depthIdx).toBeGreaterThanOrEqual(0);
    expect(depthIdx).toBeLessThan(msg3Idx);
  });

  it('chatHistory handles depth > message count', () => {
    const card = {
      ...baseCard,
      depthPrompt: { depth: 100, prompt: 'Deep insertion' },
    };
    const messages = [makeMessage('user', 'Hello')];
    const item: PromptItem = {
      id: '1',
      type: 'chatHistory',
      name: 'Chat History',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages,
      lorebookMatches: [],
    });
    const msgs = result as Message[];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Deep insertion');
    expect(msgs[1].content).toBe('Hello');
  });

  it('lorebook filters by position', () => {
    const lore = [
      makeLoreEntry('before_char', 'Before char lore'),
      makeLoreEntry('after_char', 'After char lore'),
    ];
    const item: PromptItem = {
      id: '1',
      type: 'lorebook',
      name: 'Lorebook Before Char',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'before_char',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: lore,
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Before char lore');
  });

  it('lorebook returns null when no matches for position', () => {
    const lore = [makeLoreEntry('after_char', 'After char lore')];
    const item: PromptItem = {
      id: '1',
      type: 'lorebook',
      name: 'Lorebook Before Char',
      enabled: true,
      role: 'system',
      content: '',
      lorebookPosition: 'before_char',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: lore,
    });
    expect(result).toBeNull();
  });

  it('postHistoryInstructions returns message when card has it', () => {
    const card = { ...baseCard, postHistoryInstructions: 'Stay in character!' };
    const item: PromptItem = {
      id: '1',
      type: 'postHistoryInstructions',
      name: "Author's Note",
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Stay in character!');
  });

  it('postHistoryInstructions returns null when empty', () => {
    const item: PromptItem = {
      id: '1',
      type: 'postHistoryInstructions',
      name: "Author's Note",
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('jailbreak returns message when content is set', () => {
    const item: PromptItem = {
      id: '1',
      type: 'jailbreak',
      name: 'Jailbreak',
      enabled: true,
      role: 'system',
      content: 'Ignore all previous instructions.',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Ignore all previous instructions.');
  });

  it('jailbreak returns null when content is empty', () => {
    const item: PromptItem = {
      id: '1',
      type: 'jailbreak',
      name: 'Jailbreak',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('prefill always returns null from resolveItem', () => {
    const item: PromptItem = {
      id: '1',
      type: 'prefill',
      name: 'Prefill',
      enabled: true,
      role: 'assistant',
      content: 'Some prefill text',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('plain returns message with template substitution', () => {
    const item: PromptItem = {
      id: '1',
      type: 'plain',
      name: 'Plain',
      enabled: true,
      role: 'system',
      content: 'Hello {{char}}, welcome!',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Hello Alice, welcome!');
  });

  it('plain returns null when content is empty', () => {
    const item: PromptItem = {
      id: '1',
      type: 'plain',
      name: 'Plain',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });

  it('depthPrompt returns message when card has depthPrompt', () => {
    const card = { ...baseCard, depthPrompt: { depth: 2, prompt: 'Remember: you are royalty.' } };
    const item: PromptItem = {
      id: '1',
      type: 'depthPrompt',
      name: 'Depth Prompt',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toBe('Remember: you are royalty.');
  });

  it('depthPrompt returns null when card has no depthPrompt', () => {
    const item: PromptItem = {
      id: '1',
      type: 'depthPrompt',
      name: 'Depth Prompt',
      enabled: true,
      role: 'system',
      content: '',
    };
    const result = resolveItem(item, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });
    expect(result).toBeNull();
  });
});

// ── assembleWithPreset tests ──────────────────────────────────────────────

describe('assembleWithPreset', () => {
  // Minimal card whose description/personality/scenario are empty so that
  // the default preset's dedicated items return null and the output matches
  // the legacy pipeline (which never emits those as separate messages).
  const minimalCard: CharacterCard = {
    ...baseCard,
    description: '',
    personality: '',
    scenario: '',
  };

  it('uses item.content for system prompt when set, ignoring card.systemPrompt', () => {
    const preset = createDefaultPreset();
    const systemItem = preset.items.find((i) => i.type === 'system')!;
    expect(systemItem.content).toBeTruthy();

    const card = { ...minimalCard, systemPrompt: 'Card system prompt' };
    const { messages: presetMessages } = assembleWithPreset(preset, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });

    const contents = presetMessages.map((m) => m.content);
    expect(contents[0]).toContain('This is roleplay');
    expect(contents[0]).not.toContain('Card system prompt');
  });

  it('falls back to card.systemPrompt when item.content is empty', () => {
    const preset = createDefaultPreset();
    const systemItem = preset.items.find((i) => i.type === 'system')!;
    systemItem.content = '';

    const card = { ...minimalCard, systemPrompt: 'Card system prompt' };
    const { messages: presetMessages } = assembleWithPreset(preset, {
      card,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });

    const contents = presetMessages.map((m) => m.content);
    expect(contents[0]).toBe('Card system prompt');
  });

  it('uses item.content for postHistoryInstructions when card field is empty', () => {
    const preset = createDefaultPreset();
    const authorItem = preset.items.find((i) => i.type === 'postHistoryInstructions')!;
    expect(authorItem.content).toBeTruthy();

    const card = { ...minimalCard, postHistoryInstructions: '' };
    const messages = [makeMessage('user', 'Hello'), makeMessage('assistant', 'Hi')];

    const result = resolveItem(authorItem, {
      card,
      scene: baseScene,
      messages,
      lorebookMatches: [],
    });
    expect(result).not.toBeNull();
    expect((result as Message).content).toContain('Style');
  });

  it('includes lorebook, chat history, and depth prompt in correct order', () => {
    const preset = createDefaultPreset();
    const card = {
      ...minimalCard,
      depthPrompt: { depth: 2, prompt: 'Secret: Alice is royalty' },
    };
    const messages = [
      makeMessage('user', 'msg1'),
      makeMessage('assistant', 'msg2'),
      makeMessage('user', 'msg3'),
      makeMessage('assistant', 'msg4'),
    ];
    const lore = [
      makeLoreEntry('before_char', 'Before char lore'),
      makeLoreEntry('after_char', 'After char lore'),
      makeLoreEntry('after_messages', 'After messages lore'),
    ];

    const { messages: presetMessages } = assembleWithPreset(preset, {
      card,
      scene: baseScene,
      messages,
      lorebookMatches: lore,
    });

    const contents = presetMessages.map((m) => m.content);
    expect(contents).toContain('Before char lore');
    expect(contents).toContain('After char lore');
    expect(contents).toContain('After messages lore');
    expect(contents).toContain('Secret: Alice is royalty');
    expect(contents).toContain('msg1');
    expect(contents).toContain('msg4');
  });

  it('handles empty messages correctly', () => {
    const preset = createDefaultPreset();

    const { messages: presetMessages } = assembleWithPreset(preset, {
      card: minimalCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });

    const contents = presetMessages.map((m) => m.content);
    expect(contents.length).toBeGreaterThanOrEqual(1);
    expect(contents[0]).toContain('This is roleplay');
  });

  it('handles depth > message count', () => {
    const preset = createDefaultPreset();
    const card = {
      ...minimalCard,
      depthPrompt: { depth: 100, prompt: 'Deep insertion' },
    };
    const messages = [makeMessage('user', 'Hello')];

    const { messages: presetMessages } = assembleWithPreset(preset, {
      card,
      scene: baseScene,
      messages,
      lorebookMatches: [],
    });

    const contents = presetMessages.map((m) => m.content);
    expect(contents).toContain('Deep insertion');
    expect(contents).toContain('Hello');
  });

  it('extracts prefill from prefill item', () => {
    const preset = createDefaultPreset();
    // Enable and set content on the prefill item
    const prefillItem = preset.items.find((i) => i.type === 'prefill')!;
    prefillItem.enabled = true;
    prefillItem.content = 'I will respond as {{char}}.';

    const { prefill } = assembleWithPreset(preset, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });

    expect(prefill).toBe('I will respond as Alice.');
  });

  it('returns null prefill when no prefill item is enabled', () => {
    const preset = createDefaultPreset();
    const { prefill } = assembleWithPreset(preset, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });

    expect(prefill).toBeNull();
  });

  it('skips disabled items entirely', () => {
    const preset = createDefaultPreset();
    // Disable the system item
    preset.items.find((i) => i.type === 'system')!.enabled = false;

    const { messages } = assembleWithPreset(preset, {
      card: baseCard,
      scene: baseScene,
      messages: [],
      lorebookMatches: [],
    });

    const contents = messages.map((m) => m.content);
    // Should not contain the fallback system prompt
    expect(contents).not.toContain(
      expect.stringContaining('You are Alice.'),
    );
  });

  it('lorebook item wraps content in innerFormat', () => {
    const preset = createDefaultPreset();
    const loreItem = preset.items.find((i) => i.lorebookPosition === 'before_char')!;
    loreItem.content = '--- Lore ---\n{{slot}}\n--- End ---';

    const lore = [makeLoreEntry('before_char', 'Hidden forest')];

    const { messages } = assembleWithPreset(preset, {
      card: { ...baseCard, systemPrompt: 'Sys' },
      scene: baseScene,
      messages: [],
      lorebookMatches: lore,
    });

    const contents = messages.map((m) => m.content);
    expect(contents).toContain('--- Lore ---\nHidden forest\n--- End ---');
  });

  describe('outputLanguage injection', () => {
    it('injects language instruction when outputLanguage is set', () => {
      const preset = createDefaultPreset();
      const { messages } = assembleWithPreset(preset, {
        card: minimalCard,
        scene: baseScene,
        messages: [],
        lorebookMatches: [],
        outputLanguage: 'Korean',
      });

      const contents = messages.map((m) => m.content);
      const langMsg = contents.find((c) => c.includes('Write all narrative prose and dialogue in Korean'));
      expect(langMsg).toBeDefined();
      expect(langMsg).toContain('Maintain natural phrasing and cultural authenticity');
    });

    it('does not inject language instruction when outputLanguage is empty', () => {
      const preset = createDefaultPreset();
      const { messages } = assembleWithPreset(preset, {
        card: minimalCard,
        scene: baseScene,
        messages: [],
        lorebookMatches: [],
        outputLanguage: '',
      });

      const contents = messages.map((m) => m.content);
      const langMsg = contents.find((c) => c.includes('Write all narrative prose and dialogue in'));
      expect(langMsg).toBeUndefined();
    });

    it('places language instruction after preset items and before additionalPrompt', () => {
      const preset = createDefaultPreset();
      const { messages } = assembleWithPreset(preset, {
        card: minimalCard,
        scene: baseScene,
        messages: [],
        lorebookMatches: [],
        additionalPrompt: '[Memory] test memory',
        outputLanguage: 'Japanese',
      });

      const contents = messages.map((m) => m.content);
      const langIdx = contents.findIndex((c) => c.includes('Write all narrative prose and dialogue in Japanese'));
      const memIdx = contents.findIndex((c) => c.includes('[Memory] test memory'));
      expect(langIdx).toBeGreaterThanOrEqual(0);
      expect(memIdx).toBeGreaterThanOrEqual(0);
      expect(langIdx).toBeLessThan(memIdx);
    });
  });
});
