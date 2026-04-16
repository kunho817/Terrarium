import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';
import type { BlockInstance } from '$lib/types';

describe('BlockNode collapse', () => {
  it('shows collapse button', () => {
    const block: BlockInstance = {
      id: '1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Test' }
    };
    const { container } = render(BlockNode, { props: { block, isSelected: false } });
    expect(container.querySelector('.collapse-btn')).toBeTruthy();
  });

  it('hides body when collapsed', () => {
    const block: BlockInstance = {
      id: '1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Test' }, collapsed: true
    };
    const { container } = render(BlockNode, { props: { block, isSelected: false } });
    expect(container.querySelector('.block-body')).toBeFalsy();
  });

  it('shows body when expanded', () => {
    const block: BlockInstance = {
      id: '1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Test' }, collapsed: false
    };
    const { container } = render(BlockNode, { props: { block, isSelected: false } });
    expect(container.querySelector('.block-body')).toBeTruthy();
  });
});
