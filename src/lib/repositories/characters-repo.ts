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
      console.error('Failed to load characters:', error);
      charactersStore.update(s => ({ ...s, isLoading: false }));
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
      console.error('Failed to save character:', error);
      throw error;
    }
  },

  /**
   * Delete a character
   */
  async deleteCharacter(id: string): Promise<void> {
    try {
      await charactersStorage.deleteCharacter(id);
      charactersStore.deleteCharacter(id);
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  }
};
