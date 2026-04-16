import { describe, it, expect, vi, beforeEach } from 'vitest';

const sceneStatesStore: Map<string, import('$lib/types/agent-state').SceneState> = new Map();
const characterStatesStore: Map<string, import('$lib/types/agent-state').CharacterState> = new Map();

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

import {
	getSceneState,
	updateSceneState,
	deleteSceneState,
	getCharacterStates,
	getCharacterState,
	updateCharacterState,
	deleteCharacterState
} from '$lib/storage/agent-states';

const sessionId = 'test-session-agent-states';

describe('Agent States Storage', () => {
	beforeEach(() => {
		sceneStatesStore.clear();
		characterStatesStore.clear();
	});

	describe('Scene State', () => {
		it('returns null when no scene state exists', async () => {
			const state = await getSceneState(sessionId);
			expect(state).toBeNull();
		});

		it('creates and retrieves scene state', async () => {
			await updateSceneState(sessionId, {
				location: 'Test Location',
				characters: ['Alice', 'Bob'],
				atmosphere: 'Test atmosphere',
				timeOfDay: 'Morning',
				environmentalNotes: 'Test notes'
			});

			const state = await getSceneState(sessionId);
			expect(state).not.toBeNull();
			expect(state?.location).toBe('Test Location');
			expect(state?.characters).toEqual(['Alice', 'Bob']);
			expect(state?.atmosphere).toBe('Test atmosphere');
		});

		it('updates existing scene state', async () => {
			await updateSceneState(sessionId, {
				location: 'Initial Location',
				characters: ['Alice'],
				atmosphere: 'Initial',
				timeOfDay: 'Morning',
				environmentalNotes: ''
			});

			await updateSceneState(sessionId, {
				location: 'Updated Location',
				characters: ['Alice', 'Bob']
			});

			const state = await getSceneState(sessionId);
			expect(state?.location).toBe('Updated Location');
			expect(state?.characters).toEqual(['Alice', 'Bob']);
			expect(state?.atmosphere).toBe('Initial');
		});

		it('deletes scene state', async () => {
			await updateSceneState(sessionId, {
				location: 'To Delete',
				characters: [],
				atmosphere: '',
				timeOfDay: '',
				environmentalNotes: ''
			});

			await deleteSceneState(sessionId);
			const state = await getSceneState(sessionId);
			expect(state).toBeNull();
		});
	});

	describe('Character States', () => {
		it('returns empty array when no character states exist', async () => {
			const states = await getCharacterStates(sessionId);
			expect(states).toEqual([]);
		});

		it('creates and retrieves character state', async () => {
			await updateCharacterState(sessionId, 'Elara', {
				emotion: 'alert',
				location: 'at the bar',
				inventory: ['amulet'],
				health: 'healthy',
				notes: 'Test notes'
			});

			const state = await getCharacterState(sessionId, 'Elara');
			expect(state).not.toBeNull();
			expect(state?.characterName).toBe('Elara');
			expect(state?.emotion).toBe('alert');
			expect(state?.inventory).toEqual(['amulet']);
		});

		it('updates existing character state', async () => {
			await updateCharacterState(sessionId, 'Kai', {
				emotion: 'nervous',
				location: 'by the door',
				inventory: ['pack'],
				health: 'healthy',
				notes: ''
			});

			await updateCharacterState(sessionId, 'Kai', {
				emotion: 'calm',
				inventory: ['pack', 'sword']
			});

			const state = await getCharacterState(sessionId, 'Kai');
			expect(state?.emotion).toBe('calm');
			expect(state?.inventory).toEqual(['pack', 'sword']);
			expect(state?.location).toBe('by the door');
		});

		it('retrieves all character states for session', async () => {
			await updateCharacterState(sessionId, 'Alice', {
				emotion: 'happy',
				location: 'here',
				inventory: [],
				health: 'healthy',
				notes: ''
			});
			await updateCharacterState(sessionId, 'Bob', {
				emotion: 'sad',
				location: 'there',
				inventory: [],
				health: 'healthy',
				notes: ''
			});

			const states = await getCharacterStates(sessionId);
			expect(states.length).toBe(2);
			expect(states.map(s => s.characterName).sort()).toEqual(['Alice', 'Bob']);
		});

		it('deletes character state', async () => {
			await updateCharacterState(sessionId, 'ToDelete', {
				emotion: 'neutral',
				location: '',
				inventory: [],
				health: 'healthy',
				notes: ''
			});

			await deleteCharacterState(sessionId, 'ToDelete');
			const state = await getCharacterState(sessionId, 'ToDelete');
			expect(state).toBeNull();
		});
	});
});
