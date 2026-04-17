import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/stores/scene', () => ({
  sceneStore: {
    update: vi.fn(),
    subscribe: vi.fn(),
    set: vi.fn(),
  },
}));

import { sceneStore } from '$lib/stores/scene';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

function mockSceneAgent(): Agent {
  return {
    id: 'scene-state',
    name: 'Scene State',
    priority: 30,
    init: vi.fn().mockResolvedValue(undefined),
    onBeforeSend: vi.fn().mockResolvedValue({}),
    onAfterReceive: vi.fn().mockResolvedValue({
      updatedState: {
        scene: {
          location: 'The Rusty Tankard',
          mood: 'Tense',
          time: 'Late evening',
          participatingCharacters: ['Elara', 'Kai'],
        },
      },
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function mockContext(): AgentContext {
  return {
    sessionId: 'test-session',
    cardId: 'test-card',
    cardType: 'character',
    messages: [],
    scene: {
      location: '',
      time: '',
      mood: '',
      participatingCharacters: [],
      variables: {},
      environmentalNotes: '',
      lastUpdated: 0,
    },
    turnNumber: 1,
    config: { providerId: 'test', model: 'test' },
  };
}

describe('AgentRunner state persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists scene state updates to sceneStore', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    runner.registerAgent(mockSceneAgent());

    await runner.onAfterReceive(mockContext(), 'AI response');

    expect(sceneStore.update).toHaveBeenCalled();
    const updateFn = (sceneStore.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const result = updateFn({
      location: '',
      time: '',
      mood: '',
      participatingCharacters: [],
      variables: {},
      environmentalNotes: '',
      lastUpdated: 0,
    });
    expect(result.location).toBe('The Rusty Tankard');
    expect(result.mood).toBe('Tense');
    expect(result.time).toBe('Late evening');
    expect(result.participatingCharacters).toEqual(['Elara', 'Kai']);
  });

  it('does not call sceneStore when no scene state update', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    const agent: Agent = {
      id: 'memory',
      name: 'Memory',
      priority: 10,
      init: vi.fn().mockResolvedValue(undefined),
      onBeforeSend: vi.fn().mockResolvedValue({}),
      onAfterReceive: vi.fn().mockResolvedValue({
        updatedState: {
          directorGuidance: { sceneMandate: 'test' },
        },
      }),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    runner.registerAgent(agent);

    await runner.onAfterReceive(mockContext(), 'AI response');

    expect(sceneStore.update).not.toHaveBeenCalled();
  });
});
