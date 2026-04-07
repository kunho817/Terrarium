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

    async loadList() {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const list = await characterStorage.listCharacters();
        update((s) => ({ ...s, list, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async selectCharacter(id: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const card = await characterStorage.loadCharacter(id);
        update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async saveCurrent() {
      const state = get({ subscribe });
      if (state.currentId && state.current) {
        await characterStorage.saveCharacter(state.currentId, state.current);
      }
    },

    async deleteCharacter(id: string) {
      await characterStorage.deleteCharacter(id);
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
  };
}

export const charactersStore = createCharactersStore();
