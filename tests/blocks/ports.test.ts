import { describe, expect, it } from 'vitest';
import { getBlockInputPorts } from '$lib/blocks/ports';
import type { BlockInstance } from '$lib/types';

describe('ports', () => {
  it('expands merge input ports from block config', () => {
    const block: BlockInstance = {
      id: 'merge-1',
      type: 'MergeBlock',
      position: { x: 0, y: 0 },
      config: {
        inputCount: 5,
        separator: '\n\n',
        filterEmpty: true,
      },
    };

    const ports = getBlockInputPorts(block);
    expect(ports.map((port) => port.id)).toEqual([
      'input1',
      'input2',
      'input3',
      'input4',
      'input5',
    ]);
  });
});
