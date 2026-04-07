/**
 * Chat store — reactive state for current chat session.
 */

import { writable, get } from 'svelte/store';
import type { Message } from '$lib/types';
import * as chatStorage from '$lib/storage/chats';

interface ChatState {
  chatId: string | null;
  messages: Message[];
  isLoading: boolean;
}

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>({
    chatId: null,
    messages: [],
    isLoading: false,
  });

  return {
    subscribe,

    async loadChat(chatId: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const messages = await chatStorage.loadMessages(chatId);
        set({ chatId, messages, isLoading: false });
      } catch {
        set({ chatId: null, messages: [], isLoading: false });
      }
    },

    addMessage(message: Message) {
      update((s) => ({ ...s, messages: [...s.messages, message] }));
    },

    async save() {
      const state = get({ subscribe });
      if (state.chatId) {
        await chatStorage.saveMessages(state.chatId, state.messages);
      }
    },

    clear() {
      set({ chatId: null, messages: [], isLoading: false });
    },
  };
}

export const chatStore = createChatStore();
