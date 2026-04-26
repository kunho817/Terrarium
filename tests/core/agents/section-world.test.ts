import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSectionWorldJson,
  buildSectionWorldUserContent,
  runSectionWorld,
} from '$lib/core/agents/section-world';
import type { SessionAgentState } from '$lib/core/agents/types';

const settingsMock = vi.hoisted(() => ({
  value: {
    defaultProvider: 'test',
    providers: { test: { apiKey: 'test-key', model: 'test-model' } },
    modelSlots: {},
    agentSettings: {
      enabled: true,
      turnMaintenance: { enabled: true, timeoutMs: 240000 },
      extraction: { enabled: true },
      director: { mode: 'light' },
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

function makeState(overrides?: Partial<SessionAgentState>): SessionAgentState {
  return {
    sessionId: 'test-session',
    lastExtraction: {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: 'Dark Forest', characters: ['Elf', 'Dwarf'], atmosphere: 'eerie', timeOfDay: 'night', environmentalNotes: 'fog' },
      characters: {
        Elf: { name: 'Elf', emotion: 'wary', location: 'forest path', inventory: ['bow'], health: 'healthy', notes: '' },
        Dwarf: { name: 'Dwarf', emotion: 'grumpy', location: 'forest path', inventory: ['axe'], health: 'bruised', notes: '' },
      },
      events: ['Elf spotted movement in the trees'],
      newFacts: ['The forest is enchanted'],
      changed: [],
    },
    lastTurnMaintenance: null,
    lastSectionWorld: null,
    entities: {
      'dark-forest': { id: 'dark-forest', name: 'Dark Forest', type: 'location', description: 'An ancient forest shrouded in fog', attributes: {}, lastUpdated: Date.now() },
    },
    relations: [],
    worldFacts: [
      { id: 'wf1', content: 'Magic is stronger at night', category: 'rule', importance: 8, source: 'extraction', createdAt: Date.now() },
    ],
    turnHistory: [],
    narrativeState: { currentArc: 'Into the Woods', activeTensions: ['Something watches from the dark'], recentDecisions: ['Entered the forest'], nextBeats: ['Discover source of magic'], turnNumber: 1 },
    ...overrides,
  };
}

describe('parseSectionWorldJson', () => {
  it('parses valid section world JSON', () => {
    const json = JSON.stringify({
      sectionTitle: 'Enchanted Forest Path',
      prompt: 'The fog thickens around twisted oaks...',
      activeRules: ['Magic amplified at night', 'Visibility reduced'],
      scenePressures: ['Something moves in the mist', 'Time running out'],
    });
    const result = parseSectionWorldJson(json);
    expect(result).not.toBeNull();
    expect(result!.sectionTitle).toBe('Enchanted Forest Path');
    expect(result!.prompt).toContain('fog thickens');
    expect(result!.activeRules).toHaveLength(2);
    expect(result!.scenePressures).toHaveLength(2);
  });

  it('parses JSON embedded in text', () => {
    const text = `Here is the result:\n${JSON.stringify({ sectionTitle: 'Tavern', prompt: 'A warm fire crackles', activeRules: [], scenePressures: [] })}\nDone.`;
    const result = parseSectionWorldJson(text);
    expect(result).not.toBeNull();
    expect(result!.sectionTitle).toBe('Tavern');
  });

  it('returns null for missing sectionTitle', () => {
    const json = JSON.stringify({ sectionTitle: '', prompt: 'Some text', activeRules: [], scenePressures: [] });
    expect(parseSectionWorldJson(json)).toBeNull();
  });

  it('returns null for missing prompt', () => {
    const json = JSON.stringify({ sectionTitle: 'Valid', prompt: '', activeRules: [], scenePressures: [] });
    expect(parseSectionWorldJson(json)).toBeNull();
  });

  it('returns null for non-string sectionTitle', () => {
    const json = JSON.stringify({ sectionTitle: 123, prompt: 'text', activeRules: [], scenePressures: [] });
    expect(parseSectionWorldJson(json)).toBeNull();
  });

  it('defaults activeRules and scenePressures to empty arrays when not arrays', () => {
    const json = JSON.stringify({ sectionTitle: 'Test', prompt: 'Some prompt', activeRules: 'not-array', scenePressures: null });
    const result = parseSectionWorldJson(json);
    expect(result).not.toBeNull();
    expect(result!.activeRules).toEqual([]);
    expect(result!.scenePressures).toEqual([]);
  });

  it('filters non-string entries from arrays', () => {
    const json = JSON.stringify({ sectionTitle: 'Test', prompt: 'p', activeRules: ['valid', 42, null], scenePressures: ['ok', false] });
    const result = parseSectionWorldJson(json);
    expect(result!.activeRules).toEqual(['valid']);
    expect(result!.scenePressures).toEqual(['ok']);
  });

  it('returns null for input without JSON object', () => {
    expect(parseSectionWorldJson('no json here')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseSectionWorldJson(42 as any)).toBeNull();
  });
});

describe('buildSectionWorldUserContent', () => {
  it('includes extraction snapshot', () => {
    const content = buildSectionWorldUserContent(makeState());
    expect(content).toContain('Dark Forest');
    expect(content).toContain('Elf');
    expect(content).toContain('eerie');
  });

  it('includes narrative state', () => {
    const content = buildSectionWorldUserContent(makeState());
    expect(content).toContain('Into the Woods');
    expect(content).toContain('Something watches');
  });

  it('includes entities and world facts', () => {
    const content = buildSectionWorldUserContent(makeState());
    expect(content).toContain('Dark Forest');
    expect(content).toContain('Magic is stronger at night');
  });

  it('handles state with no extraction', () => {
    const state = makeState({ lastExtraction: null });
    const content = buildSectionWorldUserContent(state);
    expect(content).toContain('Narrative State');
  });
});

describe('runSectionWorld', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockReset();
    settingsMock.value = {
      defaultProvider: 'test',
      providers: { test: { apiKey: 'test-key', model: 'test-model' } },
      modelSlots: {},
      agentSettings: {
        enabled: true,
        turnMaintenance: { enabled: true, timeoutMs: 240000 },
        extraction: { enabled: true },
        director: { mode: 'light' },
      },
    };
  });

  it('returns null when no extraction exists', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const state = makeState({ lastExtraction: null });
    const result = await runSectionWorld(state, {});
    expect(result).toBeNull();
    expect(vi.mocked(callAgentLLM)).not.toHaveBeenCalled();
  });

  it('returns SectionWorldOutput on success', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      sectionTitle: 'Enchanted Glade',
      prompt: 'Moonlight filters through ancient branches...',
      activeRules: ['Magic flows freely'],
      scenePressures: ['A presence stirs'],
    }));

    const result = await runSectionWorld(makeState(), {});
    expect(result).not.toBeNull();
    expect(result!.sectionTitle).toBe('Enchanted Glade');
    expect(result!.prompt).toContain('Moonlight');
  });

  it('returns null when LLM call fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockReset();
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('network'));

    const result = await runSectionWorld(makeState(), {});
    expect(result).toBeNull();
  });

  it('attempts repair when JSON parse fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockReset();
    vi.mocked(callAgentLLM).mockResolvedValueOnce('broken json {sectionTitle: "bad"}');
    const repairedJson = JSON.stringify({
      sectionTitle: 'Repaired Section',
      prompt: 'Repaired prompt text',
      activeRules: [],
      scenePressures: [],
    });
    vi.mocked(callAgentLLM).mockResolvedValueOnce(repairedJson);

    const result = await runSectionWorld(makeState(), {});
    expect(result).not.toBeNull();
    expect(result!.sectionTitle).toBe('Repaired Section');
  });

  it('passes correct temperature and maxTokens to callAgentLLM', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockReset();
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      sectionTitle: 'Test',
      prompt: 'Test prompt',
      activeRules: [],
      scenePressures: [],
    }));

    await runSectionWorld(makeState(), {});
    const callArgs = vi.mocked(callAgentLLM).mock.calls[0][2] as any;
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.maxTokens).toBe(32000);
  });
});
