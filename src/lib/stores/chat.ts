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
    set,
    update,

    // Pure state helpers (no persistence)
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

    setSessionState(chatId: string | null, sessionId: string | null, messages: Message[]) {
      update((s) => ({ ...s, chatId, sessionId, messages, isLoading: false }));
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
