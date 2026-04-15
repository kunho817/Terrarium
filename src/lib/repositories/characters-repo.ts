/**
 * Characters repository — handles persistence for characters store.
 */

import { get } from 'svelte/store';
import { charactersStore } from '$lib/stores/characters';
import * as charactersStorage from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

export const charactersRepo = {
  /**
   * Load all characters
   */
  async load(): Promise<void> {
    try {
      await charactersStore.loadList();
    } catch (error) {
      charactersStore.update(s => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Save a character
   */
  async saveCharacter(character: CharacterCard): Promise<void> {
    const state = get(charactersStore);
    const existingIndex = state.list.findIndex(c => c.id === character.id);

    try {
      if (existingIndex >= 0) {
        // Update existing character
        await charactersStorage.saveCharacter(character.id, character);
      } else {
        // Create new character
        await charactersStorage.createCharacter(character);
      }
      // Reload the list to reflect changes
      await this.load();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a character
   */
  async deleteCharacter(id: string): Promise<void> {
    try {
      await charactersStorage.deleteCharacter(id);
      // Update store state directly (don't call store.deleteCharacter which also calls storage)
      charactersStore.update(s => ({
        ...s,
        list: s.list.filter(c => c.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    } catch (error) {
      throw error;
    }
  }
};
