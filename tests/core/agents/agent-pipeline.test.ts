import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentPipeline } from '$lib/core/agents/agent-pipeline';
import type { AgentPipelineContext } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

const settingsMock = vi.hoisted(() => ({
  value: {
    modelSlots: {},
    memorySettings: {},
    agentSettings: {
      enabled: true,
      turnMaintenance: { enabled: true, timeoutMs: 240000 },
      extraction: { enabled: true },
      director: { mode: 'light' },
      worldMode: { sectionWorldInjection: true },
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
  getSummariesForSession: vi.fn(() => Promise.resolve([])),
  getLatestSummaryTurn: vi.fn(() => Promise.resolve(0)),
  getTopKMemories: vi.fn(() => Promise.resolve([])),
  insertSummary: vi.fn(),
  deleteMemoriesForTurn: vi.fn(),
  deleteMemoriesForSession: vi.fn(),
  deleteSummariesFromTurn: vi.fn(),
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

function makeStoryAuthorResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    currentArc: 'Test arc',
    narrativeGoal: 'Test',
    activeTensions: [],
    nextBeats: [],
    guardrails: [],
    focusCharacters: [],
    recentDecisions: [],
    ...overrides,
  });
}

function makeDirectorResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    sceneMandate: 'Test mandate',
    requiredOutcomes: [],
    forbiddenMoves: [],
    emphasis: [],
    targetPacing: 'normal',
    pressureLevel: 'low',
    focusCharacters: [],
    ...overrides,
  });
}

function installPlanningMock(
  mockedCallAgentLLM: any,
  options?: {
    storyAuthor?: Record<string, unknown>;
    director?: Record<string, unknown>;
    sectionWorld?: Record<string, unknown>;
    extraction?: Record<string, unknown>;
    summary?: string;
  },
) {
  mockedCallAgentLLM.mockImplementation(async (systemPrompt: string) => {
    if (systemPrompt.includes('Story Author sub-agent')) {
      return makeStoryAuthorResponse(options?.storyAuthor);
    }
    if (systemPrompt.includes('Director sub-agent')) {
      return makeDirectorResponse(options?.director);
    }
    if (systemPrompt.includes('Section World stage')) {
      return JSON.stringify(options?.sectionWorld ?? {
        sectionTitle: 'Dark Realm',
        prompt: 'The shadows deepen around you.',
        activeRules: ['Magic is unstable'],
        scenePressures: ['Time is running out'],
      });
    }
    if (systemPrompt.includes('Extraction stage')) {
      return JSON.stringify(options?.extraction ?? {
        scene: { location: 'Room', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
        characters: [],
        events: ['Something happened'],
        newFacts: ['A new fact'],
        changed: [],
      });
    }
    return options?.summary ?? 'Summarized continuity.';
  });
}

describe('AgentPipeline', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockReset();
    settingsMock.value = {
      modelSlots: {},
      memorySettings: {},
      agentSettings: {
        enabled: true,
        turnMaintenance: { enabled: true, timeoutMs: 240000 },
        extraction: { enabled: true },
        director: { mode: 'light' },
        worldMode: { sectionWorldInjection: true },
      },
    };
  });

  it('creates with correct step names', () => {
    const pipeline = new AgentPipeline();
    const steps = pipeline.getSteps();
    expect(steps).toHaveLength(5);
    expect(steps[0].id).toBe('memory-retrieval');
    expect(steps[1].id).toBe('turn-maintenance');
    expect(steps[2].id).toBe('section-world');
    expect(steps[3].id).toBe('generation');
    expect(steps[4].id).toBe('extraction');
  });

  it('runBeforeGeneration returns injection result', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    installPlanningMock(vi.mocked(callAgentLLM));

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

  it('resets stale agent state when the stored owner does not match the current card', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const { loadSessionState } = await import('$lib/storage/session-agent-state');
    const { deleteMemoriesForSession } = await import('$lib/storage/memories');

    vi.mocked(loadSessionState).mockResolvedValueOnce({
      sessionId: 'sess-1',
      cardId: 'other-card',
      cardType: 'world',
      lastExtraction: {
        scene: { location: 'Foreign room', characters: ['Other'], atmosphere: 'wrong', timeOfDay: 'night', environmentalNotes: '' },
        characters: {},
        events: ['Wrong card state leaked in'],
        newFacts: [],
        changed: [],
        turnNumber: 1,
        timestamp: Date.now(),
      },
      lastTurnMaintenance: null,
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 0 },
    } as any);

    installPlanningMock(vi.mocked(callAgentLLM), {
      storyAuthor: { currentArc: 'Fresh arc' },
      director: { sceneMandate: 'Fresh mandate' },
    });

    const pipeline = new AgentPipeline();
    const result = await pipeline.runBeforeGeneration({
      ...makeContext(),
      turnNumber: 3,
    });

    expect(result!.injection).not.toContain('Foreign room');
    expect(result!.injection).not.toContain('Wrong card state leaked in');
    expect(result!.injection).toContain('Fresh mandate');
    expect(vi.mocked(deleteMemoriesForSession)).toHaveBeenCalledWith('sess-1');
  });

  it('runAfterGeneration stores extraction', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    installPlanningMock(vi.mocked(callAgentLLM), {
      storyAuthor: { currentArc: '' },
      director: { sceneMandate: '' },
    });

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    await pipeline.runBeforeGeneration(ctx);
    const extraction = await pipeline.runAfterGeneration(ctx, 'AI response text');

    expect(extraction).not.toBeNull();
    expect(extraction!.extraction).not.toBeNull();
    expect(extraction!.extraction!.events).toContain('Something happened');
  });

  it('skips agent work entirely when pipeline is disabled', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    settingsMock.value = {
      ...settingsMock.value,
      agentSettings: {
        ...settingsMock.value.agentSettings,
        enabled: false,
      },
    };

    const pipeline = new AgentPipeline();
    const progress: Array<{ step: string; status: string }> = [];
    const result = await pipeline.runBeforeGeneration(makeContext(), (step, status) => {
      progress.push({ step, status });
    });

    expect(result).toEqual({ injection: '', reliabilityGuard: false, promptSections: {} });
    expect(progress).toEqual([
      { step: 'memory-retrieval', status: 'skipped' },
      { step: 'turn-maintenance', status: 'skipped' },
      { step: 'section-world', status: 'skipped' },
    ]);
    expect(vi.mocked(callAgentLLM)).not.toHaveBeenCalled();
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
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('combined failed'));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    const result = await pipeline.runBeforeGeneration(ctx);

    expect(result!.reliabilityGuard).toBe(true);
    expect(result!.injection).toContain('Reliability Guard');
  });

  it('runs section world step for world mode', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const { loadSessionState } = await import('$lib/storage/session-agent-state');

    vi.mocked(loadSessionState).mockResolvedValueOnce({
      sessionId: 'sess-1',
      lastExtraction: {
        scene: { location: 'Forest', characters: ['Hero'], atmosphere: 'Tense', timeOfDay: 'Night', environmentalNotes: '' },
        characters: {},
        events: ['Hero entered the forest'],
        newFacts: [],
        changed: [],
      },
      lastTurnMaintenance: null,
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 0 },
    } as any);

    installPlanningMock(vi.mocked(callAgentLLM));

    const pipeline = new AgentPipeline();
    const ctx: AgentPipelineContext = {
      ...makeContext(),
      cardType: 'world',
    };
    const result = await pipeline.runBeforeGeneration(ctx);

    expect(result!.injection).toContain('[Section World: Dark Realm]');
    expect(result!.injection).toContain('The shadows deepen around you.');
  });

  it('skips section world when disabled in settings', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    settingsMock.value = {
      ...settingsMock.value,
      agentSettings: {
        ...settingsMock.value.agentSettings,
        worldMode: { sectionWorldInjection: false },
      },
    };

    installPlanningMock(vi.mocked(callAgentLLM));

    const pipeline = new AgentPipeline();
    const progress: Array<{ step: string; status: string }> = [];
    const result = await pipeline.runBeforeGeneration(
      { ...makeContext(), cardType: 'world' },
      (step, status) => {
        progress.push({ step, status });
      },
    );

    expect(result!.injection).not.toContain('[Section World:');
    expect(progress.some((p) => p.step === 'section-world' && p.status === 'skipped')).toBe(true);
    expect(vi.mocked(callAgentLLM)).toHaveBeenCalledTimes(2);
  });

  it('skips section world for character mode', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    installPlanningMock(vi.mocked(callAgentLLM));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    const progress: Array<{ step: string; status: string }> = [];
    const result = await pipeline.runBeforeGeneration(ctx, (step, status) => {
      progress.push({ step, status });
    });

    expect(result!.injection).not.toContain('[Section World:');
    expect(progress.some(p => p.step === 'section-world' && p.status === 'skipped')).toBe(true);
  });

  it('skips extraction when extraction is disabled', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    settingsMock.value = {
      ...settingsMock.value,
      agentSettings: {
        ...settingsMock.value.agentSettings,
        extraction: { enabled: false },
      },
    };

    const pipeline = new AgentPipeline();
    const progress: Array<{ step: string; status: string }> = [];
    const result = await pipeline.runAfterGeneration(makeContext(), 'AI response text', (step, status) => {
      progress.push({ step, status });
    });

    expect(result).toEqual({ extraction: null });
    expect(progress).toEqual([{ step: 'extraction', status: 'skipped' }]);
    expect(vi.mocked(callAgentLLM)).not.toHaveBeenCalled();
  });

  it('includes archived summaries and important fallback memories when embeddings are disabled', async () => {
    const { getSummariesForSession, getTopKMemories, getMemoriesForSession } = await import('$lib/storage/memories');
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');

    settingsMock.value = {
      ...settingsMock.value,
      memorySettings: {
        topK: 2,
        tokenBudget: 4096,
        embeddingProvider: '',
        embeddingApiKey: '',
        embeddingModel: '',
      },
    };

    vi.mocked(getSummariesForSession).mockResolvedValueOnce([
      {
        id: 'sum-1',
        sessionId: 'sess-1' as any,
        startTurn: 1,
        endTurn: 2,
        summary: 'The opening conflict was established.',
        createdAt: Date.now(),
      },
    ]);
    vi.mocked(getTopKMemories).mockResolvedValueOnce([
      {
        id: 'mem-1',
        sessionId: 'sess-1' as any,
        type: 'relationship',
        content: 'Alice distrusts the captain.',
        importance: 0.9,
        sourceMessageIds: [],
        turnNumber: 1,
        createdAt: 10,
      },
      {
        id: 'mem-2',
        sessionId: 'sess-1' as any,
        type: 'location',
        content: 'The safehouse is beneath the chapel.',
        importance: 0.7,
        sourceMessageIds: [],
        turnNumber: 1,
        createdAt: 9,
      },
    ]);
    vi.mocked(getMemoriesForSession).mockResolvedValueOnce([
      {
        id: 'mem-1',
        sessionId: 'sess-1' as any,
        type: 'relationship',
        content: 'Alice distrusts the captain.',
        importance: 0.9,
        sourceMessageIds: [],
        turnNumber: 1,
        createdAt: 10,
      },
      {
        id: 'mem-2',
        sessionId: 'sess-1' as any,
        type: 'location',
        content: 'The safehouse is beneath the chapel.',
        importance: 0.7,
        sourceMessageIds: [],
        turnNumber: 1,
        createdAt: 9,
      },
      {
        id: 'mem-3',
        sessionId: 'sess-1' as any,
        type: 'event',
        content: 'Alice escaped the raid.',
        importance: 0.8,
        sourceMessageIds: [],
        turnNumber: 2,
        createdAt: 11,
      },
    ]);
    installPlanningMock(vi.mocked(callAgentLLM));

    const pipeline = new AgentPipeline();
    const result = await pipeline.runBeforeGeneration({
      ...makeContext(),
      turnNumber: 3,
    });

    expect(result.injection).toContain('[Archived Summaries]');
    expect(result.injection).toContain('[Arc Memory]');
    expect(result.injection).toContain('[Persistent Memory]');
    expect(result.injection).toContain('[Turning Points]');
    expect(result.injection).toContain('The opening conflict was established.');
    expect(result.injection).toContain('Alice distrusts the captain.');
    expect(result.injection).toContain('The safehouse is beneath the chapel.');
    expect(result.injection).toContain('Alice escaped the raid.');
  });

  it('creates a session summary when enough unsummarized turns accumulate', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const { loadSessionState } = await import('$lib/storage/session-agent-state');
    const { getLatestSummaryTurn, insertSummary } = await import('$lib/storage/memories');

    settingsMock.value = {
      ...settingsMock.value,
      memorySettings: {
        summaryThreshold: 2,
        topK: 15,
        tokenBudget: 4096,
        embeddingProvider: '',
        embeddingApiKey: '',
        embeddingModel: '',
      },
    };

    vi.mocked(loadSessionState).mockResolvedValueOnce({
      sessionId: 'sess-1',
      cardId: 'card-1',
      cardType: 'character',
      lastExtraction: null,
      lastTurnMaintenance: null,
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [
        {
          turnNumber: 1,
          extractionSummary: 'Alice arrived.',
          events: ['Alice arrived'],
          timestamp: Date.now(),
        },
      ],
      narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 1 },
    } as any);
    vi.mocked(getLatestSummaryTurn).mockResolvedValueOnce(0);
    installPlanningMock(vi.mocked(callAgentLLM), {
      extraction: {
        scene: { location: 'Room', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
        characters: [],
        events: ['A second event'],
        newFacts: ['Alice now trusts the captain'],
        changed: [],
      },
      summary: 'Turns 1-2: Alice arrived and the trust dynamic shifted.',
    });

    const pipeline = new AgentPipeline();
    const result = await pipeline.runAfterGeneration({
      ...makeContext(),
      turnNumber: 2,
    }, 'AI response text');

    expect(result.extraction).not.toBeNull();
    expect(vi.mocked(insertSummary)).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'sess-1',
      startTurn: 1,
      endTurn: 2,
      summary: 'Turns 1-2: Alice arrived and the trust dynamic shifted.',
    }));
  });

  it('clearTurnState removes memories and summaries from the reroll turn onward', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const { loadSessionState, saveSessionState } = await import('$lib/storage/session-agent-state');
    const { deleteMemoriesForTurn, deleteSummariesFromTurn } = await import('$lib/storage/memories');

    vi.mocked(loadSessionState).mockResolvedValueOnce({
      sessionId: 'sess-1',
      cardId: 'card-1',
      cardType: 'character',
      lastExtraction: null,
      lastTurnMaintenance: null,
      lastSectionWorld: null,
      entities: { a: { id: 'a', name: 'Alice', type: 'character', description: '', attributes: {}, lastUpdated: 1 } },
      relations: [{ subjectId: 'a', objectId: 'b', relationType: 'trust', description: '', lastUpdated: 1 }],
      worldFacts: [{ id: 'wf', content: 'Fact', category: 'test', importance: 1, source: 'test', createdAt: 1 }],
      turnHistory: [
        { turnNumber: 1, extractionSummary: 'One', events: ['One'], timestamp: 1 },
        { turnNumber: 2, extractionSummary: 'Two', events: ['Two'], timestamp: 2 },
      ],
      narrativeState: { currentArc: 'Arc', activeTensions: ['T'], recentDecisions: ['D'], nextBeats: ['N'], turnNumber: 2 },
    } as any);
    installPlanningMock(vi.mocked(callAgentLLM), {
      storyAuthor: { currentArc: '' },
      director: { sceneMandate: '' },
    });

    const pipeline = new AgentPipeline();
    await pipeline.runBeforeGeneration(makeContext());
    await pipeline.clearTurnState(2);

    expect(vi.mocked(deleteMemoriesForTurn)).toHaveBeenCalledWith('sess-1', 2);
    expect(vi.mocked(deleteSummariesFromTurn)).toHaveBeenCalledWith('sess-1', 2);
    expect(vi.mocked(saveSessionState)).toHaveBeenLastCalledWith(expect.objectContaining({
      turnHistory: [expect.objectContaining({ turnNumber: 1 })],
      entities: {},
      relations: [],
      worldFacts: [],
      narrativeState: expect.objectContaining({ turnNumber: 1 }),
    }));
  });
});
