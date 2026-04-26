import type { ChatSession, Message, SceneState, SessionsFile } from '$lib/types';
import { makeSessionId, makeCharacterId } from '$lib/types/branded';
import { readJson, writeJsonAtomic, ensureDir, listDirs, removePath, existsPath } from './database';
import { PATHS } from './paths';
import { deleteMemoriesForSession } from './memories';
import { deleteSessionState } from './session-agent-state';
import { getDb, persist } from './db';
import { memorySyncStore } from '$lib/stores/memory-sync';

async function readSessionsFile(characterId: string): Promise<SessionsFile> {
	const indexPath = PATHS.sessionsIndex(characterId);
	if (!(await existsPath(indexPath))) {
		return { sessions: [] };
	}
	try {
		const data = await readJson<SessionsFile | ChatSession[]>(indexPath);
		if (Array.isArray(data)) {
			return { sessions: data };
		}
		return data;
	} catch {
		return { sessions: [] };
	}
}

async function writeSessionsFile(characterId: string, file: SessionsFile): Promise<void> {
	await writeJsonAtomic(PATHS.sessionsIndex(characterId), file);
}

export async function migrateLegacyChat(characterId: string): Promise<void> {
	const legacyMsgPath = PATHS.chatMessages(characterId);
	if (!(await existsPath(legacyMsgPath))) return;

	let messages: Message[] = [];
	let scene: SceneState | null = null;

	try {
		messages = await readJson<Message[]>(legacyMsgPath);
	} catch {
		messages = [];
	}

	try {
		scene = await readJson<SceneState>(PATHS.chatScene(characterId));
	} catch {
		scene = null;
	}

	const sessionId = makeSessionId(crypto.randomUUID());
	const now = Date.now();
	const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

	const session: ChatSession = {
		id: sessionId,
		characterId: makeCharacterId(characterId),
		name: 'Chat',
		createdAt: now,
		lastMessageAt: lastMsg?.timestamp ?? now,
		preview: lastMsg ? lastMsg.content.slice(0, 80) : '',
		cardType: undefined,
	};

	await ensureDir(PATHS.sessionDir(characterId, sessionId));
	await writeJsonAtomic(PATHS.sessionMessages(characterId, sessionId), messages);
	if (scene) {
		await writeJsonAtomic(PATHS.sessionScene(characterId, sessionId), scene);
	}
	await writeSessionsFile(characterId, { sessions: [session] });

	await removePath(legacyMsgPath);
	const legacyScenePath = PATHS.chatScene(characterId);
	if (await existsPath(legacyScenePath)) {
		await removePath(legacyScenePath);
	}
}

export async function listSessions(characterId: string): Promise<ChatSession[]> {
	if (!(await existsPath(PATHS.sessionsIndex(characterId)))) {
		await migrateLegacyChat(characterId);
	}

	const file = await readSessionsFile(characterId);
	return file.sessions;
}

export async function createSession(
	characterId: string,
	name?: string,
	cardType?: 'character' | 'world',
): Promise<ChatSession> {
	const file = await readSessionsFile(characterId);
	const now = Date.now();
	const session: ChatSession = {
		id: makeSessionId(crypto.randomUUID()),
		characterId: makeCharacterId(characterId),
		name: name ?? `Chat ${file.sessions.length + 1}`,
		createdAt: now,
		lastMessageAt: now,
		preview: '',
		cardType,
	};

	file.sessions.push(session);
	await ensureDir(PATHS.characterChatDir(characterId));
	await ensureDir(PATHS.sessionDir(characterId, session.id));
	await writeSessionsFile(characterId, file);
	return session;
}

export async function updateSession(
	characterId: string,
	sessionId: string,
	patch: Partial<ChatSession>,
): Promise<void> {
	const file = await readSessionsFile(characterId);
	const idx = file.sessions.findIndex((s) => s.id === sessionId);
	if (idx === -1) return;
	file.sessions[idx] = { ...file.sessions[idx], ...patch };
	await writeSessionsFile(characterId, file);
}

export async function deleteSession(
	characterId: string,
	sessionId: string,
): Promise<void> {
	await removePath(PATHS.sessionDir(characterId, sessionId));
	await Promise.all([
		deleteMemoriesForSession(sessionId),
		deleteSessionState(sessionId),
	]);

	const file = await readSessionsFile(characterId);
	file.sessions = file.sessions.filter((s) => s.id !== sessionId);
	await writeSessionsFile(characterId, file);
	memorySyncStore.bump();
}

export async function listArchivedSessions(characterId: string): Promise<ChatSession[]> {
	const file = await readSessionsFile(characterId);
	return file.archivedSessions ?? [];
}

export async function archiveSession(characterId: string, sessionId: string): Promise<void> {
	const file = await readSessionsFile(characterId);
	const idx = file.sessions.findIndex((s) => s.id === sessionId);
	if (idx === -1) return;

	const [session] = file.sessions.splice(idx, 1);
	file.archivedSessions = [...(file.archivedSessions ?? []), session];
	await writeSessionsFile(characterId, file);

	const srcDir = PATHS.sessionDir(characterId, sessionId);
	const destDir = PATHS.sessionArchiveDir(characterId, sessionId);
	if (await existsPath(srcDir)) {
		await ensureDir(destDir);
		const { readDir, readTextFile, writeTextFile, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
		const BASE = { baseDir: BaseDirectory.AppData };
		const entries = await readDir(srcDir, BASE);
		for (const entry of entries) {
			if (!entry.isDirectory) {
				const content = await readTextFile(`${srcDir}/${entry.name}`, BASE);
				await writeTextFile(`${destDir}/${entry.name}`, content, BASE);
			}
		}
		await remove(srcDir, { ...BASE, recursive: true });
	}
}

export async function restoreSession(characterId: string, sessionId: string): Promise<void> {
	const file = await readSessionsFile(characterId);
	const archived = file.archivedSessions ?? [];
	const idx = archived.findIndex((s) => s.id === sessionId);
	if (idx === -1) return;

	const [session] = archived.splice(idx, 1);
	file.archivedSessions = archived.length > 0 ? archived : undefined;
	file.sessions.push(session);
	await writeSessionsFile(characterId, file);

	const srcDir = PATHS.sessionArchiveDir(characterId, sessionId);
	const destDir = PATHS.sessionDir(characterId, sessionId);
	if (await existsPath(srcDir)) {
		await ensureDir(PATHS.sessionDir(characterId, sessionId));
		const { readDir, readTextFile, writeTextFile, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
		const BASE = { baseDir: BaseDirectory.AppData };
		const entries = await readDir(srcDir, BASE);
		for (const entry of entries) {
			if (!entry.isDirectory) {
				const content = await readTextFile(`${srcDir}/${entry.name}`, BASE);
				await writeTextFile(`${destDir}/${entry.name}`, content, BASE);
			}
		}
		await remove(srcDir, { ...BASE, recursive: true });
	}
}

export async function permanentDeleteSession(characterId: string, sessionId: string): Promise<void> {
	const file = await readSessionsFile(characterId);
	const archived = file.archivedSessions ?? [];
	file.archivedSessions = archived.filter((s) => s.id !== sessionId);
	if (file.archivedSessions.length === 0) file.archivedSessions = undefined;
	await writeSessionsFile(characterId, file);
	await Promise.all([
		removePath(PATHS.sessionArchiveDir(characterId, sessionId)),
		deleteMemoriesForSession(sessionId),
		deleteSessionState(sessionId),
	]);
	memorySyncStore.bump();
}

export async function resetSessionData(sessionId: string): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM embeddings WHERE memory_id IN (SELECT id FROM memories WHERE session_id = ?)', [sessionId]);
	db.run('DELETE FROM memories WHERE session_id = ?', [sessionId]);
	db.run('DELETE FROM summaries WHERE session_id = ?', [sessionId]);
	db.run('DELETE FROM scene_states WHERE session_id = ?', [sessionId]);
	db.run('DELETE FROM character_states WHERE session_id = ?', [sessionId]);
	db.run('DELETE FROM session_agent_state WHERE session_id = ?', [sessionId]);
	try { await persist(); } catch {}
	memorySyncStore.bump();
}
