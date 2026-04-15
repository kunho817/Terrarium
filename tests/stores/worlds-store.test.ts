import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/storage/worlds', () => ({
  listWorlds: vi.fn(),
  loadWorld: vi.fn(),
  saveWorld: vi.fn(),
  deleteWorld: vi.fn(),
  createWorld: vi.fn(),
}));

import { worldsStore } from '$lib/stores/worlds';
import { worldsRepo } from '$lib/repositories/worlds-repo';
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
    worldsStore.reset();
  });

  describe('pure state methods', () => {
    it('setWorlds updates worlds list', () => {
      worldsStore.setWorlds([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      const state = get(worldsStore);
      expect(state.worlds).toEqual([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      expect(state.isLoading).toBe(false);
    });

    it('selectWorld sets current world', () => {
      worldsStore.selectWorld('w1', mockWorld);
      const state = get(worldsStore);
      expect(state.currentId).toBe('w1');
      expect(state.current).toEqual(mockWorld);
    });

    it('addWorld adds to worlds list', () => {
      worldsStore.setWorlds([{ id: 'w1', name: 'World One' }]);
      worldsStore.addWorld({ id: 'w2', name: 'World Two' });
      const state = get(worldsStore);
      expect(state.worlds).toHaveLength(2);
      expect(state.worlds[1]).toEqual({ id: 'w2', name: 'World Two' });
    });

    it('updateWorld updates world in list', () => {
      worldsStore.setWorlds([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      worldsStore.updateWorld('w1', { id: 'w1', name: 'Updated World' });
      const state = get(worldsStore);
      expect(state.worlds[0]).toEqual({ id: 'w1', name: 'Updated World' });
      expect(state.worlds[1]).toEqual({ id: 'w2', name: 'World Two' });
    });

    it('removeWorld removes world from list', () => {
      worldsStore.setWorlds([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      worldsStore.removeWorld('w1');
      const state = get(worldsStore);
      expect(state.worlds).toHaveLength(1);
      expect(state.worlds[0]).toEqual({ id: 'w2', name: 'World Two' });
    });

    it('removeWorld clears current selection if deleted world was current', () => {
      worldsStore.setWorlds([{ id: 'w1', name: 'World One' }]);
      worldsStore.selectWorld('w1', mockWorld);
      worldsStore.removeWorld('w1');
      const state = get(worldsStore);
      expect(state.currentId).toBeNull();
      expect(state.current).toBeNull();
    });

    it('clearSelection clears current world', () => {
      worldsStore.selectWorld('w1', mockWorld);
      worldsStore.clearSelection();
      const state = get(worldsStore);
      expect(state.currentId).toBeNull();
      expect(state.current).toBeNull();
    });

    it('reset resets to default state', () => {
      worldsStore.setWorlds([{ id: 'w1', name: 'World One' }]);
      worldsStore.selectWorld('w1', mockWorld);
      worldsStore.reset();
      const state = get(worldsStore);
      expect(state.worlds).toEqual([]);
      expect(state.currentId).toBeNull();
      expect(state.current).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});

describe('worlds repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldsStore.reset();
  });

  describe('load', () => {
    it('loads world list via storage and updates store', async () => {
      vi.mocked(listWorlds).mockResolvedValue([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      await worldsRepo.load();
      const state = get(worldsStore);
      expect(state.worlds).toEqual([
        { id: 'w1', name: 'World One' },
        { id: 'w2', name: 'World Two' },
      ]);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('selectWorld', () => {
    it('loads and sets current world via repository', async () => {
      vi.mocked(loadWorld).mockResolvedValue(mockWorld);
      await worldsRepo.selectWorld('w1');
      const state = get(worldsStore);
      expect(state.currentId).toBe('w1');
      expect(state.current).toEqual(mockWorld);
    });
  });

  describe('saveWorld', () => {
    it('saves world via repository and refreshes list', async () => {
      vi.mocked(saveWorld).mockResolvedValue(undefined);
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'w1', name: 'Updated World' }]);
      
      await worldsRepo.saveWorld('w1', mockWorld);
      expect(saveWorld).toHaveBeenCalledWith('w1', mockWorld);
      
      const state = get(worldsStore);
      expect(state.worlds).toEqual([{ id: 'w1', name: 'Updated World' }]);
    });

    it('creates new world via repository', async () => {
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'new-id', name: 'New World' }]);
      const { createWorld } = await import('$lib/storage/worlds');
      vi.mocked(createWorld).mockResolvedValue('new-id');
      
      const id = await worldsRepo.saveWorld(null, mockWorld);
      expect(id).toBe('new-id');
    });
  });

  describe('deleteWorld', () => {
    it('deletes world via repository and updates store', async () => {
      vi.mocked(listWorlds).mockResolvedValue([{ id: 'w1', name: 'World One' }]);
      vi.mocked(deleteWorld).mockResolvedValue(undefined);
      
      await worldsRepo.load();
      await worldsRepo.deleteWorld('w1');
      
      expect(deleteWorld).toHaveBeenCalledWith('w1');
      const state = get(worldsStore);
      expect(state.worlds).toEqual([]);
    });
  });
});
