import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { worldsStore } from '$lib/stores/worlds';
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

describe('worldsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldsStore.reset();
  });

  it('sets worlds list', () => {
    worldsStore.setWorlds([
      { id: 'w1', name: 'World One' },
      { id: 'w2', name: 'World Two' },
    ]);
    const state = get(worldsStore);
    expect(state.list).toEqual([
      { id: 'w1', name: 'World One' },
      { id: 'w2', name: 'World Two' },
    ]);
  });

  it('selects a world state', () => {
    worldsStore.selectWorldState('w1', mockWorld);
    const state = get(worldsStore);
    expect(state.currentId).toBe('w1');
    expect(state.current).toEqual(mockWorld);
  });

  it('removes a world from list', () => {
    worldsStore.setWorlds([
      { id: 'w1', name: 'World One' },
      { id: 'w2', name: 'World Two' },
    ]);
    worldsStore.selectWorldState('w1', mockWorld);
    worldsStore.removeWorld('w1');
    const state = get(worldsStore);
    expect(state.list).toEqual([{ id: 'w2', name: 'World Two' }]);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });

  it('clears selection', () => {
    worldsStore.selectWorldState('w1', mockWorld);
    worldsStore.clearSelection();
    const state = get(worldsStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });

  it('updates world in list', () => {
    worldsStore.setWorlds([{ id: 'w1', name: 'World One' }]);
    worldsStore.updateWorldInList('w1', 'Updated World');
    const state = get(worldsStore);
    expect(state.list).toEqual([{ id: 'w1', name: 'Updated World' }]);
  });
});
