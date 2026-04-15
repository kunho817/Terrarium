import { describe, it, expect, beforeEach } from 'vitest';
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
    charactersStore.reset();
  });

  it('sets character list', () => {
    charactersStore.setList([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);

    const state = get(charactersStore);
    expect(state.list).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    expect(state.isLoading).toBe(false);
  });

  it('selects a character', () => {
    charactersStore.selectCharacter('char-1', mockCard);

    const state = get(charactersStore);
    expect(state.currentId).toBe('char-1');
    expect(state.current).toEqual(mockCard);
  });

  it('adds a character to the list', () => {
    charactersStore.setList([{ id: 'a', name: 'Alice' }]);
    charactersStore.addCharacter('char-1', mockCard);

    const state = get(charactersStore);
    expect(state.list).toEqual([
      { id: 'a', name: 'Alice' },
      { id: 'char-1', name: 'Test' },
    ]);
  });

  it('updates a character in the list', () => {
    charactersStore.setList([{ id: 'char-1', name: 'Old Name' }]);
    charactersStore.updateCharacter('char-1', mockCard);

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'char-1', name: 'Test' }]);
  });

  it('updates current character when updating the selected character', () => {
    charactersStore.setList([{ id: 'char-1', name: 'Old Name' }]);
    charactersStore.selectCharacter('char-1', { ...mockCard, name: 'Old Name' });

    const updatedCard = { ...mockCard, name: 'Updated Name' };
    charactersStore.updateCharacter('char-1', updatedCard);

    const state = get(charactersStore);
    expect(state.current?.name).toBe('Updated Name');
  });

  it('removes a character from the list', () => {
    charactersStore.setList([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ]);
    charactersStore.removeCharacter('a');

    const state = get(charactersStore);
    expect(state.list).toEqual([{ id: 'b', name: 'Bob' }]);
  });

  it('clears current selection when removing the selected character', () => {
    charactersStore.setList([{ id: 'char-1', name: 'Test' }]);
    charactersStore.selectCharacter('char-1', mockCard);

    charactersStore.removeCharacter('char-1');

    const state = get(charactersStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });

  it('clears selection', () => {
    charactersStore.setList([{ id: 'char-1', name: 'Test' }]);
    charactersStore.selectCharacter('char-1', mockCard);

    charactersStore.clearSelection();

    const state = get(charactersStore);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
  });

  it('resets to default state', () => {
    charactersStore.setList([{ id: 'a', name: 'Alice' }]);
    charactersStore.selectCharacter('char-1', mockCard);

    charactersStore.reset();

    const state = get(charactersStore);
    expect(state.list).toEqual([]);
    expect(state.currentId).toBeNull();
    expect(state.current).toBeNull();
    expect(state.isLoading).toBe(true);
  });
});
