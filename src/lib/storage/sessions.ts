import type { ChatSession, Message, SceneState } from '$lib/types';
import { makeSessionId, makeCharacterId } from '$lib/types/branded';
import { readJson, writeJsonAtomic, ensureDir, listDirs, removePath, existsPath } from './database';
import { PATHS } from './paths';

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
	await writeJsonAtomic(PATHS.sessionsIndex(characterId), [session]);

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

	try {
		return await readJson<ChatSession[]>(PATHS.sessionsIndex(characterId));
	} catch {
		return [];
	}
}

export async function createSession(
	characterId: string,
	name?: string,
	cardType?: 'character' | 'world',
): Promise<ChatSession> {
	const sessions = await listSessions(characterId);
	const now = Date.now();
		const session: ChatSession = {
		id: makeSessionId(crypto.randomUUID()),
		characterId: makeCharacterId(characterId),
		name: name ?? `Chat ${sessions.length + 1}`,
		createdAt: now,
		lastMessageAt: now,
		preview: '',
		cardType,
	};

	sessions.push(session);
	await ensureDir(PATHS.characterChatDir(characterId));
	await ensureDir(PATHS.sessionDir(characterId, session.id));
	await writeJsonAtomic(PATHS.sessionsIndex(characterId), sessions);
	return session;
}

export async function updateSession(
	characterId: string,
	sessionId: string,
	patch: Partial<ChatSession>,
): Promise<void> {
	const sessions = await listSessions(characterId);
	const idx = sessions.findIndex((s) => s.id === sessionId);
	if (idx === -1) return;
	sessions[idx] = { ...sessions[idx], ...patch };
	await writeJsonAtomic(PATHS.sessionsIndex(characterId), sessions);
}

export async function deleteSession(
	characterId: string,
	sessionId: string,
): Promise<void> {
	await removePath(PATHS.sessionDir(characterId, sessionId));

	const sessions = await listSessions(characterId);
	const filtered = sessions.filter((s) => s.id !== sessionId);
	await writeJsonAtomic(PATHS.sessionsIndex(characterId), filtered);
}
