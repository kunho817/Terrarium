/**
 * Scene repository — handles persistence for scene store.
 */

import { get } from 'svelte/store';
import { sceneStore } from '$lib/stores/scene';
import { StorageError } from '$lib/errors/error-types';
import { logger } from '$lib/utils/logger';
import * as chatStorage from '$lib/storage/chats';

const log = logger.scope('SceneRepo');

export const sceneRepo = {
  /**
   * Load scene for a specific character and session.
   */
  async loadScene(characterId: string, sessionId: string): Promise<void> {
    try {
      const scene = await chatStorage.loadScene(characterId, sessionId);
      const DEFAULT_SCENE = {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
        environmentalNotes: '',
        lastUpdated: 0,
      };
      sceneStore.setSceneState(characterId, sessionId, scene ?? DEFAULT_SCENE);
      log.debug('Scene loaded', { characterId, sessionId });
    } catch (error) {
      throw new StorageError(
        'loadScene',
        'Failed to load scene',
        error as Error
      );
    }
  },

  /**
   * Legacy compat: auto-migrates and loads first session's scene.
   */
  async loadSceneLegacy(chatId: string): Promise<void> {
    try {
      await chatStorage.listSessions(chatId); // triggers migration
      const sessions = await chatStorage.listSessions(chatId);
      if (sessions.length > 0) {
        sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        const sessionId = sessions[0].id;
        await this.loadScene(chatId, sessionId);
      } else {
        sceneStore.reset();
        log.debug('No sessions found, scene reset', { chatId });
      }
    } catch (error) {
      throw new StorageError(
        'loadSceneLegacy',
        'Failed to load scene',
        error as Error
      );
    }
  },

  /**
   * Save current scene to storage.
   */
  async save(): Promise<void> {
    try {
      const state = get(sceneStore);
      const { currentCharacterId, currentSessionId } = state;
      if (currentCharacterId && currentSessionId) {
        const sceneState = {
          location: state.location,
          time: state.time,
          mood: state.mood,
          participatingCharacters: state.participatingCharacters,
          variables: state.variables,
          environmentalNotes: state.environmentalNotes,
          lastUpdated: state.lastUpdated,
        };
        await chatStorage.saveScene(currentCharacterId, currentSessionId, sceneState);
        log.debug('Scene saved', { characterId: currentCharacterId, sessionId: currentSessionId });
      }
    } catch (error) {
      throw new StorageError(
        'saveScene',
        'Failed to save scene',
        error as Error
      );
    }
  },
};
