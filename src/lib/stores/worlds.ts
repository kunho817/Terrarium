/**
 * Worlds store — pure reactive state only.
 * Persistence handled by worldsRepo in repositories/worlds-repo.ts
 */

import { writable } from 'svelte/store';
import type { WorldCard } from '$lib/types';

export interface WorldsState {
  worlds: { id: string; name: string }[];
  currentId: string | null;
  current: WorldCard | null;
  isLoading: boolean;
}

const DEFAULT_STATE: WorldsState = {
  worlds: [],
  currentId: null,
  current: null,
  isLoading: false,
};

function createWorldsStore() {
  const { subscribe, set, update } = writable<WorldsState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    
    // Helper methods that only update state (no persistence)
    setWorlds: (worlds: { id: string; name: string }[]) => {
      update(s => ({ ...s, worlds, isLoading: false }));
    },
    
    selectWorld: (id: string | null, world: WorldCard | null) => {
      update(s => ({ ...s, currentId: id, current: world }));
    },
    
    addWorld: (world: { id: string; name: string }) => {
      update(s => ({ ...s, worlds: [...s.worlds, world] }));
    },
    
    updateWorld: (id: string, world: { id: string; name: string }) => {
      update(s => ({
        ...s,
        worlds: s.worlds.map(w => w.id === id ? world : w),
      }));
    },
    
    removeWorld: (id: string) => {
      update(s => ({
        ...s,
        worlds: s.worlds.filter(w => w.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },
    
    clearSelection: () => {
      update(s => ({ ...s, currentId: null, current: null }));
    },
    
    reset: () => set(DEFAULT_STATE),
  };
}

export const worldsStore = createWorldsStore();
