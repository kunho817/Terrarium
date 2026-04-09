import { describe, it, expect } from 'vitest';
import { assemblePromptMessages, parseExampleMessages, groupLoreByPosition } from '$lib/core/chat/pipeline';
import type { Message, LorebookEntry, CharacterCard } from '$lib/types';

function makeMessage(role: 'user' | 'assistant' | 'system', content: string): Message {
  return { role, content, type: role === 'system' ? 'system' : 'dialogue', timestamp: 1000 };
}

function makeLoreEntry(position: 'before_char' | 'after_char' | 'before_scenario' | 'after_messages' | 'author_note', content: string, priority = 0): LorebookEntry {
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

describe('parseExampleMessages', () => {
  it('parses user/char pairs', () => {
    const raw = '<START>\n{{user}}: Hello\n{{char}}: Hi there!';
    const msgs = parseExampleMessages(raw);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('Hello');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toBe('Hi there!');
  });

  it('parses multiple blocks', () => {
    const raw = '<START>\n{{user}}: Hi\n{{char}}: Hey\n<START>\n{{user}}: Bye\n{{char}}: See you';
    const msgs = parseExampleMessages(raw);
    expect(msgs).toHaveLength(4);
    expect(msgs[2].content).toBe('Bye');
    expect(msgs[3].content).toBe('See you');
  });

  it('returns empty for empty string', () => {
    expect(parseExampleMessages('')).toEqual([]);
    expect(parseExampleMessages('   ')).toEqual([]);
  });

  it('skips lines without role prefix', () => {
    const raw = '<START>\nJust a narrative line\n{{user}}: Hello';
    const msgs = parseExampleMessages(raw);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
  });
});

describe('groupLoreByPosition', () => {
  it('groups entries by position', () => {
    const entries = [
      makeLoreEntry('before_char', 'Lore A'),
      makeLoreEntry('after_char', 'Lore B'),
      makeLoreEntry('before_char', 'Lore C'),
    ];
    const groups = groupLoreByPosition(entries);
    expect(groups.get('before_char')).toBe('Lore A\n\nLore C');
    expect(groups.get('after_char')).toBe('Lore B');
    expect(groups.has('after_messages')).toBe(false);
  });
});

describe('assemblePromptMessages', () => {
  it('starts with system prompt', () => {
    const messages = [makeMessage('user', 'Hello')];
    const result = assemblePromptMessages('You are Alice.', messages, [], baseCard);

    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('You are Alice.');
  });

  it('includes message history after system prompt', () => {
    const messages = [
      makeMessage('user', 'Hello'),
      makeMessage('assistant', 'Hi there!'),
    ];
    const result = assemblePromptMessages('System prompt', messages, [], baseCard);

    const contents = result.map((m) => m.content);
    expect(contents).toContain('Hello');
    expect(contents).toContain('Hi there!');
    // System prompt first
    expect(result[0].content).toBe('System prompt');
  });

  it('injects lorebook entries at correct positions', () => {
    const messages = [makeMessage('user', 'Hello')];
    const lore = [
      makeLoreEntry('before_char', 'Before char lore'),
      makeLoreEntry('after_char', 'After char lore'),
      makeLoreEntry('after_messages', 'After messages lore'),
    ];
    const result = assemblePromptMessages('System', messages, lore, baseCard);
    const contents = result.map((m) => m.content);

    expect(contents).toContain('Before char lore');
    expect(contents).toContain('After char lore');
    expect(contents).toContain('After messages lore');

    // Verify order
    const beforeIdx = contents.indexOf('Before char lore');
    const afterIdx = contents.indexOf('After char lore');
    const afterMsgIdx = contents.indexOf('After messages lore');
    expect(beforeIdx).toBeLessThan(afterIdx);
    expect(afterIdx).toBeLessThan(afterMsgIdx);
  });

  it('parses and injects example messages', () => {
    const card = {
      ...baseCard,
      exampleMessages: '<START>\n{{user}}: Hi\n{{char}}: Hey!',
    };
    const result = assemblePromptMessages('System', [], [], card);
    const contents = result.map((m) => m.content);

    expect(contents).toContain('Hi');
    expect(contents).toContain('Hey!');
  });

  it('injects depth prompt at correct depth', () => {
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
    const result = assemblePromptMessages('System', messages, [], card);
    const contents = result.map((m) => m.content);

    const depthIdx = contents.indexOf('Secret: Alice is royalty');
    expect(depthIdx).toBeGreaterThan(0);

    // Depth 2 from end = before last 2 messages
    const msg3Idx = contents.indexOf('msg3');
    expect(depthIdx).toBeLessThan(msg3Idx);
  });

  it('appends postHistoryInstructions after messages', () => {
    const card = { ...baseCard, postHistoryInstructions: 'Stay in character!' };
    const messages = [makeMessage('user', 'Hello')];
    const result = assemblePromptMessages('System', messages, [], card);

    const lastSystem = result.filter((m) => m.role === 'system').at(-1);
    expect(lastSystem?.content).toBe('Stay in character!');
  });

  it('injects author_note lorebook after postHistoryInstructions', () => {
    const card = { ...baseCard, postHistoryInstructions: 'Stay in character!' };
    const messages = [makeMessage('user', 'Hello')];
    const lore = [makeLoreEntry('author_note', 'Author note lore')];
    const result = assemblePromptMessages('System', messages, lore, card);

    const contents = result.map((m) => m.content);
    const phiIdx = contents.indexOf('Stay in character!');
    const noteIdx = contents.indexOf('Author note lore');
    expect(phiIdx).toBeLessThan(noteIdx);
  });

  it('handles empty messages array', () => {
    const result = assemblePromptMessages('System', [], [], baseCard);
    expect(result[0].content).toBe('System');
  });

  it('handles depth > message count (inserts at beginning of history)', () => {
    const card = {
      ...baseCard,
      depthPrompt: { depth: 100, prompt: 'Deep insertion' },
    };
    const messages = [makeMessage('user', 'Hello')];
    const result = assemblePromptMessages('System', messages, [], card);
    const contents = result.map((m) => m.content);

    // Depth prompt should be before 'Hello' in the history section
    const depthIdx = contents.indexOf('Deep insertion');
    const helloIdx = contents.indexOf('Hello');
    expect(depthIdx).toBeGreaterThan(0); // After system prompt
    expect(depthIdx).toBeLessThan(helloIdx);
  });
});
