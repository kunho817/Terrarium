import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJsonAtomic: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  BaseDirectory: { AppData: 1 },
}));

vi.mock('$lib/storage/memories', () => ({
  deleteMemoriesForSession: vi.fn(),
}));

vi.mock('$lib/storage/agent-states', () => ({
  deleteSceneState: vi.fn(),
}));

import { readJson, writeJsonAtomic, ensureDir, removePath, existsPath } from '$lib/storage/database';
import { readDir, readTextFile, writeTextFile, remove } from '@tauri-apps/plugin-fs';
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  listArchivedSessions,
  archiveSession,
  restoreSession,
  permanentDeleteSession,
} from '$lib/storage/chats';
import { makeCharacterId, makeSessionId } from '$lib/types';
import type { ChatSession, SessionsFile } from '$lib/types';

function mockSessionsIndex(data: SessionsFile | unknown[]) {
  vi.mocked(existsPath).mockImplementation(async (path: string) => {
    if (path.includes('sessions.json')) return true;
    return false;
  });
  vi.mocked(readJson).mockImplementation(async (path: string) => {
    if (path.includes('sessions.json')) return data;
    return [];
  });
}

function mockNoSessionsIndex() {
  vi.mocked(existsPath).mockResolvedValue(false);
  vi.mocked(readJson).mockRejectedValue(new Error('file not found'));
}

const s1: ChatSession = {
  id: makeSessionId('s1'),
  characterId: makeCharacterId('char-1'),
  name: 'Chat 1',
  createdAt: 1000,
  lastMessageAt: 2000,
  preview: 'Hello',
};

const s2: ChatSession = {
  id: makeSessionId('s2'),
  characterId: makeCharacterId('char-1'),
  name: 'Chat 2',
  createdAt: 3000,
  lastMessageAt: 4000,
  preview: 'World',
};

describe('SessionsFile format', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('legacy array format compatibility', () => {
    it('listSessions reads legacy array format', async () => {
      mockSessionsIndex([s1, s2]);
      const result = await listSessions('char-1');
      expect(result).toEqual([s1, s2]);
    });

    it('createSession converts legacy array to SessionsFile on write', async () => {
      mockSessionsIndex([s1]);
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      const session = await createSession('char-1', 'New Chat');
      expect(session.name).toBe('New Chat');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(2);
      expect(written.sessions[0]).toEqual(s1);
    });

    it('updateSession converts legacy array to SessionsFile on write', async () => {
      mockSessionsIndex([s1]);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await updateSession('char-1', 's1', { name: 'Updated' });

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions[0].name).toBe('Updated');
    });

    it('deleteSession converts legacy array to SessionsFile on write', async () => {
      mockSessionsIndex([s1, s2]);
      vi.mocked(removePath).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await deleteSession('char-1', 's1');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(1);
      expect(written.sessions[0].id).toBe('s2');
    });
  });

  describe('new SessionsFile format', () => {
    it('listSessions reads SessionsFile format', async () => {
      mockSessionsIndex({ sessions: [s1], archivedSessions: [s2] });
      const result = await listSessions('char-1');
      expect(result).toEqual([s1]);
    });

    it('listArchivedSessions returns archived sessions', async () => {
      mockSessionsIndex({ sessions: [s1], archivedSessions: [s2] });
      const result = await listArchivedSessions('char-1');
      expect(result).toEqual([s2]);
    });

    it('listArchivedSessions returns empty when undefined', async () => {
      mockSessionsIndex({ sessions: [s1] });
      const result = await listArchivedSessions('char-1');
      expect(result).toEqual([]);
    });

    it('createSession preserves archivedSessions', async () => {
      mockSessionsIndex({ sessions: [s1], archivedSessions: [s2] });
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await createSession('char-1', 'Chat 3');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(2);
      expect(written.archivedSessions).toEqual([s2]);
    });

    it('updateSession preserves archivedSessions', async () => {
      mockSessionsIndex({ sessions: [s1], archivedSessions: [s2] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await updateSession('char-1', 's1', { name: 'Updated' });

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions[0].name).toBe('Updated');
      expect(written.archivedSessions).toEqual([s2]);
    });

    it('deleteSession preserves archivedSessions', async () => {
      mockSessionsIndex({ sessions: [s1, s2], archivedSessions: [] });
      vi.mocked(removePath).mockResolvedValue(undefined);
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      await deleteSession('char-1', 's1');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(1);
    });
  });
});

describe('archive operations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('archiveSession', () => {
    it('moves session from sessions to archivedSessions', async () => {
      mockSessionsIndex({ sessions: [s1, s2] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);
      vi.mocked(existsPath).mockImplementation(async (path: string) => {
        if (path.includes('sessions.json')) return true;
        return false;
      });

      await archiveSession('char-1', 's1');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(1);
      expect(written.sessions[0].id).toBe('s2');
      expect(written.archivedSessions).toHaveLength(1);
      expect(written.archivedSessions![0].id).toBe('s1');
    });

    it('does nothing if session not found', async () => {
      mockSessionsIndex({ sessions: [s1] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);
      vi.mocked(existsPath).mockImplementation(async (path: string) => {
        if (path.includes('sessions.json')) return true;
        return false;
      });

      await archiveSession('char-1', 'nonexistent');

      expect(writeJsonAtomic).not.toHaveBeenCalled();
    });

    it('moves files from session dir to archive dir', async () => {
      mockSessionsIndex({ sessions: [s1] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      // srcDir exists, destDir doesn't yet
      let existsCallCount = 0;
      vi.mocked(existsPath).mockImplementation(async (path: string) => {
        existsCallCount++;
        if (path.includes('sessions.json')) return true;
        if (path === 'chats/char-1/s1') return true;
        return false;
      });
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(readDir).mockResolvedValue([
        { name: 'messages.json', isDirectory: false, isFile: true, isSymlink: false },
        { name: 'scene.json', isDirectory: false, isFile: true, isSymlink: false },
      ]);
      vi.mocked(readTextFile).mockResolvedValue('{}');
      vi.mocked(writeTextFile).mockResolvedValue(undefined);
      vi.mocked(remove).mockResolvedValue(undefined);

      await archiveSession('char-1', 's1');

      expect(readDir).toHaveBeenCalledWith('chats/char-1/s1', { baseDir: 1 });
      expect(readTextFile).toHaveBeenCalledWith('chats/char-1/s1/messages.json', { baseDir: 1 });
      expect(writeTextFile).toHaveBeenCalledWith('chats/char-1/.archive/s1/messages.json', '{}', { baseDir: 1 });
      expect(remove).toHaveBeenCalledWith('chats/char-1/s1', { baseDir: 1, recursive: true });
    });
  });

  describe('restoreSession', () => {
    it('moves session from archivedSessions back to sessions', async () => {
      mockSessionsIndex({ sessions: [s2], archivedSessions: [s1] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);
      vi.mocked(existsPath).mockImplementation(async (path: string) => {
        if (path.includes('sessions.json')) return true;
        return false;
      });

      await restoreSession('char-1', 's1');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.sessions).toHaveLength(2);
      expect(written.archivedSessions).toBeUndefined();
    });

    it('does nothing if archived session not found', async () => {
      mockSessionsIndex({ sessions: [], archivedSessions: [s1] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);
      vi.mocked(existsPath).mockImplementation(async (path: string) => {
        if (path.includes('sessions.json')) return true;
        return false;
      });

      await restoreSession('char-1', 'nonexistent');

      expect(writeJsonAtomic).not.toHaveBeenCalled();
    });

    it('moves files from archive dir back to session dir', async () => {
      mockSessionsIndex({ sessions: [], archivedSessions: [s1] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);

      vi.mocked(existsPath).mockImplementation(async (path: string) => {
        if (path.includes('sessions.json')) return true;
        if (path === 'chats/char-1/.archive/s1') return true;
        return false;
      });
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(readDir).mockResolvedValue([
        { name: 'messages.json', isDirectory: false, isFile: true, isSymlink: false },
      ]);
      vi.mocked(readTextFile).mockResolvedValue('[]');
      vi.mocked(writeTextFile).mockResolvedValue(undefined);
      vi.mocked(remove).mockResolvedValue(undefined);

      await restoreSession('char-1', 's1');

      expect(readDir).toHaveBeenCalledWith('chats/char-1/.archive/s1', { baseDir: 1 });
      expect(writeTextFile).toHaveBeenCalledWith('chats/char-1/s1/messages.json', '[]', { baseDir: 1 });
      expect(remove).toHaveBeenCalledWith('chats/char-1/.archive/s1', { baseDir: 1, recursive: true });
    });
  });

  describe('permanentDeleteSession', () => {
    it('removes session from archivedSessions', async () => {
      mockSessionsIndex({ sessions: [s2], archivedSessions: [s1] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);
      vi.mocked(removePath).mockResolvedValue(undefined);

      await permanentDeleteSession('char-1', 's1');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.archivedSessions).toBeUndefined();
      expect(removePath).toHaveBeenCalledWith('chats/char-1/.archive/s1');
    });

    it('removes only the targeted session when multiple archived', async () => {
      const s3: ChatSession = {
        id: makeSessionId('s3'),
        characterId: makeCharacterId('char-1'),
        name: 'Chat 3',
        createdAt: 5000,
        lastMessageAt: 6000,
        preview: '!',
      };
      mockSessionsIndex({ sessions: [], archivedSessions: [s1, s3] });
      vi.mocked(writeJsonAtomic).mockResolvedValue(undefined);
      vi.mocked(removePath).mockResolvedValue(undefined);

      await permanentDeleteSession('char-1', 's1');

      const writeCall = vi.mocked(writeJsonAtomic).mock.calls.find(
        (c) => c[0].includes('sessions.json'),
      );
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as SessionsFile;
      expect(written.archivedSessions).toHaveLength(1);
      expect(written.archivedSessions![0].id).toBe('s3');
    });
  });

  describe('listArchivedSessions', () => {
    it('returns archived sessions', async () => {
      mockSessionsIndex({ sessions: [s1], archivedSessions: [s2] });
      const result = await listArchivedSessions('char-1');
      expect(result).toEqual([s2]);
    });

    it('returns empty array when no sessions file exists', async () => {
      mockNoSessionsIndex();
      const result = await listArchivedSessions('char-1');
      expect(result).toEqual([]);
    });
  });
});
