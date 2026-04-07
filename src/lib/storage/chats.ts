/**
 * Chat message and scene state CRUD operations.
 * Messages stored in chats/{id}/messages.json
 * Scene stored in chats/{id}/scene.json
 */

import type { Message, SceneState } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath, existsPath } from './database';
import { PATHS } from './paths';

export async function listChats(): Promise<string[]> {
  return listDirs(PATHS.chats);
}

export async function loadMessages(chatId: string): Promise<Message[]> {
  return readJson<Message[]>(PATHS.chatMessages(chatId));
}

export async function saveMessages(chatId: string, messages: Message[]): Promise<void> {
  await ensureDir(PATHS.chatDir(chatId));
  await writeJson(PATHS.chatMessages(chatId), messages);
}

export async function deleteChat(chatId: string): Promise<void> {
  await removePath(PATHS.chatDir(chatId));
}

export async function loadScene(chatId: string): Promise<SceneState | null> {
  if (!(await existsPath(PATHS.chatScene(chatId)))) {
    return null;
  }
  return readJson<SceneState>(PATHS.chatScene(chatId));
}

export async function saveScene(chatId: string, scene: SceneState): Promise<void> {
  await ensureDir(PATHS.chatDir(chatId));
  await writeJson(PATHS.chatScene(chatId), scene);
}
