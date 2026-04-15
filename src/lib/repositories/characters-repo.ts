/**
 * Characters repository — handles persistence for characters store.
 */

import { get } from 'svelte/store';
import { charactersStore } from '$lib/stores/characters';
import { StorageError, ValidationError } from '$lib/errors/error-types';
import { logger } from '$lib/utils/logger';
import * as characterStorage from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

const log = logger.scope('CharactersRepo');

export const charactersRepo = {
  /**
   * Load all characters list.
   */
  async loadList(): Promise<void> {
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Loading character list');
    
    try {
      const list = await characterStorage.listCharacters();
      charactersStore.setCharacters(list);
      log.info('Character list loaded', { count: list.length });
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw new StorageError(
        'listCharacters',
        'Failed to load characters',
        error as Error
      );
    }
  },

  /**
   * Select a character and load its details.
   */
  async selectCharacter(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('id', 'Character ID is required');
    }
    
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Selecting character', { id });
    
    try {
      const card = await characterStorage.loadCharacter(id);
      charactersStore.selectCharacterState(id, card);
      log.info('Character selected', { id, name: card.name });
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw new StorageError(
        'loadCharacter',
        `Failed to load character`,
        error as Error
      );
    }
  },

  /**
   * Save the currently selected character.
   */
  async saveCurrent(): Promise<void> {
    const state = get(charactersStore);
    if (state.currentId && state.current) {
      try {
        await characterStorage.saveCharacter(state.currentId, state.current);
        log.info('Current character saved', { id: state.currentId });
      } catch (error) {
        throw new StorageError(
          'saveCurrent',
          'Failed to save character',
          error as Error
        );
      }
    }
  },

  /**
   * Save a specific character by ID.
   */
  async saveCharacter(id: string, card: CharacterCard): Promise<void> {
    try {
      await characterStorage.saveCharacter(id, card);
      log.info('Character saved', { id, name: card.name });
    } catch (error) {
      throw new StorageError(
        'saveCharacter',
        'Failed to save character',
        error as Error
      );
    }
  },

  /**
   * Delete a character.
   */
  async deleteCharacter(id: string): Promise<void> {
    try {
      await characterStorage.deleteCharacter(id);
      const state = get(charactersStore);
      if (state.currentId === id) {
        charactersStore.clearSelection();
      }
      charactersStore.update((s) => ({
        ...s,
        list: s.list.filter((c) => c.id !== id),
      }));
      log.info('Character deleted', { id });
    } catch (error) {
      throw new StorageError(
        'deleteCharacter',
        'Failed to delete character',
        error as Error
      );
    }
  },
};
