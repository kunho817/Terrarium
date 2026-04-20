import { describe, it, expect, vi, beforeEach } from 'vitest';

const stateStore: Map<string, string> = new Map();

vi.mock('$lib/storage/db', () => ({
  getDb: vi.fn(async () => ({
    exec(sql: string, params: unknown[]) {
      if (sql.includes('FROM session_agent_state')) {
        const sessionId = params[0] as string;
        const raw = stateStore.get(sessionId);
        if (raw) {
          return [{ values: [[raw]] }];
        }
        return [];
      }
      if (sql.includes('SELECT session_id FROM session_agent_state')) {
        const sessionId = params[0] as string;
        if (stateStore.has(sessionId)) {
          return [{ values: [[sessionId]] }];
        }
        return [];
      }
      return [];
    },
    run(sql: string, params: unknown[]) {
      if (sql.includes('INSERT INTO session_agent_state')) {
        const [sessionId, json] = params as [string, string, number];
        stateStore.set(sessionId, json);
      } else if (sql.includes('UPDATE session_agent_state')) {
        const [json, , sessionId] = params as [string, number, string];
        stateStore.set(sessionId, json);
      } else if (sql.includes('DELETE FROM session_agent_state')) {
        stateStore.delete(params[0] as string);
      }
    },
  })),
  persist: vi.fn(),
  closeDb: vi.fn(),
}));

import { loadSessionState, saveSessionState, deleteSessionState } from '$lib/storage/session-agent-state';
import type { SessionAgentState } from '$lib/core/agents/types';

function makeState(sessionId: string): SessionAgentState {
  return {
    sessionId,
    lastExtraction: {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: {
        location: 'Tavern',
        characters: ['Alice'],
        atmosphere: 'tense',
        timeOfDay: 'evening',
        environmentalNotes: 'rain',
      },
      characters: {
        Alice: {
          name: 'Alice',
          emotion: 'nervous',
          location: 'bar',
          inventory: ['sword'],
          health: 'healthy',
          notes: '',
        },
      },
      events: ['Alice entered'],
      newFacts: ['Alice is searching'],
      changed: [],
    },
    lastTurnMaintenance: null,
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: {
      currentArc: "Alice's search",
      activeTensions: ['Who is Alice looking for?'],
      recentDecisions: [],
      nextBeats: [],
      turnNumber: 1,
    },
  };
}

describe('session-agent-state storage', () => {
  beforeEach(() => {
    stateStore.clear();
  });

  it('returns null for non-existent session', async () => {
    const state = await loadSessionState('nonexistent');
    expect(state).toBeNull();
  });

  it('saves and loads a session state', async () => {
    const original = makeState('test-session-1');
    await saveSessionState(original);

    const loaded = await loadSessionState('test-session-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('test-session-1');
    expect(loaded!.lastExtraction).not.toBeNull();
    expect(loaded!.lastExtraction!.scene.location).toBe('Tavern');
    expect(loaded!.lastExtraction!.characters['Alice'].emotion).toBe('nervous');
    expect(loaded!.narrativeState.currentArc).toBe("Alice's search");
    expect(loaded!.narrativeState.activeTensions).toEqual(['Who is Alice looking for?']);
  });

  it('overwrites existing state on save', async () => {
    const first = makeState('test-session-2');
    first.narrativeState.currentArc = 'First arc';
    await saveSessionState(first);

    const second = makeState('test-session-2');
    second.narrativeState.currentArc = 'Second arc';
    second.lastExtraction = null;
    await saveSessionState(second);

    const loaded = await loadSessionState('test-session-2');
    expect(loaded!.narrativeState.currentArc).toBe('Second arc');
    expect(loaded!.lastExtraction).toBeNull();
  });

  it('deletes a session state', async () => {
    const state = makeState('test-session-3');
    await saveSessionState(state);
    await deleteSessionState('test-session-3');
    const loaded = await loadSessionState('test-session-3');
    expect(loaded).toBeNull();
  });

  it('handles empty state with no extractions', async () => {
    const empty: SessionAgentState = {
      sessionId: 'test-empty',
      lastExtraction: null,
      lastTurnMaintenance: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: {
        currentArc: '',
        activeTensions: [],
        recentDecisions: [],
        nextBeats: [],
        turnNumber: 0,
      },
    };
    await saveSessionState(empty);
    const loaded = await loadSessionState('test-empty');
    expect(loaded!.lastExtraction).toBeNull();
    expect(loaded!.narrativeState.turnNumber).toBe(0);
  });

  it('preserves worldFacts and relations', async () => {
    const state = makeState('test-world');
    state.worldFacts = [
      { id: 'wf-1', content: 'Magic exists', category: 'world_rule', importance: 0.9, source: 'extraction', createdAt: Date.now() },
    ];
    state.relations = [
      { subjectId: 'Alice', objectId: 'Bob', relationType: 'ally', description: 'travel companions', lastUpdated: Date.now() },
    ];
    await saveSessionState(state);
    const loaded = await loadSessionState('test-world');
    expect(loaded!.worldFacts).toHaveLength(1);
    expect(loaded!.worldFacts[0].content).toBe('Magic exists');
    expect(loaded!.relations).toHaveLength(1);
    expect(loaded!.relations[0].relationType).toBe('ally');
  });
});
