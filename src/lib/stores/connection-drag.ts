/**
 * Connection drag state for block canvas
 * Tracks the state when user is dragging to create a new connection
 */

import { writable } from 'svelte/store';

export interface ConnectionDragState {
  isDragging: boolean;
  fromBlockId: string | null;
  fromPortId: string | null;
  isInput: boolean;
  mouseX: number;
  mouseY: number;
}

export const DEFAULT_CONNECTION_DRAG: ConnectionDragState = {
  isDragging: false,
  fromBlockId: null,
  fromPortId: null,
  isInput: false,
  mouseX: 0,
  mouseY: 0,
};

function createConnectionDragStore() {
  const { subscribe, set, update } = writable<ConnectionDragState>(DEFAULT_CONNECTION_DRAG);

  return {
    subscribe,
    
    reset: () => set(DEFAULT_CONNECTION_DRAG),
    
    startDrag: (blockId: string, portId: string, isInput: boolean, x: number, y: number) => {
      set({
        isDragging: true,
        fromBlockId: blockId,
        fromPortId: portId,
        isInput,
        mouseX: x,
        mouseY: y,
      });
    },
    
    updateMouse: (x: number, y: number) => {
      update(s => ({ ...s, mouseX: x, mouseY: y }));
    },
    
    endDrag: () => {
      set(DEFAULT_CONNECTION_DRAG);
    },
  };
}

export const connectionDragStore = createConnectionDragStore();
