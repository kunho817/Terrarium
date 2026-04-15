/**
 * Chat repository — handles persistence for chat store.
 */

import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import * as chatStorage from '$lib/storage/chats';
import type { Message } from '$lib/types';

export const chatRepo = {
  /**
   * Load messages for a specific character and session.
   */
  async loadSession(characterId: string, sessionId: string): Promise<void> {
    chatStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const messages = await chatStorage.loadMessages(characterId, sessionId);
      chatStore.set({
        chatId: characterId,
        sessionId,
        messages,
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    } catch (error) {
      chatStore.set({
        chatId: characterId,
        sessionId,
        messages: [],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    }
  },

  /**
   * Legacy compat: loadChat migrates to session-aware automatically.
   * Loads the most recent session for the character, or creates one.
   */
  async loadChat(chatId: string): Promise<void> {
    chatStore.update((s) => ({ ...s, isLoading: true }));
    try {
      await chatStorage.listSessions(chatId); // triggers migration
      const sessions = await chatStorage.listSessions(chatId);
      let sessionId: string;

      if (sessions.length > 0) {
        // Pick most recent
        sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        sessionId = sessions[0].id;
      } else {
        const session = await chatStorage.createSession(chatId);
        sessionId = session.id;
      }

      const messages = await chatStorage.loadMessages(chatId, sessionId);
      chatStore.set({
        chatId,
        sessionId,
        messages,
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    } catch (error) {
      chatStore.set({
        chatId: null,
        sessionId: null,
        messages: [],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    }
  },

  /**
   * Save current messages to storage.
   */
  async saveMessages(): Promise<void> {
    const state = get(chatStore);
    if (state.chatId && state.sessionId) {
      await chatStorage.saveMessages(state.chatId, state.sessionId, state.messages);
    }
  },

  /**
   * Create a new session for a character.
   */
  async createSession(characterId: string): Promise<string> {
    const session = await chatStorage.createSession(characterId);
    return session.id;
  },

  /**
   * Load a specific session by ID.
   */
  async loadSessionById(characterId: string, sessionId: string): Promise<void> {
    await this.loadSession(characterId, sessionId);
  },
};
