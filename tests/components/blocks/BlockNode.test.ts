import { describe, it, expect } from 'vitest';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';

describe('BlockNode', () => {
  it('should be a Svelte component', () => {
    expect(typeof BlockNode).toBe('function');
  });
});
