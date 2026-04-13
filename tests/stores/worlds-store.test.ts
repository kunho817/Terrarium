import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/worlds', () => ({
  listWorlds: vi.fn(),
  loadWorld: vi.fn(),
  saveWorld: vi.fn(),
  deleteWorld: vi.fn(),
  createWorld: vi.fn(),
}));

import { worldsStore } from '$lib/stores/worlds';
import { listWorlds, loadWorld, saveWorld, deleteWorld } from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';
import { get } from 'svelte/store';

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

describe('worlds store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldsStore.clearSelection();
  });

  describe('loadList', () => {
    it('loads world list into store', async () => {
      vi.mocked(listWorlds).mockResolvedValue([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      await worldsStore.loadList();
      const state = get(worldsStore);
      expect(state.list).toEqual([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('selectWorld', () => {
    it('loads and sets current world', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsStore.selectWorld('w1');
      const state = get(worldsStore);
      expect(state.currentId).toBe('w1');
      expect(state.current).toEqual(mockWorld);
    });
  });

  describe('saveCurrent', () => {
    it('saves current world via storage', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsStore.selectWorld('w1');
      await worldsStore.saveCurrent();
      expect(saveWorld).toHaveBeenCalledWith('w1', mockWorld);
    });
  });

  describe('deleteWorld', () => {
    it('deletes world and removes from list', async () => {
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'w1', name: 'World One' }]);
      await worldsStore.loadList();
      await worldsStore.deleteWorld('w1');
      expect(deleteWorld).toHaveBeenCalledWith('w1');
      const state = get(worldsStore);
      expect(state.list).toEqual([]);
    });
  });
});
