import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { AgentContext, ProgressCallback } from '$lib/types/agent';
import type { Agent, AgentResult } from '$lib/types/agent';
import { makeSessionId, makeCharacterId } from '$lib/types/branded';

function mockCtx(): AgentContext {
  return {
    sessionId: makeSessionId('test'),
    cardId: makeCharacterId('test'),
    cardType: 'character',
    messages: [],
    scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
    turnNumber: 1,
    config: { providerId: 'test', model: 'test' } as any,
  };
}

function stubAgent(id: string, priority: number): Agent {
  return {
    id,
    name: id,
    priority,
    init: vi.fn(),
    onBeforeSend: vi.fn().mockResolvedValue({}),
    onAfterReceive: vi.fn().mockResolvedValue({}),
    shutdown: vi.fn(),
  };
}

describe('AgentRunner progress callback', () => {
  function cleanRunner(): AgentRunner {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');
    runner.unregisterAgent('narrative-consistency');
    return runner;
  }

  it('calls onProgress with running then done for each agent', async () => {
    const runner = cleanRunner();
    const agentA = stubAgent('agent-a', 1);
    const agentB = stubAgent('agent-b', 2);
    runner.registerAgent(agentA);
    runner.registerAgent(agentB);

    const calls: Array<{ id: string; status: string }> = [];
    const onProgress: ProgressCallback = (agentId, status) => {
      calls.push({ id: agentId, status });
    };

    await runner.onBeforeSend(mockCtx(), onProgress);

    expect(calls).toEqual([
      { id: 'agent-a', status: 'running' },
      { id: 'agent-a', status: 'done' },
      { id: 'agent-b', status: 'running' },
      { id: 'agent-b', status: 'done' },
    ]);
  });

  it('reports failed when an agent throws', async () => {
    const runner = cleanRunner();
    const failingAgent: Agent = {
      id: 'fail-agent',
      name: 'Fail',
      priority: 1,
      init: vi.fn(),
      onBeforeSend: vi.fn().mockRejectedValue(new Error('boom')),
      onAfterReceive: vi.fn(),
      shutdown: vi.fn(),
    };
    runner.registerAgent(failingAgent);

    const calls: Array<{ id: string; status: string }> = [];
    const onProgress: ProgressCallback = (agentId, status) => {
      calls.push({ id: agentId, status });
    };

    await runner.onBeforeSend(mockCtx(), onProgress);

    expect(calls).toEqual([
      { id: 'fail-agent', status: 'running' },
      { id: 'fail-agent', status: 'failed' },
    ]);
  });

  it('works without onProgress (backward compatible)', async () => {
    const runner = cleanRunner();
    const agent = stubAgent('test', 1);
    runner.registerAgent(agent);

    const result = await runner.onBeforeSend(mockCtx());
    expect(result).toBeDefined();
  });
});
