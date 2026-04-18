import type { Message } from '$lib/types';
import { readJson, writeJsonAtomic, ensureDir } from './database';
import { PATHS } from './paths';
import { listSessions, createSession, migrateLegacyChat } from './sessions';
import { updateSession } from './sessions';

export async function loadMessages(
	characterId: string,
	sessionId: string,
): Promise<Message[]> {
	try {
		return await readJson<Message[]>(PATHS.sessionMessages(characterId, sessionId));
	} catch {
		return [];
	}
}

export async function saveMessages(
	characterId: string,
	sessionId: string,
	messages: Message[],
): Promise<void> {
	await ensureDir(PATHS.sessionDir(characterId, sessionId));
	await writeJsonAtomic(PATHS.sessionMessages(characterId, sessionId), messages);

	const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
	if (lastMsg) {
		await updateSession(characterId, sessionId, {
			lastMessageAt: lastMsg.timestamp,
			preview: lastMsg.content.slice(0, 80),
		});
	}
}

export async function loadMessagesLegacy(chatId: string): Promise<Message[]> {
	await migrateLegacyChat(chatId);
	const sessions = await listSessions(chatId);
	if (sessions.length === 0) return [];
	return loadMessages(chatId, sessions[0].id);
}

export async function saveMessagesLegacy(
	chatId: string,
	messages: Message[],
): Promise<void> {
	await migrateLegacyChat(chatId);
	let sessions = await listSessions(chatId);
	if (sessions.length === 0) {
		const session = await createSession(chatId);
		sessions = [session];
	}
	await saveMessages(chatId, sessions[0].id, messages);
}
