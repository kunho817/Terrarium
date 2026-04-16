import { describe, it, expect, beforeEach } from 'vitest';
import { DirectorAgent } from '$lib/core/agents/director-agent';
import type { AgentContext } from '$lib/types/agent';

describe('DirectorAgent', () => {
	let agent: DirectorAgent;
	let mockContext: AgentContext;

	beforeEach(() => {
		agent = new DirectorAgent();
		mockContext = {
			sessionId: 'test-session',
			cardId: 'test-card',
			cardType: 'character',
			messages: [
				{ id: '1', role: 'user', content: 'Hello' } as any,
				{ id: '2', role: 'assistant', content: 'Hi there!' } as any
			],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('director');
		expect(agent.priority).toBe(20);
	});

	it('formats injectPrompt correctly', async () => {
		const result = await agent.onBeforeSend(mockContext);
		
		if (result.injectPrompt) {
			expect(result.injectPrompt).toContain('[Director]');
		}
	});

	it('returns empty result when director is disabled', async () => {
		const result = await agent.onBeforeSend({
			...mockContext,
			config: { 
				...mockContext.config,
				agentSettings: { director: { enabled: false } }
			} as any
		});
		expect(result.injectPrompt).toBeUndefined();
	});
});
