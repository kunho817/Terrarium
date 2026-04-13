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

    async loadList() {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const list = await worldStorage.listWorlds();
        update((s) => ({ ...s, list, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async selectWorld(id: string) {
      update((s) => ({ ...s, isLoading: true }));
      try {
        const card = await worldStorage.loadWorld(id);
        update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
      } catch {
        update((s) => ({ ...s, isLoading: false }));
      }
    },

    async saveCurrent() {
      const state = get({ subscribe });
      if (state.currentId && state.current) {
        await worldStorage.saveWorld(state.currentId, state.current);
      }
    },

    async deleteWorld(id: string) {
      await worldStorage.deleteWorld(id);
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
  };
}

export const worldsStore = createWorldsStore();
