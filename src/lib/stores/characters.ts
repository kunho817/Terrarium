/**
 * Characters store — pure reactive state only.
 * Persistence handled by charactersRepo in repositories/characters-repo.ts
 */

import { writable } from 'svelte/store';
import type { CharacterCard } from '$lib/types';

export interface CharactersState {
  list: { id: string; name: string }[];
  currentId: string | null;
  current: CharacterCard | null;
  isLoading: boolean;
}

const DEFAULT_STATE: CharactersState = {
  list: [],
  currentId: null,
  current: null,
  isLoading: true,
};

function createCharactersStore() {
  const { subscribe, set, update } = writable<CharactersState>(DEFAULT_STATE);

  return {
    subscribe,
    set,
    update,

    // Helper methods that only update state (no persistence)
    setList: (list: { id: string; name: string }[]) => {
      update(s => ({ ...s, list, isLoading: false }));
    },

    selectCharacter: (id: string | null, character: CharacterCard | null) => {
      update(s => ({ ...s, currentId: id, current: character, isLoading: false }));
    },

    addCharacter: (id: string, character: CharacterCard) => {
      update(s => ({
        ...s,
        list: [...s.list, { id, name: character.name }]
      }));
    },

    updateCharacter: (id: string, character: CharacterCard) => {
      update(s => ({
        ...s,
        list: s.list.map(c => c.id === id ? { id, name: character.name } : c),
        current: s.currentId === id ? character : s.current,
      }));
    },

    removeCharacter: (id: string) => {
      update(s => ({
        ...s,
        list: s.list.filter(c => c.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },

    clearSelection: () => {
      update(s => ({ ...s, currentId: null, current: null }));
    },

    reset: () => set(DEFAULT_STATE),
  };
}

export const charactersStore = createCharactersStore();
