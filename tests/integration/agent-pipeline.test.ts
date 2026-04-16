import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SceneState, CharacterState } from '$lib/types/agent-state';

const sceneStatesStore: Map<string, SceneState> = new Map();
const characterStatesStore: Map<string, CharacterState> = new Map();

vi.mock('$lib/storage/db', () => ({
	getDb: vi.fn(async () => ({
		run(sql: string, params: unknown[]) {
			if (sql.includes('INSERT INTO scene_states')) {
				const [sessionId, location, charactersJson, atmosphere, timeOfDay, environmentalNotes, lastUpdated] = params as [string, string, string, string, string, string, number];
				sceneStatesStore.set(sessionId, {
					sessionId, location, characters: JSON.parse(charactersJson), atmosphere, timeOfDay, environmentalNotes, lastUpdated
				});
			} else if (sql.includes('UPDATE scene_states')) {
				const [location, charactersJson, atmosphere, timeOfDay, environmentalNotes, lastUpdated, sessionId] = params as [string, string, string, string, string, number, string];
				sceneStatesStore.set(sessionId, {
					sessionId, location, characters: JSON.parse(charactersJson), atmosphere, timeOfDay, environmentalNotes, lastUpdated
				});
			} else if (sql.includes('DELETE FROM scene_states')) {
				sceneStatesStore.delete(params[0] as string);
			} else if (sql.includes('INSERT INTO character_states')) {
				const [id, sessionId, characterName, emotion, location, inventoryJson, health, notes, lastUpdated] = params as [string, string, string, string, string, string, string, string, number];
				characterStatesStore.set(`${sessionId}:${characterName}`, {
					id, sessionId, characterName, emotion, location, inventory: JSON.parse(inventoryJson), health, notes, lastUpdated
				});
			} else if (sql.includes('UPDATE character_states')) {
				const [emotion, location, inventoryJson, health, notes, lastUpdated, id] = params as [string, string, string, string, string, number, string];
				for (const state of characterStatesStore.values()) {
					if (state.id === id) {
						state.emotion = emotion;
						state.location = location;
						state.inventory = JSON.parse(inventoryJson);
						state.health = health;
						state.notes = notes;
						state.lastUpdated = lastUpdated;
						break;
					}
				}
			} else if (sql.includes('DELETE FROM character_states WHERE session_id') && sql.includes('character_name')) {
				const [sessionId, characterName] = params as [string, string];
				characterStatesStore.delete(`${sessionId}:${characterName}`);
			} else if (sql.includes('DELETE FROM scene_states WHERE session_id')) {
				sceneStatesStore.delete(params[0] as string);
			} else if (sql.includes('DELETE FROM character_states WHERE session_id')) {
				const sessionId = params[0] as string;
				for (const key of characterStatesStore.keys()) {
					if (key.startsWith(`${sessionId}:`)) characterStatesStore.delete(key);
				}
			}
		},
		exec(sql: string, params: unknown[]) {
			if (sql.includes('FROM scene_states')) {
				const sessionId = params[0] as string;
				const state = sceneStatesStore.get(sessionId);
				if (state) {
					return [{ values: [[state.sessionId, state.location, JSON.stringify(state.characters), state.atmosphere, state.timeOfDay, state.environmentalNotes, state.lastUpdated]] }];
				}
				return [];
			}
			if (sql.includes('FROM character_states WHERE session_id = ? AND character_name = ?')) {
				const [sessionId, characterName] = params as [string, string];
				const state = characterStatesStore.get(`${sessionId}:${characterName}`);
				if (state) {
					return [{ values: [[state.id, state.sessionId, state.characterName, state.emotion, state.location, JSON.stringify(state.inventory), state.health, state.notes, state.lastUpdated]] }];
				}
				return [];
			}
			if (sql.includes('FROM character_states WHERE session_id = ?') && !sql.includes('character_name = ?')) {
				const sessionId = params[0] as string;
				const rows = [...characterStatesStore.values()]
					.filter(s => s.sessionId === sessionId)
					.map(s => [s.id, s.sessionId, s.characterName, s.emotion, s.location, JSON.stringify(s.inventory), s.health, s.notes, s.lastUpdated]);
				return rows.length ? [{ values: rows }] : [];
			}
			return [];
		}
	})),
	persist: vi.fn(),
	closeDb: vi.fn()
}));

vi.mock('$lib/stores/settings', () => ({
	settingsStore: {
		subscribe: vi.fn((fn) => {
			fn({
				defaultProvider: '',
				providers: {},
				memorySettings: {
					extractionBatchSize: 5,
					tokenBudget: 4096,
					topK: 15,
					summaryThreshold: 50,
					embeddingProvider: '',
					embeddingApiKey: '',
					embeddingModel: '',
				},
				agentSettings: {
					director: { enabled: false, mode: 'light' },
					scene: { enabled: false },
					character: { enabled: false }
				},
				modelSlots: {}
			});
			return () => {};
		})
	}
}));

import { AgentRunner } from '$lib/core/agents/agent-runner';
import { getSceneState, deleteSceneState, getCharacterStates, deleteCharacterState } from '$lib/storage/agent-states';
import type { AgentContext } from '$lib/types/agent';

describe('Agent Pipeline Integration', () => {
	let runner: AgentRunner;
	let context: AgentContext;
	const sessionId = 'integration-test-session';

	beforeEach(async () => {
		sceneStatesStore.clear();
		characterStatesStore.clear();
		
		runner = new AgentRunner();
		context = {
			sessionId,
			cardId: 'test-card',
			cardType: 'character',
			messages: [
				{ id: '1', role: 'user', content: 'I walk into the inn.' } as any
			],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
		
		await deleteSceneState(sessionId);
	});

	afterEach(async () => {
		await runner.shutdownAll();
		await deleteSceneState(sessionId);
		const chars = await getCharacterStates(sessionId);
		for (const c of chars) {
			await deleteCharacterState(sessionId, c.characterName);
		}
	});

	it('initializes all agents', async () => {
		await runner.initAll(context);
		expect(runner.hasAgent('memory')).toBe(true);
		expect(runner.hasAgent('director')).toBe(true);
		expect(runner.hasAgent('scene')).toBe(true);
		expect(runner.hasAgent('character')).toBe(true);
	});

	it('runs full pipeline onBeforeSend', async () => {
		await runner.initAll(context);
		
		const result = await runner.onBeforeSend(context);
		
		expect(result).toBeDefined();
	});

	it('runs full pipeline onAfterReceive', async () => {
		await runner.initAll(context);
		
		const response = 'Elara entered the Rusty Tankard Inn. She felt nervous.';
		const result = await runner.onAfterReceive(context, response);
		
		expect(result).toBeDefined();
	});

	it('agents execute in priority order', async () => {
		await runner.initAll(context);
		
		const agents = runner.getAgentsByPriority();
		
		expect(agents[0].id).toBe('memory');
		expect(agents[0].priority).toBe(10);
		
		expect(agents[1].id).toBe('director');
		expect(agents[1].priority).toBe(20);
		
		expect(agents[2].id).toBe('scene');
		expect(agents[2].priority).toBe(30);
		
		expect(agents[3].id).toBe('character');
		expect(agents[3].priority).toBe(40);
	});

	it('scene state agent initializes empty state', async () => {
		await runner.initAll(context);
		
		const state = await getSceneState(sessionId);
		expect(state).not.toBeNull();
		expect(state?.location).toBe('');
		expect(state?.characters).toEqual([]);
	});
});
