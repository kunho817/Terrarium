/**
 * Chat repository — handles persistence for chat store.
 */

import { get } from 'svelte/store';
import { chatStore, type ChatState } from '$lib/stores/chat';
import * as chatStorage from '$lib/storage/chats';
import type { Message } from '$lib/types';

export const chatRepo = {
  /**
   * Load a chat session
   */
  async loadSession(characterId: string, sessionId: string): Promise<void> {
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
      console.error('Failed to load chat session:', error);
      chatStore.clear();
    }
  },

  /**
   * Save current messages to storage
   */
  async saveMessages(): Promise<void> {
    const state = get(chatStore);
    if (!state.chatId || !state.sessionId) return;

    try {
      await chatStorage.saveMessages(state.chatId, state.sessionId, state.messages);
    } catch (error) {
      console.error('Failed to save messages:', error);
      throw error;
    }
  },

  /**
   * Create a new session
   */
  async createSession(characterId: string): Promise<string> {
    try {
      const session = await chatStorage.createSession(characterId);
      await this.loadSession(characterId, session.id);
      return session.id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }
};
