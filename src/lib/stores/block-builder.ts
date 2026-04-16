/**
 * Block builder state store
 */

import { writable } from 'svelte/store';
import type { BlockGraph, BlockInstance, Connection } from '$lib/types';

export interface BlockBuilderState {
  currentGraph: BlockGraph;
  selectedBlockId: string | null;
  history: BlockGraph[];
  historyIndex: number;
}

export function createEmptyGraph(): BlockGraph {
  return {
    version: '1.0',
    blocks: [],
    connections: [],
  };
}

function createBlockBuilderStore() {
  const { subscribe, set, update } = writable<BlockBuilderState>({
    currentGraph: createEmptyGraph(),
    selectedBlockId: null,
    history: [createEmptyGraph()],
    historyIndex: 0,
  });

  return {
    subscribe,
    
    reset: () => {
      set({
        currentGraph: createEmptyGraph(),
        selectedBlockId: null,
        history: [createEmptyGraph()],
        historyIndex: 0,
      });
    },

    addBlock: (block: BlockInstance) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: [...state.currentGraph.blocks, block],
        },
      }));
    },

    removeBlock: (blockId: string) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: state.currentGraph.blocks.filter((b) => b.id !== blockId),
          connections: state.currentGraph.connections.filter(
            (c) => c.from.blockId !== blockId && c.to.blockId !== blockId
          ),
        },
      }));
    },

    updateBlockPosition: (blockId: string, position: { x: number; y: number }) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: state.currentGraph.blocks.map((b) =>
            b.id === blockId ? { ...b, position } : b
          ),
        },
      }));
    },

    updateBlockConfig: (blockId: string, config: Record<string, unknown>) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: state.currentGraph.blocks.map((b) =>
            b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b
          ),
        },
      }));
    },

    addConnection: (connection: Connection) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          connections: [...state.currentGraph.connections, connection],
        },
      }));
    },

    removeConnection: (connectionId: string) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          connections: state.currentGraph.connections.filter((c) => c.id !== connectionId),
        },
      }));
    },

    setGraph: (graph: BlockGraph) => {
      update((state) => ({
        ...state,
        currentGraph: graph,
      }));
    },

    selectBlock: (blockId: string | null) => {
      update((state) => ({
        ...state,
        selectedBlockId: blockId,
      }));
    },
  };
}

export const blockBuilderStore = createBlockBuilderStore();
