import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

import { readJson, writeJson, ensureDir, listDirs, removePath } from '$lib/storage/database';
import { listWorlds, loadWorld, saveWorld, deleteWorld, createWorld } from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';

const mockWorld: WorldCard = {
  name: 'Test World',
  description: 'A test world',
  scenario: 'Test scenario',
  firstMessage: 'Welcome to the test world',
  alternateGreetings: [],
  systemPrompt: '',
  postHistoryInstructions: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  characters: [],
  regexScripts: [],
  triggers: [],
  scriptState: {},
  creator: 'test',
  tags: [],
  creatorNotes: '',
  metadata: {},
};

describe('worlds storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listWorlds', () => {
    it('returns empty array when no worlds exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);

      const result = await listWorlds();

      expect(result).toEqual([]);
    });

    it('lists worlds with names', async () => {
      vi.mocked(listDirs).mockResolvedValue(['world-1', 'world-2']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockWorld, name: 'World One' })
        .mockResolvedValueOnce({ ...mockWorld, name: 'World Two' });

      const result = await listWorlds();

      expect(result).toEqual([
        { id: 'world-1', name: 'World One' },
        { id: 'world-2', name: 'World Two' },
      ]);
    });

    it('skips corrupt world directories', async () => {
      vi.mocked(listDirs).mockResolvedValue(['good', 'bad']);
      vi.mocked(readJson)
        .mockResolvedValueOnce(mockWorld)
        .mockRejectedValueOnce(new Error('corrupt'));

      const result = await listWorlds();

      expect(result).toEqual([{ id: 'good', name: 'Test World' }]);
    });
  });

  describe('loadWorld', () => {
    it('loads a world card', async () => {
      vi.mocked(readJson).mockResolvedValue(mockWorld);

      const result = await loadWorld('world-1');

      expect(result).toEqual(mockWorld);
      expect(readJson).toHaveBeenCalledWith('worlds/world-1/world.json');
    });
  });

  describe('saveWorld', () => {
    it('saves a world card', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveWorld('world-1', mockWorld);

      expect(ensureDir).toHaveBeenCalledWith('worlds/world-1');
      expect(writeJson).toHaveBeenCalledWith('worlds/world-1/world.json', mockWorld);
    });
  });

  describe('deleteWorld', () => {
    it('removes world directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);

      await deleteWorld('world-1');

      expect(removePath).toHaveBeenCalledWith('worlds/world-1');
    });
  });

  describe('createWorld', () => {
    it('creates a new world and returns id', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      const id = await createWorld(mockWorld);

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalled();
    });
  });
});
