import { getDb } from './db';
import type { SceneState, CharacterState } from '$lib/types/agent-state';

export async function getSceneState(sessionId: string): Promise<SceneState | null> {
	const db = await getDb();
	const result = db.exec(
		'SELECT session_id, location, characters, atmosphere, time_of_day, environmental_notes, last_updated FROM scene_states WHERE session_id = ?',
		[sessionId]
	);

	if (result.length === 0 || result[0].values.length === 0) {
		return null;
	}

	const row = result[0].values[0];
	return {
		sessionId: row[0] as string,
		location: row[1] as string,
		characters: JSON.parse(row[2] as string) as string[],
		atmosphere: row[3] as string,
		timeOfDay: row[4] as string,
		environmentalNotes: row[5] as string,
		lastUpdated: row[6] as number
	};
}

export async function updateSceneState(
	sessionId: string,
	partial: Partial<Omit<SceneState, 'sessionId' | 'lastUpdated'>>
): Promise<void> {
	const existing = await getSceneState(sessionId);
	const now = Date.now();

	if (existing) {
		const updated = {
			location: partial.location ?? existing.location,
			characters: partial.characters ?? existing.characters,
			atmosphere: partial.atmosphere ?? existing.atmosphere,
			timeOfDay: partial.timeOfDay ?? existing.timeOfDay,
			environmentalNotes: partial.environmentalNotes ?? existing.environmentalNotes
		};

		const db = await getDb();
		db.run(
			'UPDATE scene_states SET location = ?, characters = ?, atmosphere = ?, time_of_day = ?, environmental_notes = ?, last_updated = ? WHERE session_id = ?',
			[
				updated.location,
				JSON.stringify(updated.characters),
				updated.atmosphere,
				updated.timeOfDay,
				updated.environmentalNotes,
				now,
				sessionId
			]
		);
	} else {
		const db = await getDb();
		db.run(
			'INSERT INTO scene_states (session_id, location, characters, atmosphere, time_of_day, environmental_notes, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[
				sessionId,
				partial.location ?? '',
				JSON.stringify(partial.characters ?? []),
				partial.atmosphere ?? '',
				partial.timeOfDay ?? '',
				partial.environmentalNotes ?? '',
				now
			]
		);
	}
}

export async function deleteSceneState(sessionId: string): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM scene_states WHERE session_id = ?', [sessionId]);
}

export async function getCharacterStates(sessionId: string): Promise<CharacterState[]> {
	const db = await getDb();
	const result = db.exec(
		'SELECT id, session_id, character_name, emotion, location, inventory, health, notes, last_updated FROM character_states WHERE session_id = ?',
		[sessionId]
	);

	if (result.length === 0 || result[0].values.length === 0) {
		return [];
	}

	return result[0].values.map((row: unknown[]) => ({
		id: row[0] as string,
		sessionId: row[1] as string,
		characterName: row[2] as string,
		emotion: row[3] as string,
		location: row[4] as string,
		inventory: JSON.parse(row[5] as string) as string[],
		health: row[6] as string,
		notes: row[7] as string,
		lastUpdated: row[8] as number
	}));
}

export async function getCharacterState(
	sessionId: string,
	characterName: string
): Promise<CharacterState | null> {
	const db = await getDb();
	const result = db.exec(
		'SELECT id, session_id, character_name, emotion, location, inventory, health, notes, last_updated FROM character_states WHERE session_id = ? AND character_name = ?',
		[sessionId, characterName]
	);

	if (result.length === 0 || result[0].values.length === 0) {
		return null;
	}

	const row = result[0].values[0];
	return {
		id: row[0] as string,
		sessionId: row[1] as string,
		characterName: row[2] as string,
		emotion: row[3] as string,
		location: row[4] as string,
		inventory: JSON.parse(row[5] as string) as string[],
		health: row[6] as string,
		notes: row[7] as string,
		lastUpdated: row[8] as number
	};
}

export async function updateCharacterState(
	sessionId: string,
	characterName: string,
	partial: Partial<Omit<CharacterState, 'id' | 'sessionId' | 'characterName' | 'lastUpdated'>>
): Promise<void> {
	const existing = await getCharacterState(sessionId, characterName);
	const now = Date.now();

	if (existing) {
		const updated = {
			emotion: partial.emotion ?? existing.emotion,
			location: partial.location ?? existing.location,
			inventory: partial.inventory ?? existing.inventory,
			health: partial.health ?? existing.health,
			notes: partial.notes ?? existing.notes
		};

		const db = await getDb();
		db.run(
			'UPDATE character_states SET emotion = ?, location = ?, inventory = ?, health = ?, notes = ?, last_updated = ? WHERE id = ?',
			[
				updated.emotion,
				updated.location,
				JSON.stringify(updated.inventory),
				updated.health,
				updated.notes,
				now,
				existing.id
			]
		);
	} else {
		const id = `${sessionId}-${characterName}-${now}`;
		const db = await getDb();
		db.run(
			'INSERT INTO character_states (id, session_id, character_name, emotion, location, inventory, health, notes, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[
				id,
				sessionId,
				characterName,
				partial.emotion ?? '',
				partial.location ?? '',
				JSON.stringify(partial.inventory ?? []),
				partial.health ?? '',
				partial.notes ?? '',
				now
			]
		);
	}
}

export async function deleteCharacterState(
	sessionId: string,
	characterName: string
): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM character_states WHERE session_id = ? AND character_name = ?', [
		sessionId,
		characterName
	]);
}
