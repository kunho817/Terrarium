import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';
import { registerAllBlocks } from '$lib/blocks/registry';
import type { BlockInstance } from '$lib/types';

describe('BlockNode with ports', () => {
  beforeEach(() => {
    registerAllBlocks();
  });

  it('renders output ports for TextBlock', () => {
    const block: BlockInstance = {
      id: 'test-1',
      type: 'TextBlock',
      position: { x: 0, y: 0 },
      config: { content: 'Test', enabled: true }
    };
    
    const { container } = render(BlockNode, {
      props: { block, isSelected: false }
    });
    
    const outputPort = container.querySelector('[data-port-id="text"]');
    expect(outputPort).toBeTruthy();
  });
});
