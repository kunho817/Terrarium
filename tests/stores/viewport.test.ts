import { describe, it, expect, beforeEach } from 'vitest';
import { viewportStore, DEFAULT_VIEWPORT } from '../../src/lib/stores/viewport';
import { get } from 'svelte/store';

describe('viewport store', () => {
  beforeEach(() => {
    viewportStore.reset();
  });

  it('initializes with default values', () => {
    const state = get(viewportStore);
    expect(state).toEqual(DEFAULT_VIEWPORT);
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
    expect(state.zoom).toBe(1);
  });

  it('resets to default values', () => {
    viewportStore.setPosition(100, 200);
    viewportStore.reset();
    const state = get(viewportStore);
    expect(state).toEqual(DEFAULT_VIEWPORT);
  });

  it('sets position', () => {
    viewportStore.setPosition(100, 200);
    const state = get(viewportStore);
    expect(state.x).toBe(100);
    expect(state.y).toBe(200);
    expect(state.zoom).toBe(1);
  });

  it('sets zoom', () => {
    viewportStore.setZoom(2.0);
    const state = get(viewportStore);
    expect(state.zoom).toBe(2.0);
  });

  it('clamps zoom to minimum 0.1', () => {
    viewportStore.setZoom(0.05);
    const state = get(viewportStore);
    expect(state.zoom).toBe(0.1);
  });

  it('clamps zoom to maximum 3.0', () => {
    viewportStore.setZoom(5.0);
    const state = get(viewportStore);
    expect(state.zoom).toBe(3.0);
  });

  it('zooms by factor', () => {
    viewportStore.setZoom(1.0);
    viewportStore.zoomBy(2.0);
    const state = get(viewportStore);
    expect(state.zoom).toBe(2.0);
  });

  it('zooms toward point when center coordinates provided', () => {
    viewportStore.setPosition(0, 0);
    viewportStore.setZoom(1.0);
    viewportStore.zoomBy(2.0, 100, 100);
    const state = get(viewportStore);
    expect(state.zoom).toBe(2.0);
    // Position should shift to keep the point under cursor
    expect(state.x).not.toBe(0);
    expect(state.y).not.toBe(0);
  });

  it('pans by screen pixels converted to world space', () => {
    viewportStore.setPosition(0, 0);
    viewportStore.setZoom(2.0);
    viewportStore.panBy(100, 100);
    const state = get(viewportStore);
    // 100 pixels at zoom 2.0 = 50 world units
    expect(state.x).toBe(50);
    expect(state.y).toBe(50);
  });

  it('fits to bounds with padding', () => {
    viewportStore.fitToBounds(0, 0, 200, 150, 50);
    const state = get(viewportStore);
    // Center should be at (100, 75)
    expect(state.x).toBe(100);
    expect(state.y).toBe(75);
    // Zoom should fit 300x250 into 800x600
    expect(state.zoom).toBeGreaterThan(0);
    expect(state.zoom).toBeLessThanOrEqual(1.5);
  });

  it('maintains other state properties when updating position', () => {
    viewportStore.setZoom(2.0);
    viewportStore.setPosition(100, 200);
    const state = get(viewportStore);
    expect(state.zoom).toBe(2.0);
    expect(state.x).toBe(100);
    expect(state.y).toBe(200);
  });
});
