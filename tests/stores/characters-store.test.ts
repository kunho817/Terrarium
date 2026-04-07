import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/storage/characters', () => ({
  listCharacters: vi.fn(),
  loadCharacter: vi.fn(),
  saveCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  createCharacter: vi.fn(),
}));

import { listCharacters, loadCharacter, deleteCharacter } from '$lib/storage/characters';
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

describe('charactersStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    charactersStore.clearSelection();
  });

  it('loads character list', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);

    await charactersStore.loadList();

    const state = get(charactersStore);
    expect(state.list).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    expect(state.isLoading).toBe(false);
  });

  it('selects a character', async () => {
    vi.mocked(loadCharacter).mockResolvedValue(mockCard);

    await charactersStore.selectCharacter('char-1');

    const state = get(charactersStore);
    expect(state.currentId).toBe('char-1');
    expect(state.current).toEqual(mockCard);
  });

  it('deletes a character and removes from list', async () => {
    vi.mocked(listCharacters).mockResolvedValue([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    vi.mocked(deleteCharacter).mockResolvedValue(undefined);

    await charactersStore.loadList();
    await charactersStore.deleteCharacter('a');

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'b', name: 'Bob' }]);
  });

  it('clears selection', async () => {
    vi.mocked(loadCharacter).mockResolvedValue(mockCard);
    await charactersStore.selectCharacter('char-1');

    charactersStore.clearSelection();

    const state = get(charactersStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });
});
