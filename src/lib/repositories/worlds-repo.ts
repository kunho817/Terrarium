/**
 * Worlds repository — handles persistence for worlds store.
 */

import { get } from 'svelte/store';
import { worldsStore } from '$lib/stores/worlds';
import * as worldStorage from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';

export const worldsRepo = {
  /**
   * Load all worlds list.
   */
  async loadList(): Promise<void> {
    worldsStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const list = await worldStorage.listWorlds();
      worldsStore.update((s) => ({ ...s, list, isLoading: false }));
    } catch (error) {
      worldsStore.update((s) => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Select a world and load its details.
   */
  async selectWorld(id: string): Promise<void> {
    worldsStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const card = await worldStorage.loadWorld(id);
      worldsStore.update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
    } catch (error) {
      worldsStore.update((s) => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Save the currently selected world.
   */
  async saveCurrent(): Promise<void> {
    const state = get(worldsStore);
    if (state.currentId && state.current) {
      await worldStorage.saveWorld(state.currentId, state.current);
    }
  },

  /**
   * Save a specific world by ID.
   */
  async saveWorld(id: string, card: WorldCard): Promise<void> {
    await worldStorage.saveWorld(id, card);
  },

  /**
   * Delete a world.
   */
  async deleteWorld(id: string): Promise<void> {
    await worldStorage.deleteWorld(id);
    const state = get(worldsStore);
    if (state.currentId === id) {
      worldsStore.clearSelection();
    }
    worldsStore.update((s) => ({
      ...s,
      list: s.list.filter((w) => w.id !== id),
    }));
  },
};
