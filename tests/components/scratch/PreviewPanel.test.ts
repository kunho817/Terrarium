import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PreviewPanel from '$lib/components/scratch/PreviewPanel.svelte';

describe('PreviewPanel', () => {
  it('renders preview title', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: 'Test prompt', tokens: 10 } });
    expect(getByText('Preview')).toBeTruthy();
  });

  it('displays prompt content', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: 'Hello World', tokens: 2 } });
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('displays token count', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: 'Test', tokens: 127 } });
    expect(getByText(/127/)).toBeTruthy();
  });

  it('has close button', () => {
    const { container } = render(PreviewPanel, { props: { prompt: '', tokens: 0 } });
    const closeBtn = container.querySelector('[data-action="close"]');
    expect(closeBtn).toBeTruthy();
  });

  it('shows empty state when no prompt', () => {
    const { container } = render(PreviewPanel, { props: { prompt: '', tokens: 0 } });
    const emptyState = container.querySelector('.preview-content .empty-state');
    expect(emptyState).toBeTruthy();
  });
});
