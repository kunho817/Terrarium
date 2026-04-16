import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockPalette from '$lib/components/scratch/BlockPalette.svelte';

describe('BlockPalette', () => {
  it('renders foundation category', () => {
    const { container } = render(BlockPalette);
    const foundationHeader = container.querySelector('[data-category="foundation"]');
    expect(foundationHeader).toBeTruthy();
  });

  it('renders logic category', () => {
    const { container } = render(BlockPalette);
    const logicHeader = container.querySelector('[data-category="logic"]');
    expect(logicHeader).toBeTruthy();
  });

  it('renders TextBlock in palette', () => {
    const { getAllByText } = render(BlockPalette);
    expect(getAllByText('Text').length).toBeGreaterThan(0);
  });

  it('renders IfBlock in palette', () => {
    const { getAllByText } = render(BlockPalette);
    expect(getAllByText('If').length).toBeGreaterThan(0);
  });

  it('has draggable blocks', () => {
    const { container } = render(BlockPalette);
    const blocks = container.querySelectorAll('[draggable="true"]');
    expect(blocks.length).toBeGreaterThan(0);
  });
});
