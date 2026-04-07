/**
 * Scene store — reactive state for simulation scene.
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

  let currentChatId: string | null = null;

  return {
    subscribe,

    async loadScene(chatId: string) {
      currentChatId = chatId;
      const scene = await chatStorage.loadScene(chatId);
      set(scene ?? { ...DEFAULT_SCENE });
    },

    updateScene(partial: Partial<SceneState>) {
      update((s) => ({ ...s, ...partial }));
    },

    setVariable(key: string, value: VariableValue) {
      update((s) => ({ ...s, variables: { ...s.variables, [key]: value } }));
    },

    async save() {
      if (currentChatId) {
        const state = get({ subscribe });
        await chatStorage.saveScene(currentChatId, state);
      }
    },

    reset() {
      currentChatId = null;
      set({ ...DEFAULT_SCENE });
    },
  };
}

export const sceneStore = createSceneStore();
