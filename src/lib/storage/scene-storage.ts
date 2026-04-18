import type { SceneState } from '$lib/types';
import { readJson, writeJsonAtomic, ensureDir, existsPath } from './database';
import { PATHS } from './paths';
import { listSessions, createSession, migrateLegacyChat } from './sessions';

export async function loadScene(
	characterId: string,
	sessionId: string,
): Promise<SceneState | null> {
	if (!(await existsPath(PATHS.sessionScene(characterId, sessionId)))) {
		return null;
	}
	return readJson<SceneState>(PATHS.sessionScene(characterId, sessionId));
}

export async function saveScene(
	characterId: string,
	sessionId: string,
	scene: SceneState,
): Promise<void> {
	await ensureDir(PATHS.sessionDir(characterId, sessionId));
	await writeJsonAtomic(PATHS.sessionScene(characterId, sessionId), scene);
}

export async function loadSceneLegacy(chatId: string): Promise<SceneState | null> {
	await migrateLegacyChat(chatId);
	const sessions = await listSessions(chatId);
	if (sessions.length === 0) return null;
	return loadScene(chatId, sessions[0].id);
}

export async function saveSceneLegacy(
	chatId: string,
	scene: SceneState,
): Promise<void> {
	await migrateLegacyChat(chatId);
	let sessions = await listSessions(chatId);
	if (sessions.length === 0) {
		const session = await createSession(chatId);
		sessions = [session];
	}
	await saveScene(chatId, sessions[0].id, scene);
}
