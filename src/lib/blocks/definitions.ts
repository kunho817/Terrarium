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

export function registerAllBlocks(): void {
  blockRegistry.register(textBlock);
  blockRegistry.register(fieldBlock);
  blockRegistry.register(memoryBlock);
  blockRegistry.register(lorebookBlock);
}
