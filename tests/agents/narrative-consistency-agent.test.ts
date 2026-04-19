import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneState } from '$lib/types/scene';

const sceneStatesStore: Map<string, SceneState> = new Map();
const memoriesStore: Map<string, any[]> = new Map();

vi.mock('$lib/storage/agent-states', () => ({
	getSceneState: vi.fn(async (sessionId: string) => sceneStatesStore.get(sessionId) || null),
}));

vi.mock('$lib/storage/memories', () => ({
	getMemoriesForSession: vi.fn(async (sessionId: string) => memoriesStore.get(sessionId) || []),
}));

import { NarrativeConsistencyAgent, buildConsistencyPrompt } from '$lib/core/agents/narrative-consistency-agent';

describe('NarrativeConsistencyAgent', () => {
	const agent = new NarrativeConsistencyAgent();

	beforeEach(() => {
		sceneStatesStore.clear();
		memoriesStore.clear();
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('narrative-consistency');
		expect(agent.priority).toBe(15);
	});

	it('returns empty result for non-world chats', async () => {
		sceneStatesStore.set('test', {
			location: 'Tavern',
			time: 'evening',
			mood: 'cheerful',
			participatingCharacters: ['Alice'],
			variables: {},
			environmentalNotes: '',
			lastUpdated: 0,
		});
		const result = await agent.onBeforeSend({
			sessionId: 'test' as any,
			cardId: 'test' as any,
			cardType: 'character',
			messages: [],
			scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
			turnNumber: 1,
			config: {} as any,
		});
		expect(result.injectPrompt).toBeUndefined();
	});
});

describe('buildConsistencyPrompt', () => {
	it('returns undefined when no scene or memories', () => {
		const result = buildConsistencyPrompt(
			{ location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
			[],
		);
		expect(result).toBeUndefined();
	});

	it('builds prompt from scene and memories', () => {
		const result = buildConsistencyPrompt(
			{ location: 'Tavern', time: 'evening', mood: 'cheerful', participatingCharacters: ['Alice', 'Bob'], variables: {}, environmentalNotes: '', lastUpdated: 0 },
			[
				{ content: 'Alice is in the forest', type: 'world_fact' },
				{ content: 'Bob hates alcohol', type: 'trait' },
			],
		);
		expect(result).toContain('Tavern');
		expect(result).toContain('Alice');
		expect(result).toContain('forest');
	});
});
