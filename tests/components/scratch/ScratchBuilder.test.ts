import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ScratchBuilder from '$lib/components/scratch/ScratchBuilder.svelte';

describe('ScratchBuilder', () => {
  it('renders full layout', () => {
    const { container } = render(ScratchBuilder);
    
    expect(container.querySelector('.palette')).toBeTruthy();
    expect(container.querySelector('.scratch-canvas')).toBeTruthy();
    expect(container.querySelector('.preview-panel')).toBeTruthy();
  });

  it('has header with title', () => {
    const { container } = render(ScratchBuilder);
    const title = container.querySelector('.builder-header h1');
    expect(title?.textContent).toBe('Prompt Builder');
  });

  it('has preview toggle button', () => {
    const { container } = render(ScratchBuilder);
    const toggleBtn = container.querySelector('[data-action="toggle-preview"]');
    expect(toggleBtn).toBeTruthy();
  });
});
