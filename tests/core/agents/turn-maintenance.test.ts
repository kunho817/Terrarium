import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runTurnMaintenance,
  parseTurnMaintenanceJson,
  buildTurnMaintenanceUserContent,
} from '$lib/core/agents/turn-maintenance';
import type { SessionAgentState, TurnMaintenanceOutput } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

const settingsMock = vi.hoisted(() => ({
  value: {
    defaultProvider: 'test',
    providers: { test: { apiKey: 'test-key', model: 'test-model' } },
    modelSlots: {},
    agentSettings: {
      director: { mode: 'light' },
      turnMaintenance: { enabled: true, tokenBudget: 2048, contextMessages: 20, timeoutMs: 240000 },
    },
  },
}));

const agentLLMMocks = vi.hoisted(() => {
  const callAgentLLM = vi.fn();
  const callAgentLLMWithMetadata = vi.fn(async (...args: any[]) => ({
    text: await callAgentLLM(...args),
    durationMs: 10,
    inputTokens: 100,
    outputTokens: 50,
  }));
  return { callAgentLLM, callAgentLLMWithMetadata };
});

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: agentLLMMocks.callAgentLLM,
  callAgentLLMWithMetadata: agentLLMMocks.callAgentLLMWithMetadata,
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => {
      fn(settingsMock.value);
      return vi.fn();
    }),
    set: vi.fn((value) => {
      settingsMock.value = value;
    }),
    update: vi.fn((updater) => {
      settingsMock.value =
        typeof updater === 'function'
          ? updater(settingsMock.value)
          : { ...settingsMock.value, ...updater };
    }),
  },
}));

function makeMessages(): Message[] {
  return [
    { role: 'user', content: 'I draw my sword and challenge the guard.', type: 'dialogue', timestamp: 1 },
    { role: 'assistant', content: '*The guard narrows his eyes, hand moving to his own blade.*', type: 'dialogue', timestamp: 2 },
  ];
}

function makeState(): SessionAgentState {
  return {
    sessionId: 'test-session',
    lastExtraction: {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: 'Castle gate', characters: ['Guard', 'Alice'], atmosphere: 'tense', timeOfDay: 'dawn', environmentalNotes: '' },
      characters: {
        Guard: { name: 'Guard', emotion: 'suspicious', location: 'gate', inventory: ['sword'], health: 'healthy', notes: '' },
        Alice: { name: 'Alice', emotion: 'determined', location: 'gate', inventory: ['sword'], health: 'healthy', notes: '' },
      },
      events: ['Alice challenged the guard'],
      newFacts: ['The guard is suspicious of Alice'],
      changed: ['Tension escalated'],
    },
    lastTurnMaintenance: null,
    lastSectionWorld: null,
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: { currentArc: 'The gate standoff', activeTensions: ['Guard vs Alice'], recentDecisions: [], nextBeats: [], turnNumber: 1 },
  };
}

function makeStoryAuthorResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    currentArc: 'Gate confrontation',
    narrativeGoal: 'Resolve the standoff',
    activeTensions: ['Guard decision'],
    nextBeats: ['Guard attacks or yields'],
    guardrails: ['Stay in character'],
    focusCharacters: ['Alice'],
    recentDecisions: ['Alice drew sword'],
    ...overrides,
  });
}

function makeDirectorResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    sceneMandate: 'Force the guard to act',
    requiredOutcomes: ['Combat or negotiation'],
    forbiddenMoves: ['No deus ex machina'],
    emphasis: ['Tension'],
    targetPacing: 'fast',
    pressureLevel: 'high',
    focusCharacters: ['Alice'],
    ...overrides,
  });
}

describe('parseTurnMaintenanceJson', () => {
  it('parses valid turn maintenance JSON', () => {
    const json = JSON.stringify({
      narrativeBrief: 'Alice confronts a guard at the castle gate.',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: 'Gate confrontation',
        narrativeGoal: 'Resolve the standoff',
        activeTensions: ['Will the guard let Alice through?'],
        nextBeats: ['Guard makes a decision'],
        guardrails: ['Do not kill Alice'],
        focusCharacters: ['Alice', 'Guard'],
        recentDecisions: ['Alice drew her sword'],
      },
      director: {
        sceneMandate: 'Escalate tension',
        requiredOutcomes: ['The guard responds'],
        forbiddenMoves: ['Do not resolve peacefully'],
        emphasis: ['Tension', 'Danger'],
        targetPacing: 'fast',
        pressureLevel: 'high',
        focusCharacters: ['Alice'],
      },
    });
    const result = parseTurnMaintenanceJson(json);
    expect(result).not.toBeNull();
    expect(result!.narrativeBrief).toContain('Alice');
    expect(result!.director.sceneMandate).toBe('Escalate tension');
    expect(result!.storyAuthor.activeTensions).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseTurnMaintenanceJson('no json here')).toBeNull();
  });

  it('fills defaults for JSON missing optional sections', () => {
    const result = parseTurnMaintenanceJson('{"narrativeBrief": "test"}');
    expect(result).not.toBeNull();
    expect(result!.narrativeBrief).toBe('test');
    expect(result!.storyAuthor.currentArc).toBe('');
    expect(result!.director.targetPacing).toBe('normal');
  });
});

describe('buildTurnMaintenanceUserContent', () => {
  it('includes conversation, extraction, and narrative state', () => {
    const content = buildTurnMaintenanceUserContent(makeMessages(), makeState(), 'character');
    expect(content).toContain('sword');
    expect(content).toContain('Castle gate');
    expect(content).toContain('gate standoff');
  });

  it('includes world mode indicator when cardType is world', () => {
    const content = buildTurnMaintenanceUserContent(makeMessages(), makeState(), 'world');
    expect(content).toContain('world');
  });

  it('limits conversation history to the configured context window', () => {
    const content = buildTurnMaintenanceUserContent(
      [
        { role: 'user', content: 'first', type: 'dialogue', timestamp: 1 },
        { role: 'assistant', content: 'second', type: 'dialogue', timestamp: 2 },
        { role: 'user', content: 'third', type: 'dialogue', timestamp: 3 },
      ],
      makeState(),
      'character',
      1,
    );

    expect(content).toContain('third');
    expect(content).not.toContain('first');
    expect(content).not.toContain('second');
  });
});

describe('runTurnMaintenance', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockReset();
    settingsMock.value = {
      defaultProvider: 'test',
      providers: { test: { apiKey: 'test-key', model: 'test-model' } },
      modelSlots: {},
      agentSettings: {
        director: { mode: 'light' },
        turnMaintenance: { enabled: true, tokenBudget: 2048, contextMessages: 20, timeoutMs: 240000 },
      },
    };
  });

  it('returns TurnMaintenanceOutput on success', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockImplementation(async (systemPrompt: string) => {
      if (systemPrompt.includes('Story Author sub-agent')) {
        return makeStoryAuthorResponse();
      }
      if (systemPrompt.includes('Director sub-agent')) {
        return makeDirectorResponse();
      }
      throw new Error(`Unexpected prompt: ${systemPrompt}`);
    });

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).not.toBeNull();
    expect(result!.narrativeBrief).toBeTruthy();
    expect(result!.director.sceneMandate).toBeTruthy();
  });

  it('returns null when LLM call fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('failed'));
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('repair failed'));
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('combined failed'));

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
  });

  it('returns null when LLM returns an empty response', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce('');
    vi.mocked(callAgentLLM).mockResolvedValueOnce('');
    vi.mocked(callAgentLLM).mockResolvedValueOnce('');

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
  });

  it('uses the configured director mode prompt', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    settingsMock.value = {
      ...settingsMock.value,
      agentSettings: {
        ...settingsMock.value.agentSettings,
        director: { mode: 'absolute' },
      },
    };

    vi.mocked(callAgentLLM).mockImplementation(async (systemPrompt: string) => {
      if (systemPrompt.includes('Story Author sub-agent')) {
        return makeStoryAuthorResponse({
          narrativeGoal: 'Force a choice',
          activeTensions: ['Commitment'],
          nextBeats: ['Act now'],
          guardrails: [],
          recentDecisions: [],
        });
      }
      if (systemPrompt.includes('Director sub-agent')) {
        expect(systemPrompt).toContain('top-priority direction');
        return makeDirectorResponse({
          sceneMandate: 'Escalate now',
          requiredOutcomes: [],
          forbiddenMoves: [],
          emphasis: [],
        });
      }
      throw new Error(`Unexpected prompt: ${systemPrompt}`);
    });

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result?.director.sceneMandate).toBe('Escalate now');
  });

  it('passes configured ChatML prefills to the story-author and director calls', async () => {
    const { callAgentLLM, callAgentLLMWithMetadata } = await import('$lib/core/agents/agent-llm');
    settingsMock.value = {
      ...settingsMock.value,
      agentSettings: {
        ...(settingsMock.value.agentSettings as any),
        prefills: {
          storyAuthor: '{"currentArc":"',
          director: '{"sceneMandate":"',
        },
      },
    };

    vi.mocked(callAgentLLM).mockImplementation(async (systemPrompt: string) => {
      if (systemPrompt.includes('Story Author sub-agent')) {
        return makeStoryAuthorResponse();
      }
      if (systemPrompt.includes('Director sub-agent')) {
        return makeDirectorResponse();
      }
      throw new Error(`Unexpected prompt: ${systemPrompt}`);
    });

    await runTurnMaintenance(makeMessages(), makeState(), 'character');

    const calls = vi.mocked(callAgentLLMWithMetadata).mock.calls;
    expect(calls[0][3]).toMatchObject({ assistantPrefill: '{"currentArc":"' });
    expect(calls[1][3]).toMatchObject({ assistantPrefill: '{"sceneMandate":"' });
  });

  it('falls back to the combined planner when parallel outputs are unusable', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM)
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('not json either')
      .mockResolvedValueOnce(JSON.stringify({
        narrativeBrief: 'Fallback brief.',
        correction: { shouldCorrect: false, reasons: [] },
        storyAuthor: {
          currentArc: 'Fallback arc',
          narrativeGoal: 'Recover the scene',
          activeTensions: ['Guard decision'],
          nextBeats: ['Guard responds'],
          guardrails: [],
          focusCharacters: ['Alice'],
          recentDecisions: [],
        },
        director: {
          sceneMandate: 'Hold pressure',
          requiredOutcomes: [],
          forbiddenMoves: [],
          emphasis: ['Pressure'],
          targetPacing: 'normal',
          pressureLevel: 'medium',
          focusCharacters: ['Alice'],
        },
      }));

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result?.storyAuthor.currentArc).toBe('Fallback arc');
    expect(result?.director.sceneMandate).toBe('Hold pressure');
  });

  it('returns null when turn maintenance is disabled', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    settingsMock.value = {
      ...settingsMock.value,
      agentSettings: {
        ...settingsMock.value.agentSettings,
        turnMaintenance: { enabled: false, tokenBudget: 2048, contextMessages: 20, timeoutMs: 240000 },
      },
    };

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
    expect(vi.mocked(callAgentLLM)).not.toHaveBeenCalled();
  });
});
