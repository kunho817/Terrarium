/**
 * Viewport/Camera state for block canvas
 */

import { writable } from 'svelte/store';

export interface ViewportState {
  x: number;      // Camera center X position in world space
  y: number;      // Camera center Y position in world space
  zoom: number;   // Scale factor (1.0 = 100%)
}

export const DEFAULT_VIEWPORT: ViewportState = {
  x: 0,
  y: 0,
  zoom: 1,
};

function createViewportStore() {
  const { subscribe, set, update } = writable<ViewportState>(DEFAULT_VIEWPORT);

  return {
    subscribe,
    
    reset: () => set(DEFAULT_VIEWPORT),
    
    setPosition: (x: number, y: number) => {
      update(v => ({ ...v, x, y }));
    },
    
    setZoom: (zoom: number) => {
      update(v => ({ ...v, zoom: Math.max(0.1, Math.min(3.0, zoom)) }));
    },
    
    zoomBy: (factor: number, centerX?: number, centerY?: number) => {
      update(v => {
        const newZoom = Math.max(0.1, Math.min(3.0, v.zoom * factor));
        
        // If center point provided, zoom toward that point
        if (centerX !== undefined && centerY !== undefined) {
          const dx = (centerX - v.x) * (1 - 1/factor);
          const dy = (centerY - v.y) * (1 - 1/factor);
          return {
            x: v.x + dx,
            y: v.y + dy,
            zoom: newZoom,
          };
        }
        
        return { ...v, zoom: newZoom };
      });
    },
    
    panBy: (dx: number, dy: number) => {
      update(v => ({
        ...v,
        x: v.x + dx / v.zoom,
        y: v.y + dy / v.zoom,
      }));
    },
    
    fitToBounds: (minX: number, minY: number, maxX: number, maxY: number, padding: number = 50) => {
      const width = maxX - minX + padding * 2;
      const height = maxY - minY + padding * 2;
      
      // Calculate zoom to fit (assume canvas size 800x600 for now)
      const zoomX = 800 / width;
      const zoomY = 600 / height;
      const zoom = Math.min(zoomX, zoomY, 1.5); // Cap at 150%
      
      set({
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        zoom,
      });
    },
  };
}

export const viewportStore = createViewportStore();
