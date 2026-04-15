/**
 * Worlds repository — handles persistence for worlds store.
 */

import { get } from 'svelte/store';
import { worldsStore } from '$lib/stores/worlds';
import { StorageError, ValidationError } from '$lib/errors/error-types';
import { logger } from '$lib/utils/logger';
import * as worldStorage from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types';

const log = logger.scope('WorldsRepo');

export const worldsRepo = {
  /**
   * Load all worlds list.
   */
  async loadList(): Promise<void> {
    worldsStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Loading world list');
    
    try {
      const list = await worldStorage.listWorlds();
      worldsStore.setWorlds(list);
      log.info('World list loaded', { count: list.length });
    } catch (error) {
      worldsStore.update((s) => ({ ...s, isLoading: false }));
      throw new StorageError(
        'listWorlds',
        'Failed to load worlds',
        error as Error
      );
    }
  },

  /**
   * Select a world and load its details.
   */
  async selectWorld(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('id', 'World ID is required');
    }
    
    worldsStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Selecting world', { id });
    
    try {
      const card = await worldStorage.loadWorld(id);
      worldsStore.selectWorldState(id, card);
      log.info('World selected', { id, name: card.name });
    } catch (error) {
      worldsStore.update((s) => ({ ...s, isLoading: false }));
      throw new StorageError(
        'loadWorld',
        `Failed to load world`,
        error as Error
      );
    }
  },

  /**
   * Save the currently selected world.
   */
  async saveCurrent(): Promise<void> {
    const state = get(worldsStore);
    if (state.currentId && state.current) {
      try {
        await worldStorage.saveWorld(state.currentId, state.current);
        log.info('Current world saved', { id: state.currentId });
      } catch (error) {
        throw new StorageError(
          'saveCurrent',
          'Failed to save world',
          error as Error
        );
      }
    }
  },

  /**
   * Save a specific world by ID.
   */
  async saveWorld(id: string, card: WorldCard): Promise<void> {
    try {
      await worldStorage.saveWorld(id, card);
      log.info('World saved', { id, name: card.name });
    } catch (error) {
      throw new StorageError(
        'saveWorld',
        'Failed to save world',
        error as Error
      );
    }
  },

  /**
   * Delete a world.
   */
  async deleteWorld(id: string): Promise<void> {
    try {
      await worldStorage.deleteWorld(id);
      const state = get(worldsStore);
      if (state.currentId === id) {
        worldsStore.clearSelection();
      }
      worldsStore.update((s) => ({
        ...s,
        list: s.list.filter((w) => w.id !== id),
      }));
      log.info('World deleted', { id });
    } catch (error) {
      throw new StorageError(
        'deleteWorld',
        'Failed to delete world',
        error as Error
      );
    }
  },
};
