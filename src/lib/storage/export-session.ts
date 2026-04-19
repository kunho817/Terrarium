import type { ChatSession, SessionsFile } from '$lib/types/session';
import type { Message } from '$lib/types';
import type { SceneState } from '$lib/types/scene';
import { StorageError } from '$lib/errors/error-types';
import { readJson, existsPath } from './database';
import { PATHS } from './paths';

export interface SessionExport {
  version: 1;
  exportedAt: number;
  card: { id: string; name: string; type: 'character' | 'world' };
  session: ChatSession;
  messages: Message[];
  scene: SceneState | null;
}

export async function buildSessionExport(
  characterId: string,
  sessionId: string,
  cardName: string,
  cardType: 'character' | 'world',
): Promise<SessionExport> {
  const messages = await readJson<Message[]>(PATHS.sessionMessages(characterId, sessionId)).catch(() => [] as Message[]);
  let scene: SceneState | null = null;
  if (await existsPath(PATHS.sessionScene(characterId, sessionId))) {
    scene = await readJson<SceneState>(PATHS.sessionScene(characterId, sessionId)).catch(() => null);
  }

  const raw = await readJson<SessionsFile | ChatSession[]>(PATHS.sessionsIndex(characterId)).catch(() => ({ sessions: [] }));
  const sessions = Array.isArray(raw) ? raw : raw.sessions;
  const session = sessions.find(s => s.id === sessionId);
  if (!session) {
    throw new StorageError('buildSessionExport', `Session ${sessionId} not found for character ${characterId}`);
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    card: { id: characterId, name: cardName, type: cardType },
    session,
    messages,
    scene,
  };
}

export function serializeExport(exp: SessionExport): string {
  return JSON.stringify(exp, null, 2);
}
