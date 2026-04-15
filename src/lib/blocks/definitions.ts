/**
 * Block definitions for the prompt builder
 */

import type { BlockDefinition } from '$lib/types';
import { blockRegistry } from './registry';

// Text Block
const textBlock: BlockDefinition = {
  type: 'TextBlock',
  category: 'foundation',
  displayName: 'Text',
  icon: '📄',
  description: 'Static text with template variable support',
  color: '#89b4fa',
  inputPorts: [],
  outputPorts: [
    { id: 'text', name: 'Text', type: 'text', direction: 'output', required: false },
  ],
  defaultConfig: {
    content: '',
    enabled: true,
  },
};

// Field Block
const fieldBlock: BlockDefinition = {
  type: 'FieldBlock',
  category: 'foundation',
  displayName: 'Field',
  icon: '🏷️',
  description: 'Character card field (jailbreak, description, etc.)',
  color: '#a6e3a1',
  inputPorts: [],
  outputPorts: [
    { id: 'text', name: 'Text', type: 'text', direction: 'output', required: false },
  ],
  defaultConfig: {
    fieldType: 'description',
    fallback: '',
  },
};

// Memory Block
const memoryBlock: BlockDefinition = {
  type: 'MemoryBlock',
  category: 'foundation',
  displayName: 'Memory',
  icon: '💾',
  description: 'Retrieve memories based on similarity',
  color: '#f9e2af',
  inputPorts: [
    { id: 'context', name: 'Context', type: 'text', direction: 'input', required: false },
  ],
  outputPorts: [
    { id: 'memories', name: 'Memories', type: 'list', direction: 'output', required: false },
  ],
  defaultConfig: {
    count: 3,
    threshold: 0.7,
    format: 'bullet',
  },
};

// Lorebook Block
const lorebookBlock: BlockDefinition = {
  type: 'LorebookBlock',
  category: 'foundation',
  displayName: 'Lorebook',
  icon: '📚',
  description: 'Inject lorebook entries',
  color: '#fab387',
  inputPorts: [],
  outputPorts: [
    { id: 'entries', name: 'Entries', type: 'list', direction: 'output', required: false },
  ],
  defaultConfig: {
    activationMode: 'keyword',
    maxEntries: 5,
  },
};

// If Block
const ifBlock: BlockDefinition = {
  type: 'IfBlock',
  category: 'logic',
  displayName: 'If',
  icon: '🔀',
  description: 'Conditional text inclusion',
  color: '#f38ba8',
  inputPorts: [
    { id: 'condition', name: 'Condition', type: 'boolean', direction: 'input', required: true },
    { id: 'trueBranch', name: 'If True', type: 'text', direction: 'input', required: false },
    { id: 'falseBranch', name: 'If False', type: 'text', direction: 'input', required: false },
  ],
  outputPorts: [
    { id: 'result', name: 'Result', type: 'text', direction: 'output', required: false },
  ],
  defaultConfig: {},
};

// Toggle Block
const toggleBlock: BlockDefinition = {
  type: 'ToggleBlock',
  category: 'logic',
  displayName: 'Toggle',
  icon: '⚙️',
  description: 'Reference a named toggle',
  color: '#cba6f7',
  inputPorts: [],
  outputPorts: [
    { id: 'value', name: 'Value', type: 'boolean', direction: 'output', required: false },
  ],
  defaultConfig: {
    toggleId: '',
    scope: 'local',
    defaultValue: false,
  },
};

// Switch Block
const switchBlock: BlockDefinition = {
  type: 'SwitchBlock',
  category: 'logic',
  displayName: 'Switch',
  icon: '📦',
  description: 'Multiple conditional branches',
  color: '#eba0ac',
  inputPorts: [
    { id: 'variable', name: 'Variable', type: 'text', direction: 'input', required: true },
  ],
  outputPorts: [
    { id: 'result', name: 'Result', type: 'text', direction: 'output', required: false },
  ],
  defaultConfig: {
    cases: [],
    defaultCase: '',
  },
};

// Merge Block
const mergeBlock: BlockDefinition = {
  type: 'MergeBlock',
  category: 'logic',
  displayName: 'Merge',
  icon: '🔗',
  description: 'Combine multiple text inputs',
  color: '#94e2d5',
  inputPorts: [
    { id: 'input1', name: 'Input 1', type: 'text', direction: 'input', required: false },
    { id: 'input2', name: 'Input 2', type: 'text', direction: 'input', required: false },
    { id: 'input3', name: 'Input 3', type: 'text', direction: 'input', required: false },
  ],
  outputPorts: [
    { id: 'combined', name: 'Combined', type: 'text', direction: 'output', required: false },
  ],
  defaultConfig: {
    separator: '\n\n',
    filterEmpty: true,
  },
};

export function registerAllBlocks(): void {
  blockRegistry.register(textBlock);
  blockRegistry.register(fieldBlock);
  blockRegistry.register(memoryBlock);
  blockRegistry.register(lorebookBlock);
  blockRegistry.register(ifBlock);
  blockRegistry.register(toggleBlock);
  blockRegistry.register(switchBlock);
  blockRegistry.register(mergeBlock);
}
