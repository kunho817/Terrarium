/**
 * Chat store — reactive state for current chat session.
 * Supports streaming message display and abort control.
 * Session-aware: tracks both characterId and sessionId.
 */

import { writable, get } from 'svelte/store';
import type { Message } from '$lib/types';
import type { CharacterId, SessionId } from '$lib/types/branded';
import * as chatStorage from '$lib/storage/chats';

interface ChatState {
  characterId: CharacterId | null;
  sessionId: SessionId | null;
  cardType: 'character' | 'world' | null;
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string | null;
  isStreaming: boolean;
}

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    characterId: null,
    sessionId: null,
    cardType: null,
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

    replaceMessage(target: Message, message: Message) {
      update((s) => {
        let index = -1;
        for (let i = s.messages.length - 1; i >= 0; i -= 1) {
          if (s.messages[i] === target) {
            index = i;
            break;
          }
        }
        if (index < 0) {
          for (let i = s.messages.length - 1; i >= 0; i -= 1) {
            const entry = s.messages[i];
            if (
              entry.timestamp === target.timestamp
              && entry.role === target.role
              && entry.content === target.content
            ) {
              index = i;
              break;
            }
          }
        }

        if (index < 0) return s;
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

    removeFrom(index: number) {
      update((s) => {
        if (index < 0 || index > s.messages.length) return s;
        return { ...s, messages: s.messages.slice(0, index) };
      });
    },

    setStreamingMessage(content: string) {
      update((s) => ({ ...s, streamingMessage: content, isStreaming: true }));
    },

    clearStreamingMessage() {
      update((s) => ({ ...s, streamingMessage: null, isStreaming: false }));
    },

    setSessionState(characterId: CharacterId | null, sessionId: SessionId | null, messages: Message[], cardType?: 'character' | 'world') {
      update((s) => ({ ...s, characterId, sessionId, messages, cardType: cardType ?? null, isLoading: false }));
    },

    clear() {
      set({
        characterId: null,
        sessionId: null,
        cardType: null,
        messages: [],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    },
  };
}

export const chatStore = createChatStore();
