/**
 * Characters repository — handles persistence for characters store.
 */

import { charactersStore } from '$lib/stores/characters';
import * as charactersStorage from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

export const charactersRepo = {
  /**
   * Load all characters
   */
  async load(): Promise<void> {
    try {
      charactersStore.update(s => ({ ...s, isLoading: true }));
      const list = await charactersStorage.listCharacters();
      charactersStore.setList(list);
    } catch (error) {
      charactersStore.update(s => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Select a character and load its details
   */
  async selectCharacter(id: string): Promise<void> {
    try {
      charactersStore.update(s => ({ ...s, isLoading: true }));
      const card = await charactersStorage.loadCharacter(id);
      charactersStore.selectCharacter(id, card);
    } catch (error) {
      charactersStore.update(s => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Save a character (updates existing or creates new)
   * Returns the character ID
   */
  async saveCharacter(id: string | null, character: CharacterCard): Promise<string> {
    try {
      if (id) {
        // Update existing character
        await charactersStorage.saveCharacter(id, character);
        // Update store with the saved character
        charactersStore.updateCharacter(id, character);
        return id;
      } else {
        // Create new character
        const newId = await charactersStorage.createCharacter(character);
        // Add to store list
        charactersStore.addCharacter(newId, character);
        return newId;
      }
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
      // Update store state directly
      charactersStore.removeCharacter(id);
    } catch (error) {
      throw error;
    }
  }
};
