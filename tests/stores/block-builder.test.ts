import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { blockBuilderStore, createEmptyGraph } from '$lib/stores/block-builder';
import type { BlockInstance } from '$lib/types';

describe('blockBuilderStore', () => {
  beforeEach(() => {
    blockBuilderStore.reset();
  });

  it('initializes with empty graph', () => {
    const state = get(blockBuilderStore);
    expect(state.currentGraph).toEqual(createEmptyGraph());
  });

  it('adds a block', () => {
    const block: BlockInstance = {
      id: 'test-block',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    blockBuilderStore.addBlock(block);
    const state = get(blockBuilderStore);
    
    expect(state.currentGraph.blocks).toHaveLength(1);
    expect(state.currentGraph.blocks[0]).toEqual(block);
  });

  it('removes a block', () => {
    const block: BlockInstance = {
      id: 'test-block',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    blockBuilderStore.addBlock(block);
    blockBuilderStore.removeBlock('test-block');
    const state = get(blockBuilderStore);
    
    expect(state.currentGraph.blocks).toHaveLength(0);
  });

  it('updates block position', () => {
    const block: BlockInstance = {
      id: 'test-block',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    blockBuilderStore.addBlock(block);
    blockBuilderStore.updateBlockPosition('test-block', { x: 200, y: 200 });
    const state = get(blockBuilderStore);
    
    expect(state.currentGraph.blocks[0].position).toEqual({ x: 200, y: 200 });
  });
});
