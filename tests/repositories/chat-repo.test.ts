import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/storage/chats', () => ({
  loadMessages: vi.fn(),
  saveMessages: vi.fn(),
  listSessions: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
}));

import { chatRepo } from '$lib/repositories/chat-repo';
import { chatStore } from '$lib/stores/chat';
import { loadMessages, saveMessages, listSessions, createSession, updateSession } from '$lib/storage/chats';
import type { Message } from '$lib/types';

const mockMessage: Message = {
  role: 'user',
  content: 'Hello',
  type: 'dialogue',
  timestamp: Date.now(),
};

describe('chatRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatStore.clear();
    chatRepo.invalidateCache('char-1');
  });

  describe('loadSession', () => {
    it('loads messages into store', async () => {
      vi.mocked(loadMessages).mockResolvedValue([mockMessage]);
      
      await chatRepo.loadSession('char-1', 'session-1');
      
      const state = get(chatStore);
      expect(state.characterId).toBe('char-1');
      expect(state.sessionId).toBe('session-1');
      expect(state.messages).toEqual([mockMessage]);
      expect(state.isLoading).toBe(false);
      expect(loadMessages).toHaveBeenCalledWith('char-1', 'session-1');
    });

    it('handles empty messages', async () => {
      vi.mocked(loadMessages).mockResolvedValue([]);
      
      await chatRepo.loadSession('char-1', 'session-1');
      
      const state = get(chatStore);
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadChat', () => {
    it('loads most recent session', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'First', lastMessageAt: 1000 },
        { id: 'session-2', name: 'Second', lastMessageAt: 2000 },
      ];
      vi.mocked(listSessions).mockResolvedValue(mockSessions);
      vi.mocked(loadMessages).mockResolvedValue([mockMessage]);
      
      await chatRepo.loadChat('char-1');
      
      const state = get(chatStore);
      expect(state.characterId).toBe('char-1');
      expect(state.sessionId).toBe('session-2'); // Most recent
      expect(loadMessages).toHaveBeenCalledWith('char-1', 'session-2');
    });

    it('creates new session if none exist', async () => {
      vi.mocked(listSessions).mockResolvedValue([]);
      vi.mocked(createSession).mockResolvedValue({ id: 'new-session', name: 'Chat', lastMessageAt: Date.now() });
      vi.mocked(loadMessages).mockResolvedValue([]);
      
      await chatRepo.loadChat('char-1');
      
      const state = get(chatStore);
      expect(state.characterId).toBe('char-1');
      expect(state.sessionId).toBe('new-session');
      expect(createSession).toHaveBeenCalledWith('char-1');
    });
  });

  describe('saveMessages', () => {
    it('saves current messages', async () => {
      chatStore.set({
        characterId: 'char-1',
        sessionId: 'session-1',
        messages: [mockMessage],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
      
      await chatRepo.saveMessages();
      
      expect(saveMessages).toHaveBeenCalledWith('char-1', 'session-1', [mockMessage]);
      expect(updateSession).toHaveBeenCalledWith('char-1', 'session-1', {
        lastMessageAt: mockMessage.timestamp,
        preview: 'You: Hello',
      });
    });

    it('does not save if no characterId or sessionId', async () => {
      chatStore.clear();
      
      await chatRepo.saveMessages();
      
      expect(saveMessages).not.toHaveBeenCalled();
    });

    it('adds "You: " prefix for user messages', async () => {
      chatStore.set({
        characterId: 'char-1',
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'Hello world', type: 'dialogue', timestamp: 1234 }],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });

      await chatRepo.saveMessages();

      expect(updateSession).toHaveBeenCalledWith('char-1', 'session-1', {
        lastMessageAt: 1234,
        preview: 'You: Hello world',
      });
    });

    it('no prefix for assistant messages', async () => {
      chatStore.set({
        characterId: 'char-1',
        sessionId: 'session-1',
        messages: [{ role: 'assistant', content: 'Hi there', type: 'dialogue', timestamp: 5678 }],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });

      await chatRepo.saveMessages();

      expect(updateSession).toHaveBeenCalledWith('char-1', 'session-1', {
        lastMessageAt: 5678,
        preview: 'Hi there',
      });
    });

    it('truncates preview to 120 chars', async () => {
      const longContent = 'x'.repeat(200);
      chatStore.set({
        characterId: 'char-1',
        sessionId: 'session-1',
        messages: [{ role: 'user', content: longContent, type: 'dialogue', timestamp: 9999 }],
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });

      await chatRepo.saveMessages();

      const expectedPreview = `You: ${longContent}`.slice(0, 120);
      expect(updateSession).toHaveBeenCalledWith('char-1', 'session-1', {
        lastMessageAt: 9999,
        preview: expectedPreview,
      });
      expect(expectedPreview.length).toBe(120);
    });
  });

  describe('createSession', () => {
    it('creates and returns new session id', async () => {
      vi.mocked(createSession).mockResolvedValue({ id: 'new-session', name: 'Chat', lastMessageAt: Date.now() });
      
      const sessionId = await chatRepo.createSession('char-1');
      
      expect(sessionId).toBe('new-session');
      expect(createSession).toHaveBeenCalledWith('char-1');
    });
  });
});
