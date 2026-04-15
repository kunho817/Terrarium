/**
 * Scene repository — handles persistence for scene store.
 */

import { get } from 'svelte/store';
import { sceneStore } from '$lib/stores/scene';
import * as chatStorage from '$lib/storage/chats';

export const sceneRepo = {
  /**
   * Load scene for a specific character and session.
   */
  async loadScene(characterId: string, sessionId: string): Promise<void> {
    const scene = await chatStorage.loadScene(characterId, sessionId);
    const DEFAULT_SCENE = {
      location: '',
      time: '',
      mood: '',
      participatingCharacters: [],
      variables: {},
    };
    sceneStore.setSceneState(characterId, sessionId, scene ?? DEFAULT_SCENE);
  },

  /**
   * Legacy compat: auto-migrates and loads first session's scene.
   */
  async loadSceneLegacy(chatId: string): Promise<void> {
    await chatStorage.listSessions(chatId); // triggers migration
    const sessions = await chatStorage.listSessions(chatId);
    if (sessions.length > 0) {
      sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      const sessionId = sessions[0].id;
      await this.loadScene(chatId, sessionId);
    } else {
      sceneStore.reset();
    }
  },

  /**
   * Save current scene to storage.
   */
  async save(): Promise<void> {
    const state = get(sceneStore);
    const { currentCharacterId, currentSessionId } = state as any;
    if (currentCharacterId && currentSessionId) {
      const sceneState = {
        location: state.location,
        time: state.time,
        mood: state.mood,
        participatingCharacters: state.participatingCharacters,
        variables: state.variables,
      };
      await chatStorage.saveScene(currentCharacterId, currentSessionId, sceneState);
    }
  },
};
