import { writable, get } from 'svelte/store';
import type { WorldCard } from '$lib/types';
import * as worldStorage from '$lib/storage/worlds';

interface WorldsState {
  list: { id: string; name: string }[];
  currentId: string | null;
  current: WorldCard | null;
  isLoading: boolean;
}

function createWorldsStore() {
  const { subscribe, set, update } = writable<WorldsState>({
    list: [],
    currentId: null,
    current: null,
    isLoading: false,
  });

  return {
    subscribe,
    set,
    update,

    // Pure state helpers (no persistence)
    setWorlds(list: { id: string; name: string }[]) {
      update((s) => ({ ...s, list, isLoading: false }));
    },

    selectWorldState(id: string | null, current: WorldCard | null) {
      update((s) => ({ ...s, currentId: id, current, isLoading: false }));
    },

    updateWorldInList(id: string, name: string) {
      update((s) => ({
        ...s,
        list: s.list.map((w) => (w.id === id ? { ...w, name } : w)),
      }));
    },

    removeWorld(id: string) {
      update((s) => ({
        ...s,
        list: s.list.filter((w) => w.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },

    clearSelection() {
      update((s) => ({ ...s, currentId: null, current: null }));
    },

    reset() {
      set({
        list: [],
        currentId: null,
        current: null,
        isLoading: false,
      });
    },
  };
}

export const worldsStore = createWorldsStore();
