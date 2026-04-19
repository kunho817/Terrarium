import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneState } from '$lib/types/scene';

const sceneStatesStore: Map<string, SceneState> = new Map();

vi.mock('$lib/storage/agent-states', () => ({
	getSceneState: vi.fn(async (sessionId: string) => sceneStatesStore.get(sessionId) || null),
	updateSceneState: vi.fn(async (sessionId: string, partial: Partial<SceneState>) => {
		const existing = sceneStatesStore.get(sessionId);
		const now = Date.now();
		if (existing) {
			sceneStatesStore.set(sessionId, {
				...existing,
				...partial,
				lastUpdated: now
			});
		} else {
			sceneStatesStore.set(sessionId, {
				location: partial.location ?? '',
				participatingCharacters: partial.participatingCharacters ?? [],
				mood: partial.mood ?? '',
				time: partial.time ?? '',
				environmentalNotes: partial.environmentalNotes ?? '',
				variables: {},
				lastUpdated: now
			});
		}
	}),
	deleteSceneState: vi.fn(async (sessionId: string) => {
		sceneStatesStore.delete(sessionId);
	})
}));

import { SceneStateAgent, parseSceneOutput, formatScenePrompt } from '$lib/core/agents/scene-state-agent';
import type { AgentContext } from '$lib/types/agent';

describe('SceneStateAgent', () => {
	let agent: SceneStateAgent;
	let mockContext: AgentContext;
	const sessionId = 'test-session-scene-state';

	beforeEach(() => {
		sceneStatesStore.clear();
		agent = new SceneStateAgent();
		mockContext = {
			sessionId,
			cardId: 'test-card',
			cardType: 'character',
			messages: [],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('scene-state');
		expect(agent.priority).toBe(30);
	});

	it('creates initial scene state when none exists', async () => {
		await agent.init(mockContext);
		
		const state = sceneStatesStore.get(sessionId);
		expect(state).toBeDefined();
		expect(state?.location).toBe('');
	});

	it('formats injectPrompt from scene state', async () => {
		await agent.init(mockContext);
		
		const result = await agent.onBeforeSend(mockContext);
		
		expect(result.injectPrompt).toBeUndefined();
	});

	it('returns empty result from onAfterReceive when no model is configured', async () => {
		await agent.init(mockContext);
		
		const result = await agent.onAfterReceive(mockContext, 
			'Elara walked into the Rusty Tankard Inn. The atmosphere was tense.');
		
		expect(result).toBeDefined();
		expect(result.updatedState).toBeUndefined();
	});
});

describe('parseSceneOutput', () => {
	it('parses valid JSON with all fields', () => {
		const input = '{"location":"Rusty Tankard Inn","characters":["Elara","Kai"],"atmosphere":"tense","timeOfDay":"evening","environmentalNotes":"rain outside"}';
		const result = parseSceneOutput(input);
		expect(result).toEqual({
			location: 'Rusty Tankard Inn',
			characters: ['Elara', 'Kai'],
			atmosphere: 'tense',
			timeOfDay: 'evening',
			environmentalNotes: 'rain outside'
		});
	});

	it('returns null for invalid JSON', () => {
		expect(parseSceneOutput('not json')).toBeNull();
	});

	it('extracts JSON from surrounding text', () => {
		const input = 'Here is the scene: {"location":"Inn","characters":[],"atmosphere":"","timeOfDay":"","environmentalNotes":""} end.';
		const result = parseSceneOutput(input);
		expect(result?.location).toBe('Inn');
	});

	it('uses empty strings for missing fields', () => {
		const input = '{"location":"Test"}';
		const result = parseSceneOutput(input);
		expect(result?.location).toBe('Test');
		expect(result?.characters).toEqual([]);
		expect(result?.atmosphere).toBe('');
	});
});

describe('formatScenePrompt', () => {
	it('returns undefined for empty state', () => {
		const result = formatScenePrompt({
			location: '',
			participatingCharacters: [],
			mood: '',
			time: '',
			environmentalNotes: '',
			variables: {},
			lastUpdated: 0
		});
		expect(result).toBeUndefined();
	});

	it('formats scene with location', () => {
		const result = formatScenePrompt({
			location: 'Rusty Tankard Inn',
			participatingCharacters: [],
			mood: '',
			time: '',
			environmentalNotes: '',
			variables: {},
			lastUpdated: 0
		});
		expect(result).toContain('[Scene]');
		expect(result).toContain('Location: Rusty Tankard Inn');
	});

	it('formats scene with all fields', () => {
		const result = formatScenePrompt({
			location: 'Inn',
			participatingCharacters: ['Elara', 'Kai'],
			mood: 'tense',
			time: 'evening',
			environmentalNotes: 'rain pattering',
			variables: {},
			lastUpdated: 0
		});
		expect(result).toContain('[Scene]');
		expect(result).toContain('Location: Inn');
		expect(result).toContain('Characters Present: Elara, Kai');
		expect(result).toContain('Atmosphere: tense');
		expect(result).toContain('Time of Day: evening');
		expect(result).toContain('Environment: rain pattering');
	});
});
