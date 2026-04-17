import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

function mockAgent(id: string, priority: number, result: AgentResult): Agent {
	return {
		id,
		name: id,
		priority,
		init: vi.fn().mockResolvedValue(undefined),
		onBeforeSend: vi.fn().mockResolvedValue(result),
		onAfterReceive: vi.fn().mockResolvedValue({}),
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
		},
		turnNumber: 1,
		config: {
			providerId: 'test',
			model: 'test-model',
		},
	};
}

describe('AgentRunner output collection', () => {
	it('maps memory agent injectPrompt to agentOutputs.memory', async () => {
		const runner = new AgentRunner();
		runner.unregisterAgent('memory');
		runner.unregisterAgent('director');
		runner.unregisterAgent('scene-state');
		runner.unregisterAgent('character-state');

		runner.registerAgent(mockAgent('memory', 10, {
			injectPrompt: '[Memory]\n- fact (trait)',
		}));

		const result = await runner.onBeforeSend(mockContext());
		expect(result.agentOutputs?.memory).toBe('[Memory]\n- fact (trait)');
	});

	it('maps director agent injectPrompt to agentOutputs.director', async () => {
		const runner = new AgentRunner();
		runner.unregisterAgent('memory');
		runner.unregisterAgent('director');
		runner.unregisterAgent('scene-state');
		runner.unregisterAgent('character-state');

		runner.registerAgent(mockAgent('director', 20, {
			injectPrompt: '[Director]\nScene Mandate: test',
		}));

		const result = await runner.onBeforeSend(mockContext());
		expect(result.agentOutputs?.director).toBe('[Director]\nScene Mandate: test');
	});

	it('maps scene-state agent injectPrompt to agentOutputs.sceneState', async () => {
		const runner = new AgentRunner();
		runner.unregisterAgent('memory');
		runner.unregisterAgent('director');
		runner.unregisterAgent('scene-state');
		runner.unregisterAgent('character-state');

		runner.registerAgent(mockAgent('scene-state', 30, {
			injectPrompt: '[Scene]\nLocation: test',
		}));

		const result = await runner.onBeforeSend(mockContext());
		expect(result.agentOutputs?.sceneState).toBe('[Scene]\nLocation: test');
	});

	it('maps character-state agent injectPrompt to agentOutputs.characterState', async () => {
		const runner = new AgentRunner();
		runner.unregisterAgent('memory');
		runner.unregisterAgent('director');
		runner.unregisterAgent('scene-state');
		runner.unregisterAgent('character-state');

		runner.registerAgent(mockAgent('character-state', 40, {
			injectPrompt: '[Character States]\nElara: alert',
		}));

		const result = await runner.onBeforeSend(mockContext());
		expect(result.agentOutputs?.characterState).toBe('[Character States]\nElara: alert');
	});

	it('collects outputs from multiple agents', async () => {
		const runner = new AgentRunner();
		runner.unregisterAgent('memory');
		runner.unregisterAgent('director');
		runner.unregisterAgent('scene-state');
		runner.unregisterAgent('character-state');

		runner.registerAgent(mockAgent('memory', 10, {
			injectPrompt: '[Memory]\n- fact',
		}));
		runner.registerAgent(mockAgent('director', 20, {
			injectPrompt: '[Director]\nMandate: test',
		}));

		const result = await runner.onBeforeSend(mockContext());
		expect(result.agentOutputs?.memory).toBe('[Memory]\n- fact');
		expect(result.agentOutputs?.director).toBe('[Director]\nMandate: test');
	});

	it('does not set agentOutputs when no agents return injectPrompt', async () => {
		const runner = new AgentRunner();
		runner.unregisterAgent('memory');
		runner.unregisterAgent('director');
		runner.unregisterAgent('scene-state');
		runner.unregisterAgent('character-state');

		runner.registerAgent(mockAgent('memory', 10, {}));

		const result = await runner.onBeforeSend(mockContext());
		expect(result.agentOutputs?.memory).toBeUndefined();
	});
});
