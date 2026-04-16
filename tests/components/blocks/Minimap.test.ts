import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Minimap from '$lib/components/blocks/Minimap.svelte';
import type { BlockGraph } from '$lib/types';

describe('Minimap', () => {
  it('renders with empty graph', () => {
    const graph: BlockGraph = { version: '1.0', blocks: [], connections: [] };
    const { container } = render(Minimap, {
      props: { graph, scale: 1, offsetX: 0, offsetY: 0, containerWidth: 800, containerHeight: 600 }
    });
    expect(container.querySelector('.minimap')).toBeTruthy();
  });

  it('renders blocks as rectangles', () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [{ id: '1', type: 'TextBlock', position: { x: 100, y: 100 }, config: {} }],
      connections: []
    };
    const { container } = render(Minimap, {
      props: { graph, scale: 1, offsetX: 0, offsetY: 0, containerWidth: 800, containerHeight: 600 }
    });
    expect(container.querySelector('rect')).toBeTruthy();
  });
});
