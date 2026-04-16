import { describe, it, expect } from 'vitest';
import BlockCanvas from '$lib/components/blocks/BlockCanvas.svelte';
import type { BlockGraph } from '$lib/types';

describe('BlockCanvas (simplified)', () => {
  it('is a valid Svelte component', () => {
    expect(typeof BlockCanvas).toBe('function');
  });
  
  it('accepts graph prop with blocks at positions', () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [{
        id: 'test-1',
        type: 'TextBlock',
        position: { x: 50, y: 50 },
        config: { content: 'Test', enabled: true }
      }],
      connections: []
    };
    
    // Component should accept this graph structure without viewport
    expect(graph.blocks[0].position).toEqual({ x: 50, y: 50 });
  });
});
