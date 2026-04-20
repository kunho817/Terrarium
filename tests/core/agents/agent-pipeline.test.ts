import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentPipeline } from '$lib/core/agents/agent-pipeline';
import type { AgentPipelineContext } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => { fn({ modelSlots: {}, agentSettings: { enabled: true, turnMaintenance: { enabled: true }, extraction: { enabled: true }, director: { mode: 'light' } }, memorySettings: {} }); return vi.fn(); }),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('$lib/core/bootstrap', () => ({
  getRegistry: vi.fn(),
}));

vi.mock('$lib/storage/session-agent-state', () => ({
  loadSessionState: vi.fn(() => Promise.resolve(null)),
  saveSessionState: vi.fn(),
}));

vi.mock('$lib/storage/memories', () => ({
  insertMemory: vi.fn(),
  findSimilarMemories: vi.fn(() => Promise.resolve([])),
  getMemoriesForSession: vi.fn(() => Promise.resolve([])),
}));

vi.mock('$lib/core/embedding', () => ({
  getEmbedding: vi.fn(() => Promise.resolve(new Array(128).fill(0.1))),
}));

function makeContext(): AgentPipelineContext {
  return {
    sessionId: 'sess-1' as any,
    cardId: 'card-1' as any,
    cardType: 'character',
    messages: [
      { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 1 },
      { role: 'assistant', content: 'Hi there!', type: 'dialogue', timestamp: 2 },
    ],
    scene: {
      location: '', participatingCharacters: [], mood: '', time: '',
      environmentalNotes: '', lastUpdated: 0, variables: {},
    },
    turnNumber: 1,
    config: {
      providerId: 'openai', model: 'gpt-4', apiKey: 'test', temperature: 0.7, maxTokens: 4096,
    },
  };
}

describe('AgentPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates with correct step names', () => {
    const pipeline = new AgentPipeline();
    const steps = pipeline.getSteps();
    expect(steps).toHaveLength(4);
    expect(steps[0].id).toBe('memory-retrieval');
    expect(steps[1].id).toBe('turn-maintenance');
    expect(steps[2].id).toBe('generation');
    expect(steps[3].id).toBe('extraction');
  });

  it('runBeforeGeneration returns injection result', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      narrativeBrief: 'Test brief',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: { currentArc: 'Test arc', narrativeGoal: 'Test', activeTensions: [], nextBeats: [], guardrails: [], focusCharacters: [], recentDecisions: [] },
      director: { sceneMandate: 'Test mandate', requiredOutcomes: [], forbiddenMoves: [], emphasis: [], targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [] },
    }));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    const progress: Array<{ step: string; status: string }> = [];
    const result = await pipeline.runBeforeGeneration(ctx, (step, status) => {
      progress.push({ step, status });
    });

    expect(result).not.toBeNull();
    expect(result!.injection).toBeTruthy();
    expect(result!.injection).toContain('Director Supervision');
    expect(progress.length).toBeGreaterThan(0);
  });

  it('runAfterGeneration stores extraction', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      narrativeBrief: 'Brief',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: { currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [], guardrails: [], focusCharacters: [], recentDecisions: [] },
      director: { sceneMandate: '', requiredOutcomes: [], forbiddenMoves: [], emphasis: [], targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [] },
    }));
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      scene: { location: 'Room', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
      characters: [],
      events: ['Something happened'],
      newFacts: ['A new fact'],
      changed: [],
    }));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    await pipeline.runBeforeGeneration(ctx);
    const extraction = await pipeline.runAfterGeneration(ctx, 'AI response text');

    expect(extraction).not.toBeNull();
    expect(extraction!.extraction).not.toBeNull();
    expect(extraction!.extraction!.events).toContain('Something happened');
  });

  it('handles generation step progress', async () => {
    const pipeline = new AgentPipeline();
    const progress: Array<{ step: string; status: string }> = [];
    pipeline.reportGenerationStatus('running', (step, status) => {
      progress.push({ step, status });
    });
    expect(progress).toEqual([{ step: 'generation', status: 'running' }]);
  });

  it('returns reliability guard when turn maintenance fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('failed'));
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('repair failed'));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    const result = await pipeline.runBeforeGeneration(ctx);

    expect(result!.reliabilityGuard).toBe(true);
    expect(result!.injection).toContain('Reliability Guard');
  });
});
