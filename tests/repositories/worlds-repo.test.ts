import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/storage/worlds', () => ({
  listWorlds: vi.fn(),
  loadWorld: vi.fn(),
  saveWorld: vi.fn(),
  deleteWorld: vi.fn(),
  createWorld: vi.fn(),
}));

import { worldsRepo } from '$lib/repositories/worlds-repo';
import { worldsStore } from '$lib/stores/worlds';
import { listWorlds, loadWorld, saveWorld, deleteWorld } from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';

const mockWorld: WorldCard = {
  name: 'Test World',
  description: 'A test world',
  scenario: '',
  firstMessage: '',
  alternateGreetings: [],
  systemPrompt: '',
  postHistoryInstructions: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  characters: [],
  regexScripts: [],
  triggers: [],
  scriptState: {},
  creator: '',
  tags: [],
  creatorNotes: '',
  metadata: {},
};

describe('worldsRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldsStore.reset();
  });

  describe('loadList', () => {
    it('loads world list into store', async () => {
      vi.mocked(listWorlds).mockResolvedValue([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      await worldsRepo.loadList();
      const state = get(worldsStore);
      expect(state.list).toEqual([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      expect(state.isLoading).toBe(false);
      expect(listWorlds).toHaveBeenCalledTimes(1);
    });
  });

  describe('selectWorld', () => {
    it('loads and sets current world', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsRepo.selectWorld('w1');
      const state = get(worldsStore);
      expect(state.currentId).toBe('w1');
      expect(state.current).toEqual(mockWorld);
      expect(loadWorld).toHaveBeenCalledWith('w1');
    });
  });

  describe('saveCurrent', () => {
    it('saves current world via storage', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsRepo.selectWorld('w1');
      await worldsRepo.saveCurrent();
      expect(saveWorld).toHaveBeenCalledWith('w1', mockWorld);
    });
  });

  describe('saveWorld', () => {
    it('saves specific world by id', async () => {
      await worldsRepo.saveWorld('w1', mockWorld);
      expect(saveWorld).toHaveBeenCalledWith('w1', mockWorld);
    });
  });

  describe('deleteWorld', () => {
    it('deletes world and removes from list', async () => {
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'w1', name: 'World One' }]);
      await worldsRepo.loadList();
      await worldsRepo.deleteWorld('w1');
      expect(deleteWorld).toHaveBeenCalledWith('w1');
      const state = get(worldsStore);
      expect(state.list).toEqual([]);
    });

    it('clears selection when deleting current world', async () => {
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'w1', name: 'World One' }]);
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsRepo.loadList();
      await worldsRepo.selectWorld('w1');
      await worldsRepo.deleteWorld('w1');
      const state = get(worldsStore);
      expect(state.currentId).toBeNull();
      expect(state.current).toBeNull();
    });
  });
});
