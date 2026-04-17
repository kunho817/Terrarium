import { describe, it, expect } from 'vitest';
import { defaultPromptBuilder } from '$lib/plugins/prompt-builder/default';
import type { CharacterCard, SceneState, Message } from '$lib/types';

const mockCard: CharacterCard = {
  name: 'Alice',
  description: 'A friendly elf from the forest',
  personality: 'Cheerful, curious',
  scenario: 'Alice is visiting the human village.',
  firstMessage: 'Hi there!',
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

const mockScene: SceneState = {
  location: 'Forest Village',
  time: 'Dusk',
  mood: 'Peaceful',
  participatingCharacters: ['alice-id'],
  variables: {},
  environmentalNotes: '',
  lastUpdated: 0,
};

const mockMessages: Message[] = [
  { role: 'user', content: 'Hello Alice', type: 'dialogue', timestamp: 1000 },
  { role: 'assistant', content: 'Hi! Welcome to the village!', type: 'dialogue', timestamp: 2000 },
  { role: 'narrator', content: 'The sun began to set.', type: 'narrator', timestamp: 3000 },
];

describe('Default Prompt Builder', () => {
  describe('properties', () => {
    it('has correct id and name', () => {
      expect(defaultPromptBuilder.id).toBe('default');
      expect(defaultPromptBuilder.name).toBe('Default');
    });
  });

  describe('buildSystemPrompt', () => {
    it('builds system prompt from card fields when no custom systemPrompt', () => {
      const prompt = defaultPromptBuilder.buildSystemPrompt(mockCard, mockScene);

      expect(prompt).toContain('Alice');
      expect(prompt).toContain('A friendly elf from the forest');
      expect(prompt).toContain('Cheerful, curious');
      expect(prompt).toContain('Alice is visiting the human village.');
    });

    it('includes scene state in system prompt', () => {
      const prompt = defaultPromptBuilder.buildSystemPrompt(mockCard, mockScene);

      expect(prompt).toContain('Forest Village');
      expect(prompt).toContain('Dusk');
      expect(prompt).toContain('Peaceful');
    });

    it('uses custom systemPrompt when set', () => {
      const card = { ...mockCard, systemPrompt: 'You are {{char}}, a brave warrior.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);

      expect(prompt).toBe('You are Alice, a brave warrior.');
    });

    it('substitutes {{char}} template variable', () => {
      const card = { ...mockCard, systemPrompt: '{{char}} is here.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Alice is here.');
    });

    it('substitutes {{user}} template variable', () => {
      const card = { ...mockCard, systemPrompt: 'Talk to {{user}}.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Talk to User.');
    });

    it('substitutes {{char.name}} template variable', () => {
      const card = { ...mockCard, systemPrompt: '{{char.name}} approaches.' };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Alice approaches.');
    });

    it('substitutes scene template variables', () => {
      const card = {
        ...mockCard,
        systemPrompt: 'Location: {{scene.location}}, Time: {{scene.time}}, Mood: {{scene.mood}}.',
      };
      const prompt = defaultPromptBuilder.buildSystemPrompt(card, mockScene);
      expect(prompt).toBe('Location: Forest Village, Time: Dusk, Mood: Peaceful.');
    });

    it('handles empty scene gracefully', () => {
      const emptyScene: SceneState = {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
        environmentalNotes: '',
        lastUpdated: 0,
      };
      const prompt = defaultPromptBuilder.buildSystemPrompt(mockCard, emptyScene);

      expect(prompt).toContain('Alice');
      expect(prompt).not.toContain('Current location:');
    });
  });

  describe('buildContext', () => {
    it('formats messages with role labels', () => {
      const context = defaultPromptBuilder.buildContext(mockMessages, mockScene);

      expect(context).toContain('User: Hello Alice');
      expect(context).toContain('Assistant: Hi! Welcome to the village!');
    });

    it('formats narrator messages with italics', () => {
      const context = defaultPromptBuilder.buildContext(mockMessages, mockScene);
      expect(context).toContain('*The sun began to set.*');
    });

    it('includes scene info at the top when present', () => {
      const context = defaultPromptBuilder.buildContext(mockMessages, mockScene);
      expect(context).toContain('[Scene: Forest Village, Dusk, Peaceful]');
    });

    it('omits scene info when empty', () => {
      const emptyScene: SceneState = {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
        environmentalNotes: '',
        lastUpdated: 0,
      };
      const context = defaultPromptBuilder.buildContext(mockMessages, emptyScene);
      expect(context).not.toContain('[Scene:');
    });

    it('handles empty messages', () => {
      const context = defaultPromptBuilder.buildContext([], mockScene);
      expect(context).toContain('[Scene:');
    });

    it('substitutes scene template variables in message content', () => {
      const messages: Message[] = [
        { role: 'user', content: 'At {{scene.location}}', type: 'dialogue', timestamp: 1000 },
      ];
      const context = defaultPromptBuilder.buildContext(messages, mockScene);
      expect(context).toContain('At Forest Village');
    });
  });
});

describe('buildSystemPrompt — variable substitution', () => {
  const cardWithVars: CharacterCard = {
    ...mockCard,
    systemPrompt: 'HP: {{var.player.hp}}, Location: {{var.location}}, Name: {{var.name}}',
  };
  const sceneWithVars: SceneState = {
    ...mockScene,
    variables: {
      'player.hp': 85,
      location: 'dark_forest',
      name: 'Alice',
      active: true,
    },
  };

  it('substitutes {{var.key}} with variable values', () => {
    const prompt = defaultPromptBuilder.buildSystemPrompt(cardWithVars, sceneWithVars);
    expect(prompt).toBe('HP: 85, Location: dark_forest, Name: Alice');
  });

  it('replaces unknown variable with empty string', () => {
    const card = { ...mockCard, systemPrompt: 'Value: {{var.unknown_key}}' };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, { ...mockScene, variables: {} });
    expect(prompt).toBe('Value: ');
  });

  it('handles boolean variable values', () => {
    const card = { ...mockCard, systemPrompt: 'Active: {{var.active}}' };
    const scene = { ...mockScene, variables: { active: true } };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, scene);
    expect(prompt).toBe('Active: true');
  });

  it('handles empty variables object', () => {
    const card = { ...mockCard, systemPrompt: '{{var.test}}' };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, { ...mockScene, variables: {} });
    expect(prompt).toBe('');
  });

  it('works alongside other template variables', () => {
    const card = {
      ...mockCard,
      systemPrompt: '{{char}} has {{var.player.hp}} HP. User: {{user}}',
    };
    const scene = { ...mockScene, variables: { 'player.hp': 100 } };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, scene);
    expect(prompt).toBe('Alice has 100 HP. User: User');
  });
});

describe('buildContext — variable substitution', () => {
  it('substitutes {{var.*}} in message content', () => {
    const messages: Message[] = [
      { role: 'user', content: 'HP is {{var.player.hp}}', type: 'dialogue', timestamp: 1000 },
    ];
    const scene: SceneState = {
      ...mockScene,
      variables: { 'player.hp': 75 },
    };
    const context = defaultPromptBuilder.buildContext(messages, scene);
    expect(context).toContain('HP is 75');
  });
});
