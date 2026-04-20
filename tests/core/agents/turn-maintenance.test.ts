import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runTurnMaintenance,
  parseTurnMaintenanceJson,
  buildTurnMaintenanceUserContent,
} from '$lib/core/agents/turn-maintenance';
import type { SessionAgentState, TurnMaintenanceOutput } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => {
      fn({
        defaultProvider: 'test',
        providers: { test: { apiKey: 'test-key', model: 'test-model' } },
        modelSlots: {},
        agentSettings: { director: { mode: 'light' }, turnMaintenance: { tokenBudget: 2048 } },
      });
      return vi.fn();
    }),
    set: vi.fn(),
    update: vi.fn(),
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
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: { currentArc: 'The gate standoff', activeTensions: ['Guard vs Alice'], recentDecisions: [], nextBeats: [], turnNumber: 1 },
  };
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

  it('returns null for JSON missing required sections', () => {
    expect(parseTurnMaintenanceJson('{"narrativeBrief": "test"}')).toBeNull();
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
});

describe('runTurnMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TurnMaintenanceOutput on success', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      narrativeBrief: 'Tense standoff at the gate.',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: 'Gate confrontation',
        narrativeGoal: 'Resolve the standoff',
        activeTensions: ['Guard decision'],
        nextBeats: ['Guard attacks or yields'],
        guardrails: ['Stay in character'],
        focusCharacters: ['Alice'],
        recentDecisions: ['Alice drew sword'],
      },
      director: {
        sceneMandate: 'Force the guard to act',
        requiredOutcomes: ['Combat or negotiation'],
        forbiddenMoves: ['No deus ex machina'],
        emphasis: ['Tension'],
        targetPacing: 'fast',
        pressureLevel: 'high',
        focusCharacters: ['Alice'],
      },
    }));

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).not.toBeNull();
    expect(result!.narrativeBrief).toBeTruthy();
    expect(result!.director.sceneMandate).toBeTruthy();
  });

  it('returns null when LLM call fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('failed'));
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('repair failed'));

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
  });
});
