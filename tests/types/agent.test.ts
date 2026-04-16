import { describe, it, expect } from 'vitest';
import type { Agent, AgentConfig, AgentResult, AgentContext } from '$lib/types/agent';

describe('Enhanced Agent Types', () => {
	it('Agent has priority field', () => {
		const agent: Agent = {
			id: 'test',
			name: 'Test Agent',
			priority: 10,
			init: async () => {},
			onBeforeSend: async () => ({}),
			onAfterReceive: async () => ({}),
			shutdown: async () => {}
		};
		expect(agent.priority).toBe(10);
	});

	it('AgentResult can include updatedState', () => {
		const result: AgentResult = {
			injectPrompt: '[Test] Content',
			updatedState: {
				scene: { location: 'New location' }
			}
		};
		expect(result.updatedState?.scene?.location).toBe('New location');
	});

	it('AgentConfig has all required fields', () => {
		const config: AgentConfig = {
			id: 'director',
			name: 'Director Agent',
			enabled: true,
			modelSlot: 'director',
			settings: { mode: 'strong' }
		};
		expect(config.enabled).toBe(true);
	});
});
