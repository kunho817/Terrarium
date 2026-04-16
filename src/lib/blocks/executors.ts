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

interface BlockContext {
  blockId: string;
}

export async function executeBlock(
  blockType: BlockType,
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext,
  blockContext?: BlockContext
): Promise<BlockExecutionResult> {
  const blockId = blockContext?.blockId || `${blockType}-${Date.now()}`;
  
  switch (blockType) {
    case 'TextBlock':
      return executeTextBlock(config, context, blockId);
    case 'FieldBlock':
      return executeFieldBlock(config, context, blockId);
    case 'MemoryBlock':
      return executeMemoryBlock(config, inputs, context, blockId);
    case 'LorebookBlock':
      return executeLorebookBlock(config, context, blockId);
    case 'IfBlock':
      return executeIfBlock(config, inputs, context, blockId);
    case 'ToggleBlock':
      return executeToggleBlock(config, context, blockId);
    case 'MergeBlock':
      return executeMergeBlock(config, inputs, context, blockId);
    default:
      throw new Error(`No executor for block type: ${blockType}`);
  }
}

async function executeTextBlock(
  config: BlockConfig,
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const content = (config.content as string) || '';
  const enabled = (config.enabled as boolean) ?? true;
  
  if (!enabled || !content.trim()) {
    return {
      outputs: new Map([['text', '']]),
      fragments: [],
    };
  }

  // Variable substitution
  let processedContent = content
    .replace(/\{\{char\}\}/g, context.characterId || 'Character')
    .replace(/\{\{user\}\}/g, 'User');

  return {
    outputs: new Map([['text', processedContent]]),
    fragments: [{
      text: processedContent,
      sourceBlockId: blockId,
      sourceBlockType: 'TextBlock',
    }],
  };
}

async function executeFieldBlock(
  config: BlockConfig,
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const fieldType = (config.fieldType as string) || 'description';
  const fallback = (config.fallback as string) || '';
  
  const content = fallback || `[${fieldType} field]`;

  return {
    outputs: new Map([['text', content]]),
    fragments: [{
      text: content,
      sourceBlockId: blockId,
      sourceBlockType: 'FieldBlock',
    }],
  };
}

async function executeMemoryBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const count = (config.count as number) || 3;
  const format = (config.format as string) || 'bullet';
  
  const memories = [
    'User enjoys sci-fi stories',
    'User prefers concise responses',
    'User likes proactive characters',
  ].slice(0, count);

  let formattedMemories: string;
  switch (format) {
    case 'bullet':
      formattedMemories = memories.map(m => `- ${m}`).join('\n');
      break;
    case 'numbered':
      formattedMemories = memories.map((m, i) => `${i + 1}. ${m}`).join('\n');
      break;
    default:
      formattedMemories = memories.join('. ') + '.';
  }

  return {
    outputs: new Map([['memories', memories]]),
    fragments: [{
      text: formattedMemories,
      sourceBlockId: blockId,
      sourceBlockType: 'MemoryBlock',
    }],
  };
}

async function executeLorebookBlock(
  config: BlockConfig,
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const maxEntries = (config.maxEntries as number) || 5;
  
  const entries = [
    'World setting: cyberpunk future',
    'Magic exists but is rare',
  ].slice(0, maxEntries);

  return {
    outputs: new Map([['entries', entries]]),
    fragments: [{
      text: entries.map(e => `[Lore] ${e}`).join('\n'),
      sourceBlockId: blockId,
      sourceBlockType: 'LorebookBlock',
    }],
  };
}

async function executeIfBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const condition = inputs.get('condition') as boolean;
  const trueBranch = inputs.get('trueBranch') as string;
  const falseBranch = inputs.get('falseBranch') as string;

  const result = condition ? (trueBranch || '') : (falseBranch || '');

  return {
    outputs: new Map([['result', result]]),
    fragments: result ? [{
      text: result,
      sourceBlockId: blockId,
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
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const toggleId = (config.toggleId as string) || '';
  const defaultValue = (config.defaultValue as boolean) ?? false;

  let value = defaultValue;
  if (toggleId && context.toggles.has(toggleId)) {
    value = context.toggles.get(toggleId)!;
  }

  return {
    outputs: new Map([['value', value]]),
    fragments: [],
  };
}

async function executeMergeBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext,
  blockId: string
): Promise<BlockExecutionResult> {
  const separator = (config.separator as string) || '\n\n';
  const filterEmpty = (config.filterEmpty as boolean) ?? true;

  const texts: string[] = [];
  for (const [, value] of inputs) {
    if (typeof value === 'string' && (!filterEmpty || value.trim())) {
      texts.push(value);
    }
  }

  const combined = texts.join(separator);

  return {
    outputs: new Map([['combined', combined]]),
    fragments: combined ? [{
      text: combined,
      sourceBlockId: blockId,
      sourceBlockType: 'MergeBlock',
    }] : [],
  };
}
