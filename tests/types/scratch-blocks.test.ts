import { describe, it, expect } from 'vitest';
import type { ScratchBlock, ScratchScript, SlotDefinition, BlockDefinition } from '$lib/types/scratch-blocks';

describe('Scratch Block Types', () => {
  it('ScratchBlock has required fields', () => {
    const block: ScratchBlock = {
      id: 'test-1',
      type: 'TextBlock',
      config: { content: 'Hello' },
      slots: {},
      next: null,
    };
    
    expect(block.id).toBe('test-1');
    expect(block.type).toBe('TextBlock');
    expect(block.next).toBeNull();
  });

  it('ScratchScript has root block', () => {
    const script: ScratchScript = {
      id: 'script-1',
      name: 'Test Script',
      root: {
        id: 'block-1',
        type: 'TextBlock',
        config: { content: 'Test' },
        slots: {},
        next: null,
      },
    };
    
    expect(script.root.type).toBe('TextBlock');
  });

  it('SlotDefinition describes slot types', () => {
    const slot: SlotDefinition = {
      name: 'condition',
      type: 'boolean',
      acceptsMultiple: false,
    };
    
    expect(slot.type).toBe('boolean');
    expect(slot.acceptsMultiple).toBe(false);
  });

  it('BlockDefinition has slots metadata', () => {
    const def: BlockDefinition = {
      type: 'IfBlock',
      category: 'logic',
      displayName: 'If',
      icon: '🔀',
      color: '#f38ba8',
      slots: [
        { name: 'condition', type: 'boolean', acceptsMultiple: false },
        { name: 'then', type: 'chain', acceptsMultiple: false },
        { name: 'else', type: 'chain', acceptsMultiple: false },
      ],
      outputType: 'text',
      defaultConfig: {},
    };
    
    expect(def.slots).toHaveLength(3);
    expect(def.outputType).toBe('text');
  });
});
