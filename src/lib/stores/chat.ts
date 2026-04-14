/**
 * Chat store — reactive state for current chat session.
 * Supports streaming message display and abort control.
 * Session-aware: tracks both characterId and sessionId.
 */

import { writable, get } from 'svelte/store';
import type { Message } from '$lib/types';
import * as chatStorage from '$lib/storage/chats';

interface ChatState {
  chatId: string | null;       // characterId
  sessionId: string | null;    // active session
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string | null;
  isStreaming: boolean;
}

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    chatId: null,
    sessionId: null,
    messages: [],
    isLoading: false,
    streamingMessage: null,
    isStreaming: false,
  });

  return {
    subscribe,

    async loadSession(characterId: string, sessionId: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const messages = await chatStorage.loadMessages(characterId, sessionId);
        set({
          chatId: characterId,
          sessionId,
          messages,
          isLoading: false,
          streamingMessage: null,
          isStreaming: false,
        });
      } catch {
        set({
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
    async loadChat(chatId: string) {
      update((s) => ({ ...s, isLoading: true }));
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
        set({
          chatId,
          sessionId,
          messages,
          isLoading: false,
          streamingMessage: null,
          isStreaming: false,
        });
      } catch {
        set({
          chatId: null,
          sessionId: null,
          messages: [],
          isLoading: false,
          streamingMessage: null,
          isStreaming: false,
        });
      }
    },

    addMessage(message: Message) {
      update((s) => ({ ...s, messages: [...s.messages, message] }));
    },

    updateLastMessage(message: Message) {
      update((s) => {
        if (s.messages.length === 0) return s;
        const messages = [...s.messages];
        messages[messages.length - 1] = message;
        return { ...s, messages };
      });
    },

    updateMessage(index: number, message: Message) {
      update((s) => {
        if (index < 0 || index >= s.messages.length) return s;
        const messages = [...s.messages];
        messages[index] = message;
        return { ...s, messages };
      });
    },

    truncateAfter(index: number) {
      update((s) => {
        if (index < 0 || index >= s.messages.length) return s;
        return { ...s, messages: s.messages.slice(0, index + 1) };
      });
    },

    setStreamingMessage(content: string) {
      update((s) => ({ ...s, streamingMessage: content, isStreaming: true }));
    },

    clearStreamingMessage() {
      update((s) => ({ ...s, streamingMessage: null, isStreaming: false }));
    },

    async save() {
      const state = get({ subscribe });
      if (state.chatId && state.sessionId) {
        await chatStorage.saveMessages(state.chatId, state.sessionId, state.messages);
      }
    },

    clear() {
      set({
        chatId: null,
        sessionId: null,
        messages: [],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    },
  };
}

export const chatStore = createChatStore();
