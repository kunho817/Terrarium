import type { BlockDefinition, BlockType } from '$lib/types/scratch-blocks';

class ScratchBlockRegistry {
  private definitions = new Map<BlockType, BlockDefinition>();

  register(definition: BlockDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  get(type: BlockType): BlockDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByCategory(category: BlockDefinition['category']): BlockDefinition[] {
    return this.getAll().filter(d => d.category === category);
  }
}

export const scratchBlockRegistry = new ScratchBlockRegistry();

scratchBlockRegistry.register({
  type: 'TextBlock',
  category: 'foundation',
  displayName: 'Text',
  icon: '📄',
  color: '#89b4fa',
  slots: [],
  outputType: 'text',
  defaultConfig: { content: '' },
});

scratchBlockRegistry.register({
  type: 'FieldBlock',
  category: 'foundation',
  displayName: 'Field',
  icon: '🏷️',
  color: '#a6e3a1',
  slots: [],
  outputType: 'text',
  defaultConfig: { fieldType: 'description', fallback: '' },
});

scratchBlockRegistry.register({
  type: 'MemoryBlock',
  category: 'foundation',
  displayName: 'Memory',
  icon: '💾',
  color: '#f9e2af',
  slots: [],
  outputType: 'list',
  defaultConfig: { count: 3, threshold: 0.7, format: 'bullet' },
});

scratchBlockRegistry.register({
  type: 'LorebookBlock',
  category: 'foundation',
  displayName: 'Lorebook',
  icon: '📚',
  color: '#fab387',
  slots: [],
  outputType: 'list',
  defaultConfig: { activationMode: 'keyword', maxEntries: 5, format: 'bullet' },
});

scratchBlockRegistry.register({
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
});

scratchBlockRegistry.register({
  type: 'ToggleBlock',
  category: 'logic',
  displayName: 'Toggle',
  icon: '⚙️',
  color: '#cba6f7',
  slots: [],
  outputType: 'boolean',
  defaultConfig: { toggleId: '', defaultValue: false },
});

scratchBlockRegistry.register({
  type: 'SwitchBlock',
  category: 'logic',
  displayName: 'Switch',
  icon: '📦',
  color: '#eba0ac',
  slots: [
    { name: 'variable', type: 'text', acceptsMultiple: false },
  ],
  outputType: 'text',
  defaultConfig: { cases: [], defaultCase: '' },
});

scratchBlockRegistry.register({
  type: 'MergeBlock',
  category: 'logic',
  displayName: 'Merge',
  icon: '🔗',
  color: '#94e2d5',
  slots: [
    { name: 'input1', type: 'text', acceptsMultiple: false },
    { name: 'input2', type: 'text', acceptsMultiple: false },
    { name: 'input3', type: 'text', acceptsMultiple: false },
  ],
  outputType: 'text',
  defaultConfig: { separator: '\n\n', filterEmpty: true },
});

export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return scratchBlockRegistry.get(type);
}

export function getAllBlocksByCategory(category: BlockDefinition['category']): BlockDefinition[] {
  return scratchBlockRegistry.getByCategory(category);
}
