import { writable } from 'svelte/store';
import type { ScratchBlock, ScratchScript } from '$lib/types/scratch-blocks';
import { createBlock } from '$lib/types/scratch-blocks';

export interface ScratchScriptState {
  currentScript: ScratchScript | null;
  scripts: ScratchScript[];
}

export function createEmptyScript(name: string): ScratchScript {
  return {
    id: crypto.randomUUID(),
    name,
    root: createBlock('TextBlock', crypto.randomUUID()),
  };
}

function createScratchScriptStore() {
  const { subscribe, set, update } = writable<ScratchScriptState>({
    currentScript: null,
    scripts: [],
  });

  function findBlockById(block: ScratchBlock | null, id: string): ScratchBlock | null {
    if (!block) return null;
    if (block.id === id) return block;
    
    for (const slotBlock of Object.values(block.slots)) {
      const found = findBlockById(slotBlock, id);
      if (found) return found;
    }
    
    return findBlockById(block.next, id);
  }

  function findParentOf(block: ScratchBlock | null, targetId: string, parent: ScratchBlock | null = null, slotName?: string): { parent: ScratchBlock | null; slotName?: string } | null {
    if (!block) return null;
    if (block.next?.id === targetId) return { parent: block };
    
    for (const [name, slotBlock] of Object.entries(block.slots)) {
      if (slotBlock?.id === targetId) {
        return { parent: block, slotName: name };
      }
      const found = findParentOf(slotBlock, targetId, block, name);
      if (found) return found;
    }
    
    return findParentOf(block.next, targetId, block);
  }

  function deepClone(block: ScratchBlock): ScratchBlock {
    return {
      ...block,
      config: { ...block.config },
      slots: Object.fromEntries(
        Object.entries(block.slots).map(([k, v]) => [k, v ? deepClone(v) : null])
      ),
      next: block.next ? deepClone(block.next) : null,
    };
  }

  return {
    subscribe,

    reset: () => {
      set({
        currentScript: null,
        scripts: [],
      });
    },

    newScript: (name: string) => {
      const script = createEmptyScript(name);
      update(state => ({
        ...state,
        currentScript: script,
        scripts: [...state.scripts, script],
      }));
    },

    setRootBlock: (block: ScratchBlock) => {
      update(state => {
        if (!state.currentScript) return state;
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root: block,
          },
        };
      });
    },

    appendToChain: (block: ScratchBlock) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        let current = root;
        while (current.next) {
          current = current.next;
        }
        current.next = block;
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    nestInSlot: (blockId: string, slotName: string, block: ScratchBlock) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        const target = findBlockById(root, blockId);
        if (target) {
          target.slots[slotName] = block;
        }
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    removeBlock: (blockId: string) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        
        if (root.id === blockId) {
          const newRoot = root.next || createBlock('TextBlock', crypto.randomUUID());
          return {
            ...state,
            currentScript: {
              ...state.currentScript,
              root: newRoot,
            },
          };
        }
        
        const result = findParentOf(root, blockId);
        if (result?.parent) {
          if (result.slotName) {
            result.parent.slots[result.slotName] = null;
          } else {
            const toRemove = result.parent.next;
            if (toRemove) {
              result.parent.next = toRemove.next;
            }
          }
        }
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    updateBlockConfig: (blockId: string, config: Record<string, unknown>) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        const block = findBlockById(root, blockId);
        if (block) {
          block.config = { ...block.config, ...config };
        }
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    duplicateBlock: (blockId: string) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        const block = findBlockById(root, blockId);
        if (!block) return state;
        
        const duplicate = deepClone({
          ...block,
          id: crypto.randomUUID(),
        });
        
        let current = root;
        while (current.next) {
          current = current.next;
        }
        current.next = duplicate;
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },
  };
}

export const scratchScriptStore = createScratchScriptStore();
