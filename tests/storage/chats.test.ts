import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJsonAtomic: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

import { readJson, writeJsonAtomic, ensureDir, listDirs, removePath, existsPath } from '$lib/storage/database';
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  loadMessages,
  saveMessages,
  loadScene,
  saveScene,
  listChats,
  deleteChat,
} from '$lib/storage/chats';
import type { SessionsFile } from '$lib/types';
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
  environmentalNotes: '',
  lastUpdated: 0,
};

// Helper: mock sessions.json not existing (triggers migration check path)
function mockNoSessionsIndex() {
  vi.mocked(existsPath).mockImplementation(async (path: string) => {
    if (path.includes('sessions.json')) return false;
    return false;
  });
  vi.mocked(readJson).mockRejectedValue(new Error('file not found'));
}

// Helper: mock sessions.json existing with given sessions
function mockSessionsIndex(sessions: unknown[]) {
  vi.mocked(existsPath).mockImplementation(async (path: string) => {
    if (path.includes('sessions.json')) return true;
    return false;
  });
  vi.mocked(readJson).mockImplementation(async (path: string) => {
    if (path.includes('sessions.json')) return sessions;
    if (path.includes('messages.json')) return mockMessages;
    if (path.includes('scene.json')) return mockScene;
    return [];
  });
}

describe('chat session storage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('listChats', () => {
    it('returns character ids with chat data', async () => {
      vi.mocked(listDirs).mockResolvedValue(['char-1', 'char-2']);
      const result = await listChats();
      expect(result).toEqual(['char-1', 'char-2']);
    });

    it('returns empty array when no chats exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);
      const result = await listChats();
      expect(result).toEqual([]);
    });
  });

  describe('listSessions', () => {
    it('returns sessions from index', async () => {
      const sessions = [
        { id: 's1', characterId: 'char-1', name: 'Chat 1', createdAt: 1000, lastMessageAt: 2000, preview: 'Hello' },
      ];
      mockSessionsIndex(sessions);

      const result = await listSessions('char-1');
      expect(result).toEqual(sessions);
    });

    it('returns empty array when no sessions', async () => {
      mockNoSessionsIndex();
      const result = await listSessions('char-1');
      expect(result).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('creates a new session and adds to index', async () => {
      mockSessionsIndex([]);
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      const session = await createSession('char-1', 'Test Chat');

      expect(session.characterId).toBe('char-1');
      expect(session.name).toBe('Test Chat');
      expect(session.id).toBeTruthy();
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJsonAtomic).toHaveBeenCalled();
    });

    it('uses default name when not provided', async () => {
      mockSessionsIndex([]);
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      const session = await createSession('char-1');
      expect(session.name).toBe('Chat 1');
    });
  });

  describe('updateSession', () => {
    it('updates session in index', async () => {
      const sessions = [
        { id: 's1', characterId: 'char-1', name: 'Old', createdAt: 1000, lastMessageAt: 2000, preview: '' },
      ];
      mockSessionsIndex(sessions);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await updateSession('char-1', 's1', { name: 'Updated' });

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions[0].name).toBe('Updated');
    });
  });

  describe('deleteSession', () => {
    it('removes session files and updates index', async () => {
      const sessions = [
        { id: 's1', characterId: 'char-1', name: 'Chat 1', createdAt: 1000, lastMessageAt: 2000, preview: '' },
        { id: 's2', characterId: 'char-1', name: 'Chat 2', createdAt: 3000, lastMessageAt: 4000, preview: '' },
      ];
      mockSessionsIndex(sessions);
      vi.mocked(removePath).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await deleteSession('char-1', 's1');

      expect(removePath).toHaveBeenCalled();
      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(1);
    });
  });

  describe('loadMessages', () => {
    it('loads messages for a session', async () => {
      vi.mocked(readJson).mockResolvedValue(mockMessages);

      const result = await loadMessages('char-1', 's1');

      expect(readJson).toHaveBeenCalledWith('chats/char-1/s1/messages.json');
      expect(result).toEqual(mockMessages);
    });

    it('returns empty array on error', async () => {
      vi.mocked(readJson).mockRejectedValue(new Error('not found'));

      const result = await loadMessages('char-1', 's1');
      expect(result).toEqual([]);
    });
  });

  describe('saveMessages', () => {
    it('saves messages to file', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await saveMessages('char-1', 's1', mockMessages);

      expect(ensureDir).toHaveBeenCalled();
      const msgCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('messages.json'),
      );
      expect(msgCall).toBeDefined();
      expect(msgCall![1]).toEqual(mockMessages);
    });
  });

  describe('loadScene', () => {
    it('loads scene when it exists', async () => {
      vi.mocked(existsPath).mockResolvedValue(true);
      vi.mocked(readJson).mockResolvedValue(mockScene);

      const result = await loadScene('char-1', 's1');
      expect(result).toEqual(mockScene);
    });

    it('returns null when scene does not exist', async () => {
      vi.mocked(existsPath).mockResolvedValue(false);
      const result = await loadScene('char-1', 's1');
      expect(result).toBeNull();
    });
  });

  describe('saveScene', () => {
    it('saves scene state', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await saveScene('char-1', 's1', mockScene);

      expect(writeJsonAtomic).toHaveBeenCalledWith('chats/char-1/s1/scene.json', mockScene);
    });
  });

  describe('deleteChat', () => {
    it('removes the character chat directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);
      await deleteChat('char-1');
      expect(removePath).toHaveBeenCalledWith('chats/char-1');
    });
  });
});
