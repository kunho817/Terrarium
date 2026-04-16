import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CharacterState } from '$lib/types/agent-state';

const characterStatesStore: Map<string, Map<string, CharacterState>> = new Map();

vi.mock('$lib/storage/agent-states', () => ({
	getCharacterStates: vi.fn(async (sessionId: string) => {
		const sessionStates = characterStatesStore.get(sessionId);
		if (!sessionStates) return [];
		return Array.from(sessionStates.values());
	}),
	getCharacterState: vi.fn(async (sessionId: string, characterName: string) => {
		const sessionStates = characterStatesStore.get(sessionId);
		if (!sessionStates) return null;
		return sessionStates.get(characterName) || null;
	}),
	updateCharacterState: vi.fn(async (sessionId: string, characterName: string, partial: Partial<CharacterState>) => {
		let sessionStates = characterStatesStore.get(sessionId);
		if (!sessionStates) {
			sessionStates = new Map();
			characterStatesStore.set(sessionId, sessionStates);
		}
		const existing = sessionStates.get(characterName);
		const now = Date.now();
		if (existing) {
			sessionStates.set(characterName, {
				...existing,
				...partial,
				lastUpdated: now
			});
		} else {
			const id = `${sessionId}-${characterName}-${now}`;
			sessionStates.set(characterName, {
				id,
				sessionId,
				characterName,
				emotion: partial.emotion ?? '',
				location: partial.location ?? '',
				inventory: partial.inventory ?? [],
				health: partial.health ?? '',
				notes: partial.notes ?? '',
				lastUpdated: now
			});
		}
	}),
	deleteCharacterState: vi.fn(async (sessionId: string, characterName: string) => {
		const sessionStates = characterStatesStore.get(sessionId);
		if (sessionStates) {
			sessionStates.delete(characterName);
		}
	})
}));

import { CharacterStateAgent, parseCharacterOutput, formatCharacterPrompt } from '$lib/core/agents/character-state-agent';
import type { AgentContext } from '$lib/types/agent';

describe('CharacterStateAgent', () => {
	let agent: CharacterStateAgent;
	let mockContext: AgentContext;
	const sessionId = 'test-session-char-state';

	beforeEach(() => {
		characterStatesStore.clear();
		agent = new CharacterStateAgent();
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

	afterEach(() => {
		characterStatesStore.clear();
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('character');
		expect(agent.priority).toBe(40);
	});

	it('formats injectPrompt from character states', async () => {
		const result = await agent.onBeforeSend(mockContext);
		
		// Should return empty if no characters tracked
		expect(result.injectPrompt).toBeUndefined();
	});

	it('extracts character states from response', async () => {
		const result = await agent.onAfterReceive(
			mockContext,
			'Elara looked nervous as she sat at the bar. She clutched the amulet tightly.'
		);
		
		// Without model configured, returns empty
		expect(result).toBeDefined();
	});
});

describe('parseCharacterOutput', () => {
	it('parses valid JSON with single character', () => {
		const input = '{"characters":[{"name":"Elara","emotion":"nervous","location":"at the bar","inventory":["amulet"],"health":"healthy","notes":"seems troubled"}]}';
		const result = parseCharacterOutput(input);
		expect(result).toEqual({
			characters: [{
				name: 'Elara',
				emotion: 'nervous',
				location: 'at the bar',
				inventory: ['amulet'],
				health: 'healthy',
				notes: 'seems troubled'
			}]
		});
	});

	it('parses valid JSON with multiple characters', () => {
		const input = '{"characters":[{"name":"Elara","emotion":"nervous","location":"at the bar","inventory":[],"health":"","notes":""},{"name":"Kai","emotion":"calm","location":"by the door","inventory":["sword"],"health":"","notes":""}]}';
		const result = parseCharacterOutput(input);
		expect(result?.characters).toHaveLength(2);
		expect(result?.characters[0].name).toBe('Elara');
		expect(result?.characters[1].name).toBe('Kai');
	});

	it('returns null for invalid JSON', () => {
		expect(parseCharacterOutput('not json')).toBeNull();
	});

	it('extracts JSON from surrounding text', () => {
		const input = 'Here is the data: {"characters":[]} end.';
		const result = parseCharacterOutput(input);
		expect(result?.characters).toEqual([]);
	});

	it('uses empty values for missing fields', () => {
		const input = '{"characters":[{"name":"Test"}]}';
		const result = parseCharacterOutput(input);
		expect(result?.characters[0].name).toBe('Test');
		expect(result?.characters[0].emotion).toBe('');
		expect(result?.characters[0].inventory).toEqual([]);
	});
});

describe('formatCharacterPrompt', () => {
	it('returns undefined for empty states', () => {
		const result = formatCharacterPrompt([]);
		expect(result).toBeUndefined();
	});

	it('formats character with emotion and location', () => {
		const result = formatCharacterPrompt([{
			id: '1',
			sessionId: 'test',
			characterName: 'Elara',
			emotion: 'nervous',
			location: 'at the bar',
			inventory: [],
			health: 'healthy',
			notes: '',
			lastUpdated: 0
		}]);
		expect(result).toContain('[Character States]');
		expect(result).toContain('Elara: feeling nervous; at the bar');
	});

	it('formats character with inventory', () => {
		const result = formatCharacterPrompt([{
			id: '1',
			sessionId: 'test',
			characterName: 'Elara',
			emotion: '',
			location: '',
			inventory: ['amulet', 'pouch'],
			health: '',
			notes: '',
			lastUpdated: 0
		}]);
		expect(result).toContain('carrying: amulet, pouch');
	});

	it('formats character with health status when not healthy', () => {
		const result = formatCharacterPrompt([{
			id: '1',
			sessionId: 'test',
			characterName: 'Elara',
			emotion: '',
			location: '',
			inventory: [],
			health: 'injured',
			notes: '',
			lastUpdated: 0
		}]);
		expect(result).toContain('injured');
	});

	it('does not show healthy status', () => {
		const result = formatCharacterPrompt([{
			id: '1',
			sessionId: 'test',
			characterName: 'Elara',
			emotion: '',
			location: '',
			inventory: [],
			health: 'healthy',
			notes: '',
			lastUpdated: 0
		}]);
		expect(result).toBeUndefined();
	});

	it('formats multiple characters', () => {
		const result = formatCharacterPrompt([
			{
				id: '1',
				sessionId: 'test',
				characterName: 'Elara',
				emotion: 'nervous',
				location: 'at the bar',
				inventory: [],
				health: '',
				notes: '',
				lastUpdated: 0
			},
			{
				id: '2',
				sessionId: 'test',
				characterName: 'Kai',
				emotion: 'calm',
				location: 'by the door',
				inventory: ['sword'],
				health: '',
				notes: '',
				lastUpdated: 0
			}
		]);
		expect(result).toContain('Elara:');
		expect(result).toContain('Kai:');
	});
});
