import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
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
    charactersStore.reset();
  });

  it('sets characters list', () => {
    charactersStore.setCharacters([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);

    const state = get(charactersStore);
    expect(state.list).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
  });

  it('selects a character state', () => {
    charactersStore.selectCharacterState('char-1', mockCard);

    const state = get(charactersStore);
    expect(state.currentId).toBe('char-1');
    expect(state.current).toEqual(mockCard);
  });

  it('removes a character from list', () => {
    charactersStore.setCharacters([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    charactersStore.selectCharacterState('a', mockCard);
    
    charactersStore.removeCharacter('a');

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'b', name: 'Bob' }]);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });

  it('clears selection', () => {
    charactersStore.selectCharacterState('char-1', mockCard);

    charactersStore.clearSelection();

    const state = get(charactersStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });

  it('updates character in list', () => {
    charactersStore.setCharacters([
      { id: 'a', name: 'Alice' },
    ]);

    charactersStore.updateCharacterInList('a', 'Alice Updated');

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'a', name: 'Alice Updated' }]);
  });
});
