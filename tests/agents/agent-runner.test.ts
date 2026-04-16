import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

function createMockAgent(id: string, priority: number): Agent {
	return {
		id,
		name: `Mock Agent ${id}`,
		priority,
		init: async () => {},
		onBeforeSend: async (ctx: AgentContext): Promise<AgentResult> => {
			return { injectPrompt: `[${id}] Priority ${priority}` };
		},
		onAfterReceive: async (): Promise<AgentResult> => {
			return { updatedState: { scene: { location: `${id} updated` } } };
		},
		shutdown: async () => {}
	};
}

describe('AgentRunner', () => {
	let runner: AgentRunner;
	let mockContext: AgentContext;

	beforeEach(() => {
		runner = new AgentRunner();
		mockContext = {
			sessionId: 'test-session',
			cardId: 'test-card',
			cardType: 'character',
			messages: [],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
	});

	it('executes agents in priority order', async () => {
		const agent1 = createMockAgent('agent1', 30);
		const agent2 = createMockAgent('agent2', 10);
		const agent3 = createMockAgent('agent3', 20);

		runner.registerAgent(agent1);
		runner.registerAgent(agent2);
		runner.registerAgent(agent3);

		const result = await runner.onBeforeSend(mockContext);
		
		// Agents should be ordered: agent2 (10) -> agent3 (20) -> agent1 (30)
		expect(result.injectPrompt).toContain('[agent2]');
		expect(result.injectPrompt).toContain('[agent3]');
		expect(result.injectPrompt).toContain('[agent1]');
		
		// Verify order in the combined string
		const prompt = result.injectPrompt!;
		const idx2 = prompt.indexOf('[agent2]');
		const idx3 = prompt.indexOf('[agent3]');
		const idx1 = prompt.indexOf('[agent1]');
		expect(idx2).toBeLessThan(idx3);
		expect(idx3).toBeLessThan(idx1);
	});

	it('registers and retrieves agents', () => {
		const agent = createMockAgent('test', 10);
		runner.registerAgent(agent);
		expect(runner.hasAgent('test')).toBe(true);
		expect(runner.hasAgent('nonexistent')).toBe(false);
	});

	it('unregisters agents', () => {
		const agent = createMockAgent('test', 10);
		runner.registerAgent(agent);
		expect(runner.hasAgent('test')).toBe(true);
		
		runner.unregisterAgent('test');
		expect(runner.hasAgent('test')).toBe(false);
	});

	it('combines injectPrompt from all agents', async () => {
		runner.registerAgent(createMockAgent('a', 10));
		runner.registerAgent(createMockAgent('b', 20));

		const result = await runner.onBeforeSend(mockContext);
		expect(result.injectPrompt).toBe('[a] Priority 10\n\n[b] Priority 20');
	});

	it('combines updatedState from all agents', async () => {
		runner.registerAgent(createMockAgent('a', 10));
		runner.registerAgent(createMockAgent('b', 20));

		const result = await runner.onAfterReceive(mockContext, 'response');
		expect(result.updatedState).toBeDefined();
	});
});
