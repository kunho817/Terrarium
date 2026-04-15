/**
 * Characters store — reactive state for character list and selection.
 */

import { writable, get } from 'svelte/store';
import type { CharacterCard } from '$lib/types';
import * as characterStorage from '$lib/storage/characters';

interface CharactersState {
  list: { id: string; name: string }[];
  currentId: string | null;
  current: CharacterCard | null;
  isLoading: boolean;
}

function createCharactersStore() {
  const { subscribe, set, update } = writable<CharactersState>({
    list: [],
    currentId: null,
    current: null,
    isLoading: false,
  });

  return {
    subscribe,
    set,
    update,

    // Pure state helpers (no persistence)
    setCharacters(list: { id: string; name: string }[]) {
      update((s) => ({ ...s, list, isLoading: false }));
    },

    selectCharacterState(id: string | null, current: CharacterCard | null) {
      update((s) => ({ ...s, currentId: id, current, isLoading: false }));
    },

    updateCharacterInList(id: string, name: string) {
      update((s) => ({
        ...s,
        list: s.list.map((c) => (c.id === id ? { ...c, name } : c)),
      }));
    },

    removeCharacter(id: string) {
      update((s) => ({
        ...s,
        list: s.list.filter((c) => c.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },

    clearSelection() {
      update((s) => ({ ...s, currentId: null, current: null }));
    },

    reset() {
      set({
        list: [],
        currentId: null,
        current: null,
        isLoading: false,
      });
    },
  };
}

export const charactersStore = createCharactersStore();
