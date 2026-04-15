/**
 * Concrete block executors
 */

import type {
  BlockType,
  BlockConfig,
  ExecutionContext,
  BlockExecutionResult,
  PortValue,
} from '$lib/types';

export async function executeBlock(
  blockType: BlockType,
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  switch (blockType) {
    case 'TextBlock':
      return executeTextBlock(config, context);
    case 'FieldBlock':
      return executeFieldBlock(config, context);
    case 'MemoryBlock':
      return executeMemoryBlock(config, inputs, context);
    case 'LorebookBlock':
      return executeLorebookBlock(config, context);
    case 'IfBlock':
      return executeIfBlock(config, inputs, context);
    case 'ToggleBlock':
      return executeToggleBlock(config, context);
    case 'MergeBlock':
      return executeMergeBlock(config, inputs, context);
    default:
      throw new Error(`No executor for block type: ${blockType}`);
  }
}

async function executeTextBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const content = (config.content as string) || '';
  const enabled = (config.enabled as boolean) ?? true;
  
  if (!enabled) {
    return {
      outputs: new Map([['text', '']]),
      fragments: [],
    };
  }

  // Simple variable substitution ({{char}}, {{user}}, etc.)
  let processedContent = content
    .replace(/\{\{char\}\}/g, context.characterId || 'Character')
    .replace(/\{\{user\}\}/g, 'User');

  return {
    outputs: new Map([['text', processedContent]]),
    fragments: [{
      text: processedContent,
      sourceBlockId: 'text-block',
      sourceBlockType: 'TextBlock',
    }],
  };
}

async function executeFieldBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const fieldType = (config.fieldType as string) || 'description';
  const fallback = (config.fallback as string) || '';
  
  // In real implementation, fetch from character store
  // For now, return fallback
  const content = fallback || `[${fieldType} field content]`;

  return {
    outputs: new Map([['text', content]]),
    fragments: [{
      text: content,
      sourceBlockId: 'field-block',
      sourceBlockType: 'FieldBlock',
    }],
  };
}

async function executeMemoryBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const count = (config.count as number) || 3;
  const format = (config.format as string) || 'bullet';
  
  // In real implementation, fetch from memory store
  // For now, return placeholder memories
  const memories = [
    'User enjoys sci-fi stories',
    'User prefers concise responses',
    'User likes character to be proactive',
  ].slice(0, count);

  let formattedMemories: string;
  switch (format) {
    case 'bullet':
      formattedMemories = memories.map(m => `- ${m}`).join('\n');
      break;
    case 'numbered':
      formattedMemories = memories.map((m, i) => `${i + 1}. ${m}`).join('\n');
      break;
    case 'paragraph':
    default:
      formattedMemories = memories.join('. ') + '.';
  }

  return {
    outputs: new Map([['memories', memories]]),
    fragments: [{
      text: formattedMemories,
      sourceBlockId: 'memory-block',
      sourceBlockType: 'MemoryBlock',
    }],
  };
}

async function executeLorebookBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const maxEntries = (config.maxEntries as number) || 5;
  
  // In real implementation, fetch from lorebook
  // For now, return placeholder entries
  const entries = [
    'The world is set in a cyberpunk future',
    'Magic exists but is rare and dangerous',
  ].slice(0, maxEntries);

  return {
    outputs: new Map([['entries', entries]]),
    fragments: [{
      text: entries.map(e => `[Lore] ${e}`).join('\n'),
      sourceBlockId: 'lorebook-block',
      sourceBlockType: 'LorebookBlock',
    }],
  };
}

async function executeIfBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const condition = inputs.get('condition') as boolean;
  const trueBranch = inputs.get('trueBranch') as string;
  const falseBranch = inputs.get('falseBranch') as string;

  const result = condition ? (trueBranch || '') : (falseBranch || '');

  return {
    outputs: new Map([['result', result]]),
    fragments: result ? [{
      text: result,
      sourceBlockId: 'if-block',
      sourceBlockType: 'IfBlock',
      metadata: {
        isConditional: true,
        conditionResult: condition,
      },
    }] : [],
  };
}

async function executeToggleBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const toggleId = (config.toggleId as string) || '';
  const scope = (config.scope as string) || 'local';
  const defaultValue = (config.defaultValue as boolean) ?? false;

  // Resolve toggle value
  let value = defaultValue;
  if (toggleId) {
    // Check context toggles first (local overrides global)
    if (context.toggles.has(toggleId)) {
      value = context.toggles.get(toggleId)!;
    }
  }

  return {
    outputs: new Map([['value', value]]),
    fragments: [], // Toggle blocks don't produce text directly
  };
}

async function executeMergeBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const separator = (config.separator as string) || '\n\n';
  const filterEmpty = (config.filterEmpty as boolean) ?? true;

  const texts: string[] = [];
  for (const [key, value] of inputs) {
    if (typeof value === 'string' && (!filterEmpty || value.trim())) {
      texts.push(value);
    }
  }

  const combined = texts.join(separator);

  return {
    outputs: new Map([['combined', combined]]),
    fragments: combined ? [{
      text: combined,
      sourceBlockId: 'merge-block',
      sourceBlockType: 'MergeBlock',
    }] : [],
  };
}
