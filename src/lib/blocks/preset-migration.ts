/**
 * Preset ↔ Block migration utilities
 */

import type { PromptPreset, PromptItem, BlockGraph, BlockInstance, Connection } from '$lib/types';

export function presetToBlocks(preset: PromptPreset): BlockGraph {
  const blocks: BlockInstance[] = [];
  let yOffset = 50;

  for (const item of preset.items) {
    if (!item.enabled) continue;

    const block = promptItemToBlock(item, yOffset);
    if (block) {
      blocks.push(block);
      yOffset += 100;
    }
  }

  // Note: We don't create connections between blocks because:
  // 1. TextBlocks don't have input ports
  // 2. The execution engine processes blocks by Y-position order
  // 3. Each block produces its own fragment that gets assembled

  return {
    version: '1.0',
    blocks,
    connections: [],
  };
}

function promptItemToBlock(item: PromptItem, y: number): BlockInstance | null {
  const base = {
    id: `preset-${item.id}`,
    position: { x: 100, y },
  };

  switch (item.type) {
    case 'system':
    case 'jailbreak':
    case 'personality':
    case 'scenario':
      return {
        ...base,
        type: 'TextBlock',
        config: {
          content: item.content,
          enabled: item.enabled,
        },
      };

    case 'description':
      return {
        ...base,
        type: 'FieldBlock',
        config: {
          fieldType: 'description',
          fallback: item.content,
        },
      };

    case 'lorebook':
      return {
        ...base,
        type: 'LorebookBlock',
        config: {
          activationMode: 'keyword',
          maxEntries: 5,
        },
      };

    case 'chatHistory':
      // Chat history isn't a block - it's handled by chat system
      return null;

    default:
      // Unknown types become text blocks
      return {
        ...base,
        type: 'TextBlock',
        config: {
          content: item.content || '',
          enabled: item.enabled,
        },
      };
  }
}

export function blocksToPreset(
  graph: BlockGraph,
  toggles: Map<string, boolean>
): PromptPreset {
  const items: PromptItem[] = [];
  let order = 0;

  // Sort blocks by Y position (top to bottom)
  const sortedBlocks = [...graph.blocks].sort((a, b) => a.position.y - b.position.y);

  for (const block of sortedBlocks) {
    const item = blockToPromptItem(block, order);
    if (item) {
      items.push(item);
      order++;
    }
  }

  return {
    id: 'migrated',
    name: 'Migrated from Blocks',
    assistantPrefill: '',
    items,
  };
}

function blockToPromptItem(block: BlockInstance, order: number): PromptItem | null {
  const base = {
    id: `block-${block.id}`,
    name: block.type,
    enabled: (block.config.enabled as boolean) ?? true,
    role: 'system' as const,
  };

  switch (block.type) {
    case 'TextBlock':
      return {
        ...base,
        type: 'plain' as const,
        content: (block.config.content as string) || '',
      };

    case 'FieldBlock':
      return {
        ...base,
        type: 'plain' as const,
        content: (block.config.fallback as string) || '',
      };

    case 'MemoryBlock':
    case 'LorebookBlock':
      return {
        ...base,
        type: 'plain' as const,
        content: '',
      };

    case 'IfBlock':
    case 'ToggleBlock':
      return {
        ...base,
        type: 'plain' as const,
        content: '[Conditional content based on toggle]',
      };

    default:
      return null;
  }
}
