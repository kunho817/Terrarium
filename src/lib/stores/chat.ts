/**
 * Chat store — pure reactive state only.
 * Persistence handled by chatRepo in repositories/chat-repo.ts
 */

import { writable } from 'svelte/store';
import type { Message } from '$lib/types';

export interface ChatState {
  chatId: string | null;
  sessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string | null;
  isStreaming: boolean;
}

const DEFAULT_STATE: ChatState = {
  chatId: null,
  sessionId: null,
  messages: [],
  isLoading: false,
  streamingMessage: null,
  isStreaming: false,
};

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    
    // Helper methods that only update state (no persistence)
    addMessage: (message: Message) => {
      update(s => ({ ...s, messages: [...s.messages, message] }));
    },
    
    updateMessage: (index: number, message: Message) => {
      update(s => ({
        ...s,
        messages: s.messages.map((m, i) => i === index ? message : m)
      }));
    },
    
    updateLastMessage: (message: Message) => {
      update(s => {
        if (s.messages.length === 0) return s;
        const messages = [...s.messages];
        messages[messages.length - 1] = message;
        return { ...s, messages };
      });
    },
    
    removeMessage: (index: number) => {
      update(s => ({
        ...s,
        messages: s.messages.filter((_, i) => i !== index)
      }));
    },
    
    truncateAfter: (index: number) => {
      update(s => {
        if (index < 0 || index >= s.messages.length) return s;
        return { ...s, messages: s.messages.slice(0, index + 1) };
      });
    },
    
    setStreamingMessage: (content: string | null) => {
      update(s => ({ ...s, streamingMessage: content, isStreaming: content !== null }));
    },

    clearStreamingMessage: () => {
      update(s => ({ ...s, streamingMessage: null, isStreaming: false }));
    },
    
    reset: () => set(DEFAULT_STATE),

    clear: () => set(DEFAULT_STATE),
  };
}

export const chatStore = createChatStore();
