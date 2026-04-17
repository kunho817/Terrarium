import { describe, it, expect } from 'vitest';
import type { PromptItem } from '$lib/types/prompt-preset';
import type { AssemblyContext } from '$lib/core/chat/prompt-assembler';
import { resolveItem } from '$lib/core/chat/prompt-assembler';
import type { AgentOutputs } from '$lib/types/agent';

function makeContext(agentOutputs?: AgentOutputs): AssemblyContext {
  return {
    card: {
      name: 'Test',
      description: 'A test character',
      personality: '',
      scenario: '',
      firstMessage: '',
      alternateGreetings: [],
      exampleMessages: '',
      systemPrompt: '',
      postHistoryInstructions: '',
      depthPrompt: null,
      defaultPersonaId: '',
      creator: '',
      characterVersion: '',
      tags: [],
      creatorNotes: '',
      license: '',
      lorebook: [],
      loreSettings: { scanDepth: 1, tokenBudget: 1000 },
      regexScripts: [],
      triggers: [],
    },
    scene: {
      location: '',
      time: '',
      mood: '',
      participatingCharacters: [],
      variables: {},
    },
    messages: [],
    lorebookMatches: [],
    agentOutputs,
  };
}

describe('resolveItem agent types', () => {
  const baseItem = {
    id: 'test',
    enabled: true,
    role: 'system' as const,
    content: '',
  };

  it('returns null for memory item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'memory', name: 'Memory' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for memory item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'memory', name: 'Memory' };
    const result = resolveItem(item, makeContext({
      memory: '[Memory]\n- Elara is afraid of fire (trait)',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Memory]\n- Elara is afraid of fire (trait)',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for director item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'director', name: 'Director' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for director item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'director', name: 'Director' };
    const result = resolveItem(item, makeContext({
      director: '[Director]\nScene Mandate: Test mandate',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Director]\nScene Mandate: Test mandate',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for sceneState item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'sceneState', name: 'Scene State' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for sceneState item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'sceneState', name: 'Scene State' };
    const result = resolveItem(item, makeContext({
      sceneState: '[Scene]\nLocation: The Rusty Tankard',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Scene]\nLocation: The Rusty Tankard',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for characterState item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'characterState', name: 'Character State' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for characterState item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'characterState', name: 'Character State' };
    const result = resolveItem(item, makeContext({
      characterState: '[Character States]\nElara: alert',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Character States]\nElara: alert',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for disabled agent item', () => {
    const item: PromptItem = { ...baseItem, type: 'memory', name: 'Memory', enabled: false };
    const result = resolveItem(item, makeContext({
      memory: '[Memory]\n- fact',
    }));
    expect(result).toBeNull();
  });
});
