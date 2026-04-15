import { describe, it, expect, beforeEach } from 'vitest';
import { BlockRegistry } from '$lib/blocks/registry';
import type { BlockDefinition, BlockType } from '$lib/types';

describe('BlockRegistry', () => {
  let registry: BlockRegistry;

  beforeEach(() => {
    registry = new BlockRegistry();
  });

  it('registers a block definition', () => {
    const definition: BlockDefinition = {
      type: 'TextBlock' as BlockType,
      category: 'foundation',
      displayName: 'Text',
      icon: '📄',
      description: 'Static text block',
      color: '#89b4fa',
      inputPorts: [],
      outputPorts: [{ id: 'text', name: 'Text', type: 'text', direction: 'output', required: false }],
      defaultConfig: { content: '', enabled: true },
    };

    registry.register(definition);
    expect(registry.get('TextBlock')).toBe(definition);
  });

  it('throws when registering duplicate block type', () => {
    const definition: BlockDefinition = {
      type: 'TextBlock' as BlockType,
      category: 'foundation',
      displayName: 'Text',
      icon: '📄',
      description: 'Static text block',
      color: '#89b4fa',
      inputPorts: [],
      outputPorts: [],
      defaultConfig: {},
    };

    registry.register(definition);
    expect(() => registry.register(definition)).toThrow('Block type TextBlock already registered');
  });

  it('returns all registered blocks', () => {
    const textBlock: BlockDefinition = {
      type: 'TextBlock' as BlockType,
      category: 'foundation',
      displayName: 'Text',
      icon: '📄',
      description: 'Static text block',
      color: '#89b4fa',
      inputPorts: [],
      outputPorts: [],
      defaultConfig: {},
    };

    const ifBlock: BlockDefinition = {
      type: 'IfBlock' as BlockType,
      category: 'logic',
      displayName: 'If',
      icon: '🔀',
      description: 'Conditional logic',
      color: '#f38ba8',
      inputPorts: [],
      outputPorts: [],
      defaultConfig: {},
    };

    registry.register(textBlock);
    registry.register(ifBlock);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAllByCategory('foundation')).toHaveLength(1);
  });
});
