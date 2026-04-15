/**
 * Characters repository — handles persistence for characters store.
 */

import { get } from 'svelte/store';
import { charactersStore } from '$lib/stores/characters';
import * as characterStorage from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

export const charactersRepo = {
  /**
   * Load all characters list.
   */
  async loadList(): Promise<void> {
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const list = await characterStorage.listCharacters();
      charactersStore.update((s) => ({ ...s, list, isLoading: false }));
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Select a character and load its details.
   */
  async selectCharacter(id: string): Promise<void> {
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const card = await characterStorage.loadCharacter(id);
      charactersStore.update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Save the currently selected character.
   */
  async saveCurrent(): Promise<void> {
    const state = get(charactersStore);
    if (state.currentId && state.current) {
      await characterStorage.saveCharacter(state.currentId, state.current);
    }
  },

  /**
   * Save a specific character by ID.
   */
  async saveCharacter(id: string, card: CharacterCard): Promise<void> {
    await characterStorage.saveCharacter(id, card);
  },

  /**
   * Delete a character.
   */
  async deleteCharacter(id: string): Promise<void> {
    await characterStorage.deleteCharacter(id);
    const state = get(charactersStore);
    if (state.currentId === id) {
      charactersStore.clearSelection();
    }
    charactersStore.update((s) => ({
      ...s,
      list: s.list.filter((c) => c.id !== id),
    }));
  },
};
