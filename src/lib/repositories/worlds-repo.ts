/**
 * Worlds repository — handles persistence for worlds store.
 */

import { worldsStore } from '$lib/stores/worlds';
import * as worldsStorage from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';

export const worldsRepo = {
  /**
   * Load all worlds
   */
  async load(): Promise<void> {
    try {
      worldsStore.update(s => ({ ...s, isLoading: true }));
      const list = await worldsStorage.listWorlds();
      worldsStore.update(s => ({ ...s, list, isLoading: false }));
    } catch (error) {
      worldsStore.update(s => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Select a world and load its details
   */
  async selectWorld(id: string): Promise<void> {
    try {
      worldsStore.update(s => ({ ...s, isLoading: true }));
      const card = await worldsStorage.loadWorld(id);
      worldsStore.update(s => ({ ...s, currentId: id, current: card, isLoading: false }));
    } catch (error) {
      worldsStore.update(s => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Save a world (updates existing or creates new)
   * Returns the world ID
   */
  async saveWorld(id: string | null, world: WorldCard): Promise<string> {
    try {
      if (id) {
        // Update existing world
        await worldsStorage.saveWorld(id, world);
        // Update store - refresh list to get updated name
        const list = await worldsStorage.listWorlds();
        worldsStore.update(s => ({ ...s, list }));
        return id;
      } else {
        // Create new world
        const newId = await worldsStorage.createWorld(world);
        // Add to store list
        const list = await worldsStorage.listWorlds();
        worldsStore.update(s => ({ ...s, list }));
        return newId;
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a world
   */
  async deleteWorld(id: string): Promise<void> {
    try {
      await worldsStorage.deleteWorld(id);
      // Update store state directly
      worldsStore.update(s => ({
        ...s,
        list: s.list.filter((w) => w.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    } catch (error) {
      throw error;
    }
  }
};
