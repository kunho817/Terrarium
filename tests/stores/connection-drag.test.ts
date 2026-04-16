import { describe, it, expect, beforeEach } from 'vitest';
import { connectionDragStore, DEFAULT_CONNECTION_DRAG } from '../../src/lib/stores/connection-drag';
import { get } from 'svelte/store';

describe('connectionDragStore', () => {
  beforeEach(() => {
    connectionDragStore.reset();
  });

  it('initializes with default values', () => {
    const state = get(connectionDragStore);
    expect(state).toEqual(DEFAULT_CONNECTION_DRAG);
    expect(state.isDragging).toBe(false);
  });

  it('starts drag with all parameters', () => {
    connectionDragStore.startDrag('block-1', 'output-port', false, 100, 200);
    const state = get(connectionDragStore);
    expect(state.isDragging).toBe(true);
    expect(state.fromBlockId).toBe('block-1');
    expect(state.fromPortId).toBe('output-port');
    expect(state.isInput).toBe(false);
    expect(state.mouseX).toBe(100);
    expect(state.mouseY).toBe(200);
  });

  it('tracks input port drag', () => {
    connectionDragStore.startDrag('block-2', 'input-port', true, 50, 75);
    const state = get(connectionDragStore);
    expect(state.isDragging).toBe(true);
    expect(state.fromBlockId).toBe('block-2');
    expect(state.fromPortId).toBe('input-port');
    expect(state.isInput).toBe(true);
  });

  it('updates mouse position during drag', () => {
    connectionDragStore.startDrag('block-1', 'output', false, 100, 100);
    connectionDragStore.updateMouse(200, 250);
    const state = get(connectionDragStore);
    expect(state.isDragging).toBe(true);
    expect(state.mouseX).toBe(200);
    expect(state.mouseY).toBe(250);
  });

  it('ends drag and resets state', () => {
    connectionDragStore.startDrag('block-1', 'output', false, 100, 100);
    connectionDragStore.endDrag();
    const state = get(connectionDragStore);
    expect(state).toEqual(DEFAULT_CONNECTION_DRAG);
    expect(state.isDragging).toBe(false);
    expect(state.fromBlockId).toBe(null);
  });

  it('resets to default state', () => {
    connectionDragStore.startDrag('block-1', 'port', false, 100, 100);
    connectionDragStore.reset();
    const state = get(connectionDragStore);
    expect(state).toEqual(DEFAULT_CONNECTION_DRAG);
  });

  it('maintains drag state when only updating mouse position', () => {
    connectionDragStore.startDrag('block-1', 'output', false, 100, 100);
    connectionDragStore.updateMouse(150, 150);
    const state = get(connectionDragStore);
    expect(state.fromBlockId).toBe('block-1');
    expect(state.fromPortId).toBe('output');
    expect(state.isInput).toBe(false);
  });
});
