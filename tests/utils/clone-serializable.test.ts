import { describe, expect, it } from 'vitest';
import { cloneSerializable } from '$lib/utils/clone-serializable';

describe('cloneSerializable', () => {
  it('deep-clones plain nested data without keeping shared references', () => {
    const source = {
      name: 'preset',
      graph: {
        blocks: [
          {
            id: 'a',
            config: {
              content: 'hello',
              enabled: true,
            },
          },
        ],
        connections: [],
      },
      tags: ['main', 'agent'],
    };

    const cloned = cloneSerializable(source);

    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned.graph).not.toBe(source.graph);
    expect(cloned.graph.blocks).not.toBe(source.graph.blocks);
    expect(cloned.graph.blocks[0]).not.toBe(source.graph.blocks[0]);
    expect(cloned.tags).not.toBe(source.tags);
  });
});
