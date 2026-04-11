/**
 * Scene store — reactive state for simulation scene.
 * Session-aware: tracks characterId + sessionId.
 */

import { writable, get } from 'svelte/store';
import type { SceneState, VariableValue } from '$lib/types';
import * as chatStorage from '$lib/storage/chats';

const DEFAULT_SCENE: SceneState = {
  location: '',
  time: '',
  mood: '',
  participatingCharacters: [],
  variables: {},
};

function createSceneStore() {
  const { subscribe, set, update } = writable<SceneState>({ ...DEFAULT_SCENE });

  let currentCharacterId: string | null = null;
  let currentSessionId: string | null = null;

  return {
    subscribe,

    async loadScene(characterId: string, sessionId: string) {
      currentCharacterId = characterId;
      currentSessionId = sessionId;
      const scene = await chatStorage.loadScene(characterId, sessionId);
      set(scene ?? { ...DEFAULT_SCENE });
    },

    /**
     * Legacy compat: auto-migrates and loads first session's scene.
     */
    async loadSceneLegacy(chatId: string) {
      currentCharacterId = chatId;
      await chatStorage.listSessions(chatId); // triggers migration
      const sessions = await chatStorage.listSessions(chatId);
      if (sessions.length > 0) {
        sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        currentSessionId = sessions[0].id;
        const scene = await chatStorage.loadScene(chatId, sessions[0].id);
        set(scene ?? { ...DEFAULT_SCENE });
      } else {
        currentSessionId = null;
        set({ ...DEFAULT_SCENE });
      }
    },

    updateScene(partial: Partial<SceneState>) {
      update((s) => ({ ...s, ...partial }));
    },

    setVariable(key: string, value: VariableValue) {
      update((s) => ({ ...s, variables: { ...s.variables, [key]: value } }));
    },

    async save() {
      if (currentCharacterId && currentSessionId) {
        const state = get({ subscribe });
        await chatStorage.saveScene(currentCharacterId, currentSessionId, state);
      }
    },

    reset() {
      currentCharacterId = null;
      currentSessionId = null;
      set({ ...DEFAULT_SCENE });
    },
  };
}

export const sceneStore = createSceneStore();
