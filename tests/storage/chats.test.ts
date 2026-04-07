import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

import { readJson, writeJson, ensureDir, listDirs, removePath, existsPath } from '$lib/storage/database';
import {
  listChats,
  loadMessages,
  saveMessages,
  deleteChat,
  loadScene,
  saveScene,
} from '$lib/storage/chats';
import type { Message, SceneState } from '$lib/types';

const mockMessages: Message[] = [
  { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 1000 },
  { role: 'assistant', content: 'Hi there!', type: 'dialogue', timestamp: 2000, characterId: 'char-1' },
];

const mockScene: SceneState = {
  location: 'Forest',
  time: 'Night',
  mood: 'Mysterious',
  participatingCharacters: ['char-1'],
  variables: { health: 100 },
};

describe('chat storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listChats', () => {
    it('returns chat ids', async () => {
      vi.mocked(listDirs).mockResolvedValue(['chat-1', 'chat-2']);
      const result = await listChats();
      expect(result).toEqual(['chat-1', 'chat-2']);
    });

    it('returns empty array when no chats exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);
      const result = await listChats();
      expect(result).toEqual([]);
    });
  });

  describe('loadMessages', () => {
    it('loads messages for a chat', async () => {
      vi.mocked(readJson).mockResolvedValue(mockMessages);
      const result = await loadMessages('chat-1');
      expect(readJson).toHaveBeenCalledWith('chats/chat-1/messages.json');
      expect(result).toEqual(mockMessages);
    });
  });

  describe('saveMessages', () => {
    it('creates directory and saves messages', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveMessages('chat-1', mockMessages);

      expect(ensureDir).toHaveBeenCalledWith('chats/chat-1');
      expect(writeJson).toHaveBeenCalledWith('chats/chat-1/messages.json', mockMessages);
    });
  });

  describe('deleteChat', () => {
    it('removes the chat directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);
      await deleteChat('chat-1');
      expect(removePath).toHaveBeenCalledWith('chats/chat-1');
    });
  });

  describe('loadScene', () => {
    it('loads scene when it exists', async () => {
      vi.mocked(existsPath).mockResolvedValue(true);
      vi.mocked(readJson).mockResolvedValue(mockScene);

      const result = await loadScene('chat-1');

      expect(result).toEqual(mockScene);
    });

    it('returns null when scene does not exist', async () => {
      vi.mocked(existsPath).mockResolvedValue(false);
      const result = await loadScene('chat-1');
      expect(result).toBeNull();
    });
  });

  describe('saveScene', () => {
    it('saves scene state', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveScene('chat-1', mockScene);

      expect(writeJson).toHaveBeenCalledWith('chats/chat-1/scene.json', mockScene);
    });
  });
});
