import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ScratchCanvas from '$lib/components/scratch/ScratchCanvas.svelte';
import { scratchScriptStore } from '$lib/stores/scratch-script';
import { get } from 'svelte/store';

describe('ScratchCanvas', () => {
  beforeEach(() => {
    scratchScriptStore.reset();
  });

  it('renders empty state message', () => {
    const { getByText } = render(ScratchCanvas);
    expect(getByText(/drag a block/i)).toBeTruthy();
  });

  it('renders blocks from script', () => {
    scratchScriptStore.newScript('Test');
    const state = get(scratchScriptStore);
    
    const { container } = render(ScratchCanvas);
    const blocks = container.querySelectorAll('[data-block-id]');
    
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('is a drop zone', () => {
    const { container } = render(ScratchCanvas);
    const canvas = container.querySelector('.scratch-canvas');
    
    expect(canvas).toBeTruthy();
  });
});
