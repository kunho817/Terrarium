import { describe, it, expect } from 'vitest';
import Port from '$lib/components/blocks/Port.svelte';

describe('Port', () => {
  it('exports a Svelte component', () => {
    expect(Port).toBeDefined();
    expect(typeof Port).toBe('function');
  });
});
