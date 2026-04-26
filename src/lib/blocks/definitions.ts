/**
 * Built-in block definitions for the graph prompt builder.
 */

import type { BlockDefinition } from '$lib/types';
import { blockRegistry } from './registry';

const DEFINITIONS: BlockDefinition[] = [
  {
    type: 'TextBlock',
    category: 'foundation',
    displayName: 'Text',
    icon: 'TXT',
    description: 'Literal prompt text such as system notes, jailbreaks, or prefills.',
    color: '#89b4fa',
    inputPorts: [],
    outputPorts: [
      { id: 'text', name: 'Text', type: 'text', direction: 'output', required: false },
    ],
    defaultConfig: {
      itemType: 'plain',
      itemName: 'Text',
      role: 'system',
      content: '',
      enabled: true,
    },
  },
  {
    type: 'FieldBlock',
    category: 'foundation',
    displayName: 'Field',
    icon: 'FLD',
    description: 'Dynamic prompt slot such as description, persona, scenario, or chat history.',
    color: '#a6e3a1',
    inputPorts: [],
    outputPorts: [
      { id: 'text', name: 'Text', type: 'text', direction: 'output', required: false },
    ],
    defaultConfig: {
      fieldType: 'description',
      itemName: 'Description',
      role: 'system',
      template: '',
      enabled: true,
    },
  },
  {
    type: 'MemoryBlock',
    category: 'foundation',
    displayName: 'Memory',
    icon: 'MEM',
    description: 'Inject retrieved memory summaries.',
    color: '#f9e2af',
    inputPorts: [
      { id: 'context', name: 'Context', type: 'text', direction: 'input', required: false },
    ],
    outputPorts: [
      { id: 'memories', name: 'Memories', type: 'list', direction: 'output', required: false },
    ],
    defaultConfig: {
      itemName: 'Memory',
      role: 'system',
      enabled: true,
      count: 3,
      threshold: 0.7,
      format: 'bullet',
      template: '',
    },
  },
  {
    type: 'LorebookBlock',
    category: 'foundation',
    displayName: 'Lorebook',
    icon: 'LOR',
    description: 'Inject lorebook entries at a specific prompt position.',
    color: '#fab387',
    inputPorts: [],
    outputPorts: [
      { id: 'entries', name: 'Entries', type: 'list', direction: 'output', required: false },
    ],
    defaultConfig: {
      itemName: 'Lorebook',
      role: 'system',
      enabled: true,
      lorebookPosition: 'before_char',
      activationMode: 'keyword',
      maxEntries: 5,
      template: '',
    },
  },
  {
    type: 'IfBlock',
    category: 'logic',
    displayName: 'If',
    icon: 'IF',
    description: 'Return one branch when a boolean condition is true and another when false.',
    color: '#f38ba8',
    inputPorts: [
      { id: 'condition', name: 'Condition', type: 'boolean', direction: 'input', required: true },
      { id: 'trueBranch', name: 'If True', type: 'text', direction: 'input', required: false },
      { id: 'falseBranch', name: 'If False', type: 'text', direction: 'input', required: false },
    ],
    outputPorts: [
      { id: 'result', name: 'Result', type: 'text', direction: 'output', required: false },
    ],
    defaultConfig: {
      label: 'Condition',
    },
  },
  {
    type: 'ToggleBlock',
    category: 'logic',
    displayName: 'Toggle',
    icon: 'TGL',
    description: 'Expose a named boolean toggle inside preview logic.',
    color: '#cba6f7',
    inputPorts: [],
    outputPorts: [
      { id: 'value', name: 'Value', type: 'boolean', direction: 'output', required: false },
    ],
    defaultConfig: {
      toggleId: '',
      toggleName: 'Toggle',
      scope: 'local',
      defaultValue: false,
    },
  },
  {
    type: 'SwitchBlock',
    category: 'logic',
    displayName: 'Switch',
    icon: 'SWT',
    description: 'Select one branch from a variable value.',
    color: '#eba0ac',
    inputPorts: [
      { id: 'variable', name: 'Variable', type: 'text', direction: 'input', required: true },
    ],
    outputPorts: [
      { id: 'result', name: 'Result', type: 'text', direction: 'output', required: false },
    ],
    defaultConfig: {
      cases: [
        { value: 'default', text: '' },
      ],
      defaultCase: '',
    },
  },
  {
    type: 'MergeBlock',
    category: 'logic',
    displayName: 'Merge',
    icon: 'MRG',
    description: 'Combine a configurable number of text inputs with a custom separator.',
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
      inputCount: 3,
      separator: '\n\n',
      filterEmpty: true,
    },
  },
  {
    type: 'StageBlock',
    category: 'structure',
    displayName: 'Stage',
    icon: 'STG',
    description: 'Conceptual workflow stage with system and optional prefill lanes.',
    color: '#74c7ec',
    inputPorts: [
      { id: 'base', name: 'Base', type: 'text', direction: 'input', required: false },
      { id: 'augment1', name: 'Augment 1', type: 'text', direction: 'input', required: false },
      { id: 'augment2', name: 'Augment 2', type: 'text', direction: 'input', required: false },
      { id: 'prefill', name: 'Prefill', type: 'text', direction: 'input', required: false },
    ],
    outputPorts: [],
    defaultConfig: {
      stageKey: '',
      stageLabel: 'Stage',
      stageGroup: 'workflow',
      stageOrder: 0,
      composeMode: 'augment',
      separator: '\n\n',
      systemTargetKeys: [],
      prefillTargetKeys: [],
    },
  },
  {
    type: 'OutputBlock',
    category: 'structure',
    displayName: 'Output',
    icon: 'OUT',
    description: 'Target output node for agent prompts, image prompts, or grouped prompt results.',
    color: '#74c7ec',
    inputPorts: [
      { id: 'input', name: 'Input', type: 'text', direction: 'input', required: false },
    ],
    outputPorts: [],
    defaultConfig: {
      outputKey: '',
      outputLabel: 'Output',
      role: 'system',
      group: 'board',
    },
  },
];

export function registerAllBlocks(): void {
  for (const definition of DEFINITIONS) {
    if (!blockRegistry.has(definition.type)) {
      blockRegistry.register(definition);
    }
  }
}
