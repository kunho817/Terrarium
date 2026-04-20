import { describe, it, expect } from 'vitest';
import { assembleWithPreset, type AssemblyContext } from '$lib/core/chat/prompt-assembler';
import type { PromptPreset } from '$lib/types/prompt-preset';
import type { AgentOutputs } from '$lib/types/agent';
import type { CharacterCard, Message } from '$lib/types';

function uid(): string {
  return crypto.randomUUID();
}

function makeMinimalCard(): CharacterCard {
  return {
    name: 'TestChar',
    description: 'A test character',
    personality: 'brave',
    scenario: 'A test scenario',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: '',
    systemPrompt: 'You are TestChar.',
    postHistoryInstructions: '',
    defaultPersonaId: '',
    creator: '',
    characterVersion: '',
    tags: [],
    creatorNotes: '',
    license: '',
    lorebook: [],
    loreSettings: { scanDepth: 1, tokenBudget: 1000, recursiveScanning: false, fullWordMatching: false },
    regexScripts: [],
    triggers: [],
    scriptState: {},
    emotionImages: [],
    additionalAssets: [],
    metadata: {},
  };
}

describe('Agent -> Prompt integration', () => {
  it('agent outputs appear in assembled messages at correct positions', () => {
    const agentOutputs: AgentOutputs = {
      memory: '[Memory]\n- Elara is afraid of fire (trait)',
      director: '[Director]\nScene Mandate: Test mandate',
      sceneState: '[Scene]\nLocation: The Rusty Tankard',
      characterState: '[Character States]\nElara: alert',
    };

    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'system', name: 'System', enabled: true, role: 'system', content: 'You are TestChar.' },
        { id: uid(), type: 'description', name: 'Desc', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'memory', name: 'Memory', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'sceneState', name: 'Scene', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'characterState', name: 'Chars', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'chatHistory', name: 'History', enabled: true, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
        environmentalNotes: '',
        lastUpdated: 0,
      },
      messages: [
        { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 1 },
        { role: 'assistant', content: 'Hi there', type: 'dialogue', timestamp: 2 },
      ],
      lorebookMatches: [],
      agentOutputs,
    };

    const result = assembleWithPreset(preset, ctx);

    const types = result.messages.map(m => {
      if (m.content.startsWith('[Memory]')) return 'memory';
      if (m.content.startsWith('[Director]')) return 'director';
      if (m.content.startsWith('[Scene]')) return 'sceneState';
      if (m.content.startsWith('[Character States]')) return 'characterState';
      if (m.content.startsWith('You are')) return 'system';
      return 'other';
    });

    const memoryIdx = types.indexOf('memory');
    const directorIdx = types.indexOf('director');
    const sceneIdx = types.indexOf('sceneState');
    const charIdx = types.indexOf('characterState');
    const historyIdx = result.messages.findIndex(m => m.role === 'user');

    expect(memoryIdx).toBeGreaterThan(-1);
    expect(directorIdx).toBeGreaterThan(-1);
    expect(sceneIdx).toBeGreaterThan(-1);
    expect(charIdx).toBeGreaterThan(-1);

    expect(directorIdx).toBeGreaterThan(memoryIdx);
    expect(sceneIdx).toBeGreaterThan(directorIdx);
    expect(charIdx).toBeGreaterThan(sceneIdx);
    expect(historyIdx).toBeGreaterThan(charIdx);
  });

  it('disabled agent items produce no output', () => {
    const agentOutputs: AgentOutputs = {
      memory: '[Memory]\n- fact',
      director: '[Director]\nMandate',
      sceneState: '[Scene]\nLocation: test',
      characterState: '[Character States]\nElara: alert',
    };

    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'memory', name: 'Memory', enabled: false, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: false, role: 'system', content: '' },
        { id: uid(), type: 'sceneState', name: 'Scene', enabled: false, role: 'system', content: '' },
        { id: uid(), type: 'characterState', name: 'Chars', enabled: false, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
      messages: [],
      lorebookMatches: [],
      agentOutputs,
    };

    const result = assembleWithPreset(preset, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('no agentOutputs produces no agent messages', () => {
    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'memory', name: 'Memory', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: true, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
      messages: [],
      lorebookMatches: [],
    };

    const result = assembleWithPreset(preset, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('partial agentOutputs only produce messages for available agents', () => {
    const agentOutputs: AgentOutputs = {
      memory: '[Memory]\n- fact',
    };

    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'memory', name: 'Memory', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: true, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
      messages: [],
      lorebookMatches: [],
      agentOutputs,
    };

    const result = assembleWithPreset(preset, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain('[Memory]');
  });
});
