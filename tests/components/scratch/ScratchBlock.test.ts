import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ScratchBlock from '$lib/components/scratch/ScratchBlock.svelte';
import type { ScratchBlock as ScratchBlockType } from '$lib/types/scratch-blocks';

describe('ScratchBlock', () => {
  it('renders TextBlock', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Hello' },
      slots: {},
      next: null,
    };
    
    const { getByText } = render(ScratchBlock, { props: { block } });
    expect(getByText('📄')).toBeTruthy();
    expect(getByText('Text')).toBeTruthy();
  });

  it('renders block content', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Hello World' },
      slots: {},
      next: null,
    };
    
    const { getByText } = render(ScratchBlock, { props: { block } });
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders IfBlock with slots', () => {
    const block: ScratchBlockType = {
      id: 'if1',
      type: 'IfBlock',
      config: {},
      slots: {},
      next: null,
    };
    
    const { getByText, container } = render(ScratchBlock, { props: { block } });
    expect(getByText('🔀')).toBeTruthy();
    expect(getByText('If')).toBeTruthy();
    
    const slots = container.querySelectorAll('.slot');
    expect(slots.length).toBeGreaterThan(0);
  });

  it('has draggable attribute', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Test' },
      slots: {},
      next: null,
    };
    
    const { container } = render(ScratchBlock, { props: { block } });
    const blockEl = container.querySelector('[data-block-id="t1"]');
    expect(blockEl?.hasAttribute('draggable')).toBe(true);
  });

  it('shows notch at bottom for chaining', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Test' },
      slots: {},
      next: null,
    };
    
    const { container } = render(ScratchBlock, { props: { block } });
    const notch = container.querySelector('.notch');
    expect(notch).toBeTruthy();
  });
});
