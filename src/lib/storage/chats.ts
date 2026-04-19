export {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  migrateLegacyChat,
  listArchivedSessions,
  archiveSession,
  restoreSession,
  permanentDeleteSession,
} from './sessions';
export { loadMessages, saveMessages, loadMessagesLegacy, saveMessagesLegacy } from './messages';
export { loadScene, saveScene, loadSceneLegacy, saveSceneLegacy } from './scene-storage';
export { buildSessionExport, serializeExport } from './export-session';
export type { SessionExport } from './export-session';

import { listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listChats(): Promise<string[]> {
	return listDirs(PATHS.chats);
}

export async function deleteChat(chatId: string): Promise<void> {
	await removePath(PATHS.characterChatDir(chatId));
}
