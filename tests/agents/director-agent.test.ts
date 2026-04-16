import { describe, it, expect, beforeEach } from 'vitest';
import { DirectorAgent, parseDirectorOutput, formatDirectorPrompt } from '$lib/core/agents/director-agent';
import type { AgentContext } from '$lib/types/agent';
import type { DirectorGuidance } from '$lib/types/agent-state';

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

	it('returns empty result when no model is configured', async () => {
		const result = await agent.onBeforeSend(mockContext);
		expect(result).toBeDefined();
		expect(result.injectPrompt).toBeUndefined();
	});
});

describe('parseDirectorOutput', () => {
	it('parses valid JSON with all fields', () => {
		const input = '{"sceneMandate":"test","requiredOutcomes":["a"],"forbiddenMoves":["b"],"emphasis":["c"],"targetPacing":"slow","pressureLevel":"high"}';
		const result = parseDirectorOutput(input);
		expect(result).toEqual({
			sceneMandate: 'test',
			requiredOutcomes: ['a'],
			forbiddenMoves: ['b'],
			emphasis: ['c'],
			targetPacing: 'slow',
			pressureLevel: 'high'
		});
	});

	it('returns null for invalid JSON', () => {
		expect(parseDirectorOutput('not json')).toBeNull();
	});

	it('returns null for missing required fields', () => {
		expect(parseDirectorOutput('{"sceneMandate":"test"}')).toBeNull();
	});

	it('uses defaults for optional fields', () => {
		const input = '{"sceneMandate":"test","requiredOutcomes":[],"forbiddenMoves":[]}';
		const result = parseDirectorOutput(input);
		expect(result?.targetPacing).toBe('normal');
		expect(result?.pressureLevel).toBe('medium');
		expect(result?.emphasis).toEqual([]);
	});

	it('extracts JSON from surrounding text', () => {
		const input = 'Here is the response: {"sceneMandate":"test","requiredOutcomes":["a"],"forbiddenMoves":["b"]} end.';
		const result = parseDirectorOutput(input);
		expect(result?.sceneMandate).toBe('test');
	});
});

describe('formatDirectorPrompt', () => {
	it('formats guidance with all fields', () => {
		const guidance: DirectorGuidance = {
			sceneMandate: 'Test mandate',
			requiredOutcomes: ['Outcome 1'],
			forbiddenMoves: ['Forbidden 1'],
			emphasis: ['Emphasis 1'],
			targetPacing: 'fast',
			pressureLevel: 'high'
		};
		const result = formatDirectorPrompt(guidance);
		expect(result).toContain('[Director]');
		expect(result).toContain('Scene Mandate: Test mandate');
		expect(result).toContain('Required Outcomes: Outcome 1');
		expect(result).toContain('Target Pacing: fast');
	});

	it('formats guidance without optional fields', () => {
		const guidance: DirectorGuidance = {
			sceneMandate: 'Test',
			requiredOutcomes: [],
			forbiddenMoves: [],
			emphasis: [],
			targetPacing: 'normal',
			pressureLevel: 'medium'
		};
		const result = formatDirectorPrompt(guidance);
		expect(result).toContain('[Director]');
		expect(result).toContain('Scene Mandate: Test');
		expect(result).not.toContain('Required Outcomes:');
	});
});
