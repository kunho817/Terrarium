import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';
import type { BlockInstance } from '$lib/types';

describe('BlockNode (simplified)', () => {
  it('renders block with header and content', () => {
    const block: BlockInstance = {
      id: 'test-1',
      type: 'TextBlock',
      position: { x: 0, y: 0 },
      config: { content: 'Hello World', enabled: true }
    };
    
    const { container } = render(BlockNode, {
      props: { block, isSelected: false }
    });
    
    expect(container.textContent).toContain('Text');
    expect(container.textContent).toContain('Hello World');
  });
});
