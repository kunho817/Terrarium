import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import type { Message } from '$lib/types';

// Mock the storage module
vi.mock('$lib/storage/chats', () => ({
  loadMessages: vi.fn().mockResolvedValue([]),
  saveMessages: vi.fn().mockResolvedValue(undefined),
}));

const mockMessage: Message = {
  role: 'user',
  content: 'Hello',
  type: 'dialogue',
  timestamp: 1000,
};

describe('chatStore', () => {
  beforeEach(() => {
    chatStore.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with null characterId', () => {
      const state = get(chatStore);
      expect(state.characterId).toBeNull();
    });

    it('starts with empty messages', () => {
      const state = get(chatStore);
      expect(state.messages).toEqual([]);
    });

    it('starts with no streaming message', () => {
      const state = get(chatStore);
      expect(state.streamingMessage).toBeNull();
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('adds message to messages array', () => {
      chatStore.addMessage(mockMessage);
      const state = get(chatStore);
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe('Hello');
    });
  });

  describe('streaming', () => {
    it('setStreamingMessage updates streaming state', () => {
      chatStore.setStreamingMessage('Hello w...');
      const state = get(chatStore);
      expect(state.streamingMessage).toBe('Hello w...');
      expect(state.isStreaming).toBe(true);
    });

    it('clearStreamingMessage resets streaming state', () => {
      chatStore.setStreamingMessage('Partial');
      chatStore.clearStreamingMessage();
      const state = get(chatStore);
      expect(state.streamingMessage).toBeNull();
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('clear', () => {
    it('resets all state', () => {
      chatStore.addMessage(mockMessage);
      chatStore.setStreamingMessage('Partial');
      chatStore.clear();

      const state = get(chatStore);
      expect(state.messages).toEqual([]);
      expect(state.streamingMessage).toBeNull();
      expect(state.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });
});
