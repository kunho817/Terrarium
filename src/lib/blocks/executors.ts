/**
 * Concrete executors used by the graph preview.
 */

import type {
  BlockConfig,
  BlockExecutionResult,
  BlockType,
  ExecutionContext,
  PortValue,
} from '$lib/types';

interface BlockContext {
  blockId: string;
}

const FIELD_PLACEHOLDERS: Record<string, string> = {
  description: '[Description]',
  worldDescription: '[World Description]',
  persona: '[User Persona]',
  personality: '[Personality]',
  scenario: '[Scenario]',
  exampleMessages: '[Example Messages]',
  chatHistory: '[Chat History]',
  depthPrompt: '[Depth Prompt]',
  director: '[Director Guidance]',
  sceneState: '[Scene State]',
  characterState: '[Character State]',
  narrativeGuidance: '[Narrative Guidance]',
  sectionWorld: '[Section World]',
  worldRelations: '[World Relations]',
};

function makeFragment(
  blockId: string,
  blockType: BlockType,
  text: string,
  metadata?: Record<string, unknown>,
) {
  return text.trim()
    ? [{
        text,
        sourceBlockId: blockId,
        sourceBlockType: blockType,
        metadata,
      }]
    : [];
}

function applySlotTemplate(template: string, slotValue: string): string {
  if (!template.trim()) {
    return slotValue;
  }
  return template.includes('{{slot}}')
    ? template.replace(/\{\{slot\}\}/g, slotValue)
    : template;
}

function formatList(items: string[], format: string): string {
  switch (format) {
    case 'numbered':
      return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
    case 'paragraph':
      return items.join(' ');
    case 'bullet':
    default:
      return items.map((item) => `- ${item}`).join('\n');
  }
}

function stringifyPortValue(value: PortValue): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.join('\n');
  }

  return '';
}

export async function executeBlock(
  blockType: BlockType,
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext,
  blockContext?: BlockContext,
): Promise<BlockExecutionResult> {
  const blockId = blockContext?.blockId || `${blockType}-${Date.now()}`;

  switch (blockType) {
    case 'TextBlock':
      return executeTextBlock(config, context, blockId);
    case 'FieldBlock':
      return executeFieldBlock(config, blockId);
    case 'MemoryBlock':
      return executeMemoryBlock(config, blockId);
    case 'LorebookBlock':
      return executeLorebookBlock(config, blockId);
    case 'IfBlock':
      return executeIfBlock(inputs, blockId);
    case 'ToggleBlock':
      return executeToggleBlock(config, context);
    case 'SwitchBlock':
      return executeSwitchBlock(config, inputs, blockId);
    case 'MergeBlock':
      return executeMergeBlock(config, inputs, blockId);
    case 'StageBlock':
      return executeStageBlock(config, inputs, blockId);
    case 'OutputBlock':
      return executeOutputBlock(config, inputs, blockId);
    default:
      throw new Error(`No executor for block type: ${blockType}`);
  }
}

async function executeTextBlock(
  config: BlockConfig,
  context: ExecutionContext,
  blockId: string,
): Promise<BlockExecutionResult> {
  const content = String(config.content || '');
  const enabled = (config.enabled as boolean) ?? true;

  if (!enabled || !content.trim()) {
    return {
      outputs: new Map([['text', '']]),
      fragments: [],
    };
  }

  const processedContent = content
    .replace(/\{\{char\}\}/g, context.characterId || 'Character')
    .replace(/\{\{user\}\}/g, 'User');

  return {
    outputs: new Map([['text', processedContent]]),
    fragments: makeFragment(blockId, 'TextBlock', processedContent),
  };
}

async function executeFieldBlock(
  config: BlockConfig,
  blockId: string,
): Promise<BlockExecutionResult> {
  const fieldType = String(config.fieldType || 'description');
  const template = String(config.template ?? config.fallback ?? '');
  const enabled = (config.enabled as boolean) ?? true;

  if (!enabled) {
    return {
      outputs: new Map([['text', '']]),
      fragments: [],
    };
  }

  const placeholder = FIELD_PLACEHOLDERS[fieldType] || `[${fieldType}]`;
  const content = applySlotTemplate(template, placeholder);

  return {
    outputs: new Map([['text', content]]),
    fragments: makeFragment(blockId, 'FieldBlock', content),
  };
}

async function executeMemoryBlock(
  config: BlockConfig,
  blockId: string,
): Promise<BlockExecutionResult> {
  const count = Math.max(1, Number(config.count ?? 3));
  const format = String(config.format || 'bullet');
  const enabled = (config.enabled as boolean) ?? true;

  if (!enabled) {
    return {
      outputs: new Map([['memories', []]]),
      fragments: [],
    };
  }

  const memories = [
    'The user prefers scene-based replies.',
    'The current relationship is still tentative.',
    'A prior argument still colors the tone of the scene.',
  ].slice(0, count);

  const text = formatList(memories, format);
  return {
    outputs: new Map([['memories', memories]]),
    fragments: makeFragment(blockId, 'MemoryBlock', text),
  };
}

async function executeLorebookBlock(
  config: BlockConfig,
  blockId: string,
): Promise<BlockExecutionResult> {
  const enabled = (config.enabled as boolean) ?? true;
  if (!enabled) {
    return {
      outputs: new Map([['entries', []]]),
      fragments: [],
    };
  }

  const position = String(config.lorebookPosition || 'before_char');
  const template = String(config.template || '');
  const entry = `[Lorebook:${position}]`;
  const text = applySlotTemplate(template, entry);

  return {
    outputs: new Map([['entries', [entry]]]),
    fragments: makeFragment(blockId, 'LorebookBlock', text),
  };
}

async function executeIfBlock(
  inputs: Map<string, PortValue>,
  blockId: string,
): Promise<BlockExecutionResult> {
  const condition = Boolean(inputs.get('condition'));
  const trueBranch = stringifyPortValue(inputs.get('trueBranch'));
  const falseBranch = stringifyPortValue(inputs.get('falseBranch'));
  const result = condition ? trueBranch : falseBranch;

  return {
    outputs: new Map([['result', result]]),
    fragments: makeFragment(blockId, 'IfBlock', result, {
      isConditional: true,
      conditionResult: condition,
    }),
  };
}

async function executeToggleBlock(
  config: BlockConfig,
  context: ExecutionContext,
): Promise<BlockExecutionResult> {
  const toggleId = String(config.toggleId || '');
  const defaultValue = Boolean(config.defaultValue ?? false);
  const value = toggleId && context.toggles.has(toggleId)
    ? Boolean(context.toggles.get(toggleId))
    : defaultValue;

  return {
    outputs: new Map([['value', value]]),
    fragments: [],
  };
}

async function executeSwitchBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  blockId: string,
): Promise<BlockExecutionResult> {
  const variable = stringifyPortValue(inputs.get('variable'));
  const cases = Array.isArray(config.cases) ? config.cases : [];
  const match = cases.find((entry) => String((entry as { value?: string }).value || '') === variable) as
    | { value?: string; text?: string }
    | undefined;

  const result = String(match?.text || config.defaultCase || '');
  return {
    outputs: new Map([['result', result]]),
    fragments: makeFragment(blockId, 'SwitchBlock', result),
  };
}

async function executeMergeBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  blockId: string,
): Promise<BlockExecutionResult> {
  const separator = String(config.separator || '\n\n');
  const filterEmpty = (config.filterEmpty as boolean) ?? true;

  const texts = Array.from(inputs.values())
    .map((value) => stringifyPortValue(value))
    .filter((value) => !filterEmpty || value.trim().length > 0);

  const combined = texts.join(separator);
  return {
    outputs: new Map([['combined', combined]]),
    fragments: makeFragment(blockId, 'MergeBlock', combined),
  };
}

async function executeOutputBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  blockId: string,
): Promise<BlockExecutionResult> {
  const text = stringifyPortValue(inputs.get('input'));

  return {
    outputs: new Map(),
    fragments: makeFragment(blockId, 'OutputBlock', text, {
      outputKey: String(config.outputKey || ''),
    }),
  };
}

async function executeStageBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  blockId: string,
): Promise<BlockExecutionResult> {
  const separator = String(config.separator || '\n\n');
  const system = [
    stringifyPortValue(inputs.get('augment')),
    stringifyPortValue(inputs.get('base')),
    stringifyPortValue(inputs.get('augment1')),
    stringifyPortValue(inputs.get('augment2')),
  ]
    .filter((value) => value.trim().length > 0)
    .join(separator);
  const prefill = stringifyPortValue(inputs.get('prefill')).trim();

  const fragments = [
    ...makeFragment(blockId, 'StageBlock', system, {
      stageKey: String(config.stageKey || ''),
      stageLabel: String(config.stageLabel || ''),
      channel: 'system',
    }),
    ...makeFragment(blockId, 'StageBlock', prefill, {
      stageKey: String(config.stageKey || ''),
      stageLabel: String(config.stageLabel || ''),
      channel: 'assistant',
    }),
  ];

  return {
    outputs: new Map([
      ['system', system],
      ['prefill', prefill],
    ]),
    fragments,
  };
}
