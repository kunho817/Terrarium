/**
 * Chat session-aware storage operations.
 *
 * Storage structure:
 *   chats/{characterId}/sessions.json          — session index (ChatSession[])
 *   chats/{characterId}/{sessionId}/messages.json
 *   chats/{characterId}/{sessionId}/scene.json
 *
 * Legacy structure (auto-migrated):
 *   chats/{characterId}/messages.json
 *   chats/{characterId}/scene.json
 */

import type { Message, SceneState, ChatSession } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath, existsPath } from './database';
import { PATHS } from './paths';

// ── Legacy migration ────────────────────────────────────────────────────────

/**
 * Detect and migrate legacy flat chat structure to session-aware structure.
 * Called lazily when sessions.json doesn't exist but legacy files do.
 */
async function migrateLegacyChat(characterId: string): Promise<void> {
  const legacyMsgPath = PATHS.chatMessages(characterId);
  if (!(await existsPath(legacyMsgPath))) return;

  // Read legacy data before creating new structure
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

  // Create new session
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  const session: ChatSession = {
    id: sessionId,
    characterId,
    name: 'Chat',
    createdAt: now,
    lastMessageAt: lastMsg?.timestamp ?? now,
    preview: lastMsg ? lastMsg.content.slice(0, 80) : '',
  };

  // Write new structure
  await ensureDir(PATHS.sessionDir(characterId, sessionId));
  await writeJson(PATHS.sessionMessages(characterId, sessionId), messages);
  if (scene) {
    await writeJson(PATHS.sessionScene(characterId, sessionId), scene);
  }
  await writeJson(PATHS.sessionsIndex(characterId), [session]);

  // Remove legacy files (after new structure is confirmed written)
  await removePath(legacyMsgPath);
  const legacyScenePath = PATHS.chatScene(characterId);
  if (await existsPath(legacyScenePath)) {
    await removePath(legacyScenePath);
  }
}

// ── Session CRUD ────────────────────────────────────────────────────────────

export async function listSessions(characterId: string): Promise<ChatSession[]> {
  // Auto-migrate legacy if needed
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
): Promise<ChatSession> {
  const sessions = await listSessions(characterId);
  const now = Date.now();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    characterId,
    name: name ?? `Chat ${sessions.length + 1}`,
    createdAt: now,
    lastMessageAt: now,
    preview: '',
  };

  sessions.push(session);
  await ensureDir(PATHS.characterChatDir(characterId));
  await ensureDir(PATHS.sessionDir(characterId, session.id));
  await writeJson(PATHS.sessionsIndex(characterId), sessions);
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
  await writeJson(PATHS.sessionsIndex(characterId), sessions);
}

export async function deleteSession(
  characterId: string,
  sessionId: string,
): Promise<void> {
  // Remove session files
  await removePath(PATHS.sessionDir(characterId, sessionId));

  // Update index
  const sessions = await listSessions(characterId);
  const filtered = sessions.filter((s) => s.id !== sessionId);
  await writeJson(PATHS.sessionsIndex(characterId), filtered);
}

// ── Messages ────────────────────────────────────────────────────────────────

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
  await writeJson(PATHS.sessionMessages(characterId, sessionId), messages);

  // Update session metadata
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  if (lastMsg) {
    await updateSession(characterId, sessionId, {
      lastMessageAt: lastMsg.timestamp,
      preview: lastMsg.content.slice(0, 80),
    });
  }
}

// ── Scene ───────────────────────────────────────────────────────────────────

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
  await writeJson(PATHS.sessionScene(characterId, sessionId), scene);
}

// ── Legacy compatibility (for gradual migration) ───────────────────────────

/** List all character IDs that have chat data */
export async function listChats(): Promise<string[]> {
  return listDirs(PATHS.chats);
}

/** Legacy: load messages by chatId (=characterId). Auto-migrates if needed. */
export async function loadMessagesLegacy(chatId: string): Promise<Message[]> {
  await migrateLegacyChat(chatId);
  const sessions = await listSessions(chatId);
  if (sessions.length === 0) return [];
  return loadMessages(chatId, sessions[0].id);
}

/** Legacy: save messages by chatId. Auto-migrates if needed. */
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

/** Legacy: load scene by chatId */
export async function loadSceneLegacy(chatId: string): Promise<SceneState | null> {
  await migrateLegacyChat(chatId);
  const sessions = await listSessions(chatId);
  if (sessions.length === 0) return null;
  return loadScene(chatId, sessions[0].id);
}

/** Legacy: save scene by chatId */
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

/** Legacy: delete entire chat directory for a character */
export async function deleteChat(chatId: string): Promise<void> {
  await removePath(PATHS.characterChatDir(chatId));
}
