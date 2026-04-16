import { writable, get } from 'svelte/store';

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const DEFAULT_STATE: ViewportState = {
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.0;

function createViewportStore() {
  const { subscribe, set, update } = writable<ViewportState>(DEFAULT_STATE);

  return {
    subscribe,
    
    reset: () => set(DEFAULT_STATE),
    
    setScale: (scale: number) => {
      update(s => ({ ...s, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) }));
    },
    
    setOffset: (offsetX: number, offsetY: number) => {
      update(s => ({ ...s, offsetX, offsetY }));
    },
    
    zoomAt: (screenX: number, screenY: number, delta: number) => {
      update(state => {
        const oldScale = state.scale;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale + delta));
        
        if (newScale === oldScale) return state;
        
        const canvasX = (screenX - state.offsetX) / oldScale;
        const canvasY = (screenY - state.offsetY) / oldScale;
        
        const newOffsetX = screenX - canvasX * newScale;
        const newOffsetY = screenY - canvasY * newScale;
        
        return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
      });
    },
    
    pan: (deltaX: number, deltaY: number) => {
      update(s => ({
        ...s,
        offsetX: s.offsetX + deltaX,
        offsetY: s.offsetY + deltaY,
      }));
    },
    
    canvasToScreen: (canvasX: number, canvasY: number) => {
      const state = get({ subscribe });
      return {
        x: canvasX * state.scale + state.offsetX,
        y: canvasY * state.scale + state.offsetY,
      };
    },
    
    screenToCanvas: (screenX: number, screenY: number) => {
      const state = get({ subscribe });
      return {
        x: (screenX - state.offsetX) / state.scale,
        y: (screenY - state.offsetY) / state.scale,
      };
    },
    
    fitToContent: (
      blocks: Array<{ position: { x: number; y: number } }>,
      containerWidth: number,
      containerHeight: number,
      padding: number = 50
    ) => {
      if (blocks.length === 0) {
        set({ scale: 1.0, offsetX: containerWidth / 2, offsetY: containerHeight / 2 });
        return;
      }
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const block of blocks) {
        minX = Math.min(minX, block.position.x);
        minY = Math.min(minY, block.position.y);
        maxX = Math.max(maxX, block.position.x + 208);
        maxY = Math.max(maxY, block.position.y + 100);
      }
      
      const contentWidth = maxX - minX + padding * 2;
      const contentHeight = maxY - minY + padding * 2;
      
      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const scale = Math.min(scaleX, scaleY, MAX_SCALE);
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      set({
        scale,
        offsetX: containerWidth / 2 - centerX * scale,
        offsetY: containerHeight / 2 - centerY * scale,
      });
    },
  };
}

export const viewportStore = createViewportStore();
