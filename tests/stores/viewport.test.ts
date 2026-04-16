import { describe, it, expect, beforeEach } from 'vitest';
import { viewportStore } from '../../src/lib/stores/viewport';
import { get } from 'svelte/store';

describe('viewportStore', () => {
  beforeEach(() => {
    viewportStore.reset();
  });

  it('has default state', () => {
    const state = get(viewportStore);
    expect(state.scale).toBe(1.0);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('zooms centered on a point', () => {
    viewportStore.reset();
    viewportStore.zoomAt(100, 100, 0.1);
    
    const state = get(viewportStore);
    expect(state.scale).toBeCloseTo(1.1, 2);
  });

  it('pans by screen delta', () => {
    viewportStore.reset();
    viewportStore.pan(50, 30);
    
    const state = get(viewportStore);
    expect(state.offsetX).toBe(50);
    expect(state.offsetY).toBe(30);
  });

  it('clamps scale between 0.25 and 2.0', () => {
    viewportStore.reset();
    viewportStore.zoomAt(0, 0, 10);
    expect(get(viewportStore).scale).toBe(2.0);
    
    viewportStore.reset();
    viewportStore.zoomAt(0, 0, -10);
    expect(get(viewportStore).scale).toBe(0.25);
  });

  it('converts coordinates', () => {
    viewportStore.reset();
    
    let screen = viewportStore.canvasToScreen(100, 100);
    expect(screen.x).toBe(100);
    expect(screen.y).toBe(100);
    
    viewportStore.pan(50, 25);
    screen = viewportStore.canvasToScreen(100, 100);
    expect(screen.x).toBe(150);
    expect(screen.y).toBe(125);
  });

  it('converts screen to canvas coordinates', () => {
    viewportStore.reset();
    viewportStore.pan(50, 25);
    
    const canvas = viewportStore.screenToCanvas(150, 125);
    expect(canvas.x).toBe(100);
    expect(canvas.y).toBe(100);
  });
});
