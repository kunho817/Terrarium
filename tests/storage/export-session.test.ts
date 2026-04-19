import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  existsPath: vi.fn(),
}));

import { buildSessionExport, serializeExport } from '$lib/storage/export-session';
import type { SessionExport } from '$lib/storage/export-session';
import { readJson, existsPath } from '$lib/storage/database';
import type { ChatSession } from '$lib/types/session';
import type { Message } from '$lib/types';
import type { SceneState } from '$lib/types/scene';

const mockSession: ChatSession = {
  id: 'sess-1' as any,
  characterId: 'char-1' as any,
  name: 'Test Session',
  createdAt: 1000,
  lastMessageAt: 2000,
  preview: 'Hello',
};

const mockMessages: Message[] = [
  { role: 'user', content: 'Hi', type: 'dialogue', timestamp: 1500 },
  { role: 'assistant', content: 'Hello!', type: 'dialogue', timestamp: 2000 },
];

const mockScene: SceneState = {
  location: 'Forest',
  time: 'Morning',
  mood: 'Calm',
  participatingCharacters: [],
  variables: {},
  environmentalNotes: '',
  lastUpdated: 2000,
};

describe('export-session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSessionExport', () => {
    it('builds export with messages, scene, and session metadata', async () => {
      vi.mocked(readJson)
        .mockResolvedValueOnce(mockMessages)
        .mockResolvedValueOnce(mockScene)
        .mockResolvedValueOnce({ sessions: [mockSession] });
      vi.mocked(existsPath).mockResolvedValue(true);

      const result = await buildSessionExport('char-1', 'sess-1', 'Test Char', 'character');

      expect(result.version).toBe(1);
      expect(result.card).toEqual({ id: 'char-1', name: 'Test Char', type: 'character' });
      expect(result.session).toEqual(mockSession);
      expect(result.messages).toEqual(mockMessages);
      expect(result.scene).toEqual(mockScene);
      expect(result.exportedAt).toBeGreaterThan(0);
    });

    it('handles missing scene gracefully (null)', async () => {
      vi.mocked(readJson)
        .mockResolvedValueOnce(mockMessages)
        .mockResolvedValueOnce({ sessions: [mockSession] });
      vi.mocked(existsPath).mockResolvedValue(false);

      const result = await buildSessionExport('char-1', 'sess-1', 'Test Char', 'character');

      expect(result.scene).toBeNull();
    });

    it('handles missing messages file gracefully', async () => {
      vi.mocked(readJson)
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce({ sessions: [mockSession] });
      vi.mocked(existsPath).mockResolvedValue(false);

      const result = await buildSessionExport('char-1', 'sess-1', 'Test Char', 'character');

      expect(result.messages).toEqual([]);
    });

    it('throws when session not found', async () => {
      vi.mocked(readJson)
        .mockResolvedValueOnce(mockMessages)
        .mockResolvedValueOnce({ sessions: [] });
      vi.mocked(existsPath).mockResolvedValue(false);

      await expect(buildSessionExport('char-1', 'nonexistent', 'Test', 'character')).rejects.toThrow('buildSessionExport');
    });

    it('handles legacy sessions array format', async () => {
      vi.mocked(readJson)
        .mockResolvedValueOnce(mockMessages)
        .mockResolvedValueOnce([mockSession]);
      vi.mocked(existsPath).mockResolvedValue(false);

      const result = await buildSessionExport('char-1', 'sess-1', 'Test Char', 'character');

      expect(result.session).toEqual(mockSession);
    });
  });

  describe('serializeExport', () => {
    it('serializes to formatted JSON string', () => {
      const exp: SessionExport = {
        version: 1,
        exportedAt: 3000,
        card: { id: 'char-1', name: 'Test', type: 'character' },
        session: mockSession,
        messages: mockMessages,
        scene: null,
      };

      const json = serializeExport(exp);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.messages).toHaveLength(2);
    });
  });
});
