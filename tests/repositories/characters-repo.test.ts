import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/storage/characters', () => ({
  listCharacters: vi.fn(),
  loadCharacter: vi.fn(),
  saveCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  createCharacter: vi.fn(),
}));

import { listCharacters, loadCharacter, saveCharacter, deleteCharacter } from '$lib/storage/characters';
import { charactersRepo } from '$lib/repositories/characters-repo';
import { charactersStore } from '$lib/stores/characters';
import type { CharacterCard } from '$lib/types';

const mockCard: CharacterCard = {
  name: 'Test',
  description: '',
  personality: '',
  scenario: '',
  firstMessage: '',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

describe('charactersRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    charactersStore.reset();
  });

  it('loads character list', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);

    await charactersRepo.loadList();

    const state = get(charactersStore);
    expect(state.list).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    expect(state.isLoading).toBe(false);
    expect(listCharacters).toHaveBeenCalledTimes(1);
  });

  it('selects a character', async () => {
    vi.mocked(loadCharacter).mockResolvedValue(mockCard);

    await charactersRepo.selectCharacter('char-1');

    const state = get(charactersStore);
    expect(state.currentId).toBe('char-1');
    expect(state.current).toEqual(mockCard);
    expect(state.isLoading).toBe(false);
    expect(loadCharacter).toHaveBeenCalledWith('char-1');
  });

  it('deletes a character and updates store', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    vi.mocked(deleteCharacter).mockResolvedValue(undefined);

    await charactersRepo.loadList();
    await charactersRepo.deleteCharacter('a');

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'b', name: 'Bob' }]);
    expect(deleteCharacter).toHaveBeenCalledWith('a');
  });

  it('saves a character', async () => {
    vi.mocked(saveCharacter).mockResolvedValue(undefined);

    await charactersRepo.saveCharacter('char-1', mockCard);

    expect(saveCharacter).toHaveBeenCalledWith('char-1', mockCard);
  });

  it('clears selection when deleting current character', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
    ]);
    vi.mocked(loadCharacter).mockResolvedValue(mockCard);
    vi.mocked(deleteCharacter).mockResolvedValue(undefined);

    await charactersRepo.loadList();
    await charactersRepo.selectCharacter('a');
    await charactersRepo.deleteCharacter('a');

    const state = get(charactersStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });
});
