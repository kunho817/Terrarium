/**
 * Scene store — reactive state for simulation scene.
 * Session-aware: tracks characterId + sessionId.
 */

import { writable, get } from 'svelte/store';
import type { SceneState, VariableValue } from '$lib/types';

export interface SceneStateWithContext extends SceneState {
  currentCharacterId: string | null;
  currentSessionId: string | null;
}

function createSceneStore() {
  const DEFAULT_SCENE: SceneStateWithContext = {
    location: '',
    time: '',
    mood: '',
    participatingCharacters: [],
    variables: {},
    environmentalNotes: '',
    lastUpdated: 0,
    currentCharacterId: null,
    currentSessionId: null,
  };

  const { subscribe, set, update } = writable<SceneStateWithContext>(DEFAULT_SCENE);

  return {
    subscribe,
    set,
    update,

    // Pure state helpers (no persistence)
    setSceneState(characterId: string, sessionId: string, scene: SceneState) {
      update((s) => ({
        ...s,
        ...scene,
        currentCharacterId: characterId,
        currentSessionId: sessionId,
      }));
    },

    updateScene(partial: Partial<SceneState>) {
      update((s) => ({ ...s, ...partial }));
    },

    setVariable(key: string, value: VariableValue) {
      update((s) => ({ ...s, variables: { ...s.variables, [key]: value } }));
    },

    clearVariable(key: string) {
      update((s) => {
        const { [key]: _, ...rest } = s.variables;
        return { ...s, variables: rest };
      });
    },

    reset() {
      set(DEFAULT_SCENE);
    },
  };
}

export const sceneStore = createSceneStore();
