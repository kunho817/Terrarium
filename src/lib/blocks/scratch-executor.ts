import type { ScratchBlock } from '$lib/types/scratch-blocks';

export interface ExecutionContext {
  toggles?: Map<string, boolean>;
  characterFields?: Record<string, string>;
  memories?: Array<{ content: string; relevance: number }>;
  lorebookEntries?: Array<{ keywords: string[]; content: string }>;
}

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'false') return false;
    return value.length > 0;
  }
  return Boolean(value);
}

function formatList(items: string[], format: 'bullet' | 'paragraph'): string {
  if (items.length === 0) return '';
  
  if (format === 'bullet') {
    return items.map(item => `- ${item}`).join('\n');
  }
  return items.join('\n\n');
}

export function executeScratchBlock(block: ScratchBlock, context: ExecutionContext): string {
  switch (block.type) {
    case 'TextBlock':
      return block.config.content as string ?? '';

    case 'FieldBlock': {
      const fieldType = block.config.fieldType as string;
      const fallback = block.config.fallback as string ?? '';
      const fields = context.characterFields ?? {};
      return fields[fieldType] ?? fallback;
    }

    case 'ToggleBlock': {
      const toggleId = block.config.toggleId as string;
      const defaultValue = block.config.defaultValue as boolean ?? false;
      const toggles = context.toggles ?? new Map();
      return toggles.get(toggleId) ?? defaultValue ? 'true' : 'false';
    }

    case 'MemoryBlock': {
      const count = block.config.count as number ?? 3;
      const format = block.config.format as 'bullet' | 'paragraph' ?? 'bullet';
      const memories = context.memories ?? [];
      
      const items = memories
        .slice(0, count)
        .map(m => m.content);
      
      return formatList(items, format);
    }

    case 'LorebookBlock': {
      const maxEntries = block.config.maxEntries as number ?? 5;
      const format = block.config.format as 'bullet' | 'paragraph' ?? 'bullet';
      const entries = context.lorebookEntries ?? [];
      
      const items = entries
        .slice(0, maxEntries)
        .map(e => e.content);
      
      return formatList(items, format);
    }

    case 'IfBlock': {
      const conditionBlock = block.slots.condition;
      const conditionValue = conditionBlock ? executeScratchBlock(conditionBlock, context) : '';
      
      if (isTruthy(conditionValue)) {
        const thenBlock = block.slots.then;
        return thenBlock ? executeChain(thenBlock, context) : '';
      } else {
        const elseBlock = block.slots.else;
        return elseBlock ? executeChain(elseBlock, context) : '';
      }
    }

    case 'MergeBlock': {
      const separator = block.config.separator as string ?? '\n\n';
      const filterEmpty = block.config.filterEmpty as boolean ?? true;
      
      const inputs = ['input1', 'input2', 'input3']
        .map(slotName => block.slots[slotName])
        .filter(Boolean)
        .map(b => b ? executeScratchBlock(b, context) : '');
      
      const filtered = filterEmpty ? inputs.filter(s => s.trim()) : inputs;
      return filtered.join(separator);
    }

    case 'SwitchBlock': {
      const variableBlock = block.slots.variable;
      const variable = variableBlock ? executeScratchBlock(variableBlock, context) : '';
      const cases = block.config.cases as Array<{ value: string; result: string }> ?? [];
      const defaultCase = block.config.defaultCase as string ?? '';
      
      const match = cases.find(c => c.value === variable);
      return match?.result ?? defaultCase;
    }

    default:
      return '';
  }
}

export function executeChain(block: ScratchBlock | null, context: ExecutionContext = {}): string {
  if (!block) return '';
  
  const current = executeScratchBlock(block, context);
  const next = executeChain(block.next, context);
  
  if (!current.trim()) return next;
  if (!next.trim()) return current;
  return `${current}\n${next}`;
}
