/**
 * Preset <-> block graph migration helpers.
 *
 * The runtime still consumes ordered prompt items, so the graph editor stores
 * its visual state alongside a flattened preset representation.
 */

import type {
  BlockGraph,
  BlockInstance,
  PromptBlockToggle,
  PromptItem,
  PromptItemRole,
  PromptItemType,
  PromptPreset,
} from '$lib/types';

const BLOCK_START_X = 120;
const BLOCK_START_Y = 80;
const BLOCK_SPACING_Y = 140;

const TEXT_ITEM_TYPES = new Set<PromptItemType>([
  'system',
  'authornote',
  'postHistoryInstructions',
  'jailbreak',
  'prefill',
  'plain',
]);

function cloneGraph(graph: BlockGraph): BlockGraph {
  return {
    version: '1.0',
    blocks: graph.blocks.map((block) => ({
      ...block,
      position: { ...block.position },
      config: { ...block.config },
    })),
    connections: graph.connections.map((connection) => ({
      ...connection,
      from: { ...connection.from },
      to: { ...connection.to },
    })),
  };
}

function makeBlockBase(id: string, index: number) {
  return {
    id,
    position: {
      x: BLOCK_START_X,
      y: BLOCK_START_Y + index * BLOCK_SPACING_Y,
    },
  };
}

function normalizePromptRole(role: unknown): PromptItemRole {
  return role === 'assistant' || role === 'user' ? role : 'system';
}

function normalizePromptType(type: unknown): PromptItemType {
  if (typeof type !== 'string') {
    return 'plain';
  }

  const validTypes = new Set<PromptItemType>([
    'system',
    'description',
    'persona',
    'personality',
    'scenario',
    'exampleMessages',
    'chatHistory',
    'lorebook',
    'authornote',
    'postHistoryInstructions',
    'depthPrompt',
    'jailbreak',
    'prefill',
    'plain',
    'memory',
    'director',
    'sceneState',
    'characterState',
    'worldDescription',
    'narrativeGuidance',
    'sectionWorld',
    'worldRelations',
  ]);

  return validTypes.has(type as PromptItemType) ? (type as PromptItemType) : 'plain';
}

function promptItemToBlock(item: PromptItem, index: number): BlockInstance {
  const base = makeBlockBase(`preset-${item.id}`, index);

  if (item.type === 'memory') {
    return {
      ...base,
      type: 'MemoryBlock',
      config: {
        enabled: item.enabled,
        itemName: item.name,
        role: item.role,
        format: 'bullet',
        threshold: 0.7,
        count: 3,
        template: item.content,
      },
    };
  }

  if (item.type === 'lorebook') {
    return {
      ...base,
      type: 'LorebookBlock',
      config: {
        enabled: item.enabled,
        itemName: item.name,
        role: item.role,
        lorebookPosition: item.lorebookPosition ?? 'before_char',
        activationMode: 'keyword',
        maxEntries: 5,
        template: item.content,
      },
    };
  }

  if (TEXT_ITEM_TYPES.has(item.type)) {
    return {
      ...base,
      type: 'TextBlock',
      config: {
        enabled: item.enabled,
        itemType: item.type,
        itemName: item.name,
        role: item.role,
        content: item.content,
      },
    };
  }

  return {
    ...base,
    type: 'FieldBlock',
    config: {
      enabled: item.enabled,
      fieldType: item.type,
      itemName: item.name,
      role: item.role,
      template: item.content,
      lorebookPosition: item.lorebookPosition,
    },
  };
}

function blockToPromptItem(block: BlockInstance): PromptItem | null {
  switch (block.type) {
    case 'TextBlock':
      return {
        id: `block-${block.id}`,
        type: normalizePromptType(block.config.itemType),
        name: String(block.config.itemName || 'Text'),
        enabled: (block.config.enabled as boolean) ?? true,
        role: normalizePromptRole(block.config.role),
        content: String(block.config.content || ''),
      };

    case 'FieldBlock':
      return {
        id: `block-${block.id}`,
        type: normalizePromptType(block.config.fieldType),
        name: String(block.config.itemName || 'Field'),
        enabled: (block.config.enabled as boolean) ?? true,
        role: normalizePromptRole(block.config.role),
        content: String(block.config.template ?? block.config.fallback ?? ''),
        lorebookPosition: block.config.lorebookPosition as PromptItem['lorebookPosition'],
      };

    case 'MemoryBlock':
      return {
        id: `block-${block.id}`,
        type: 'memory',
        name: String(block.config.itemName || 'Memory'),
        enabled: (block.config.enabled as boolean) ?? true,
        role: normalizePromptRole(block.config.role),
        content: String(block.config.template || ''),
      };

    case 'LorebookBlock':
      return {
        id: `block-${block.id}`,
        type: 'lorebook',
        name: String(block.config.itemName || 'Lorebook'),
        enabled: (block.config.enabled as boolean) ?? true,
        role: normalizePromptRole(block.config.role),
        content: String(block.config.template || ''),
        lorebookPosition:
          (block.config.lorebookPosition as PromptItem['lorebookPosition']) ?? 'before_char',
      };

    default:
      return null;
  }
}

function sortBlocksForFlattening(graph: BlockGraph): BlockInstance[] {
  return [...graph.blocks].sort((left, right) => {
    if (left.position.y === right.position.y) {
      return left.position.x - right.position.x;
    }
    return left.position.y - right.position.y;
  });
}

export function presetToBlocks(preset: PromptPreset): BlockGraph {
  if (preset.blockGraph) {
    return cloneGraph(preset.blockGraph);
  }

  return {
    version: '1.0',
    blocks: preset.items.map((item, index) => promptItemToBlock(item, index)),
    connections: [],
  };
}

export function normalizePromptBlockToggles(
  toggles: PromptBlockToggle[] | undefined,
  graph: BlockGraph,
): PromptBlockToggle[] {
  const referencedToggleIds = new Set<string>();
  const normalized = new Map<string, PromptBlockToggle>();

  for (const toggle of toggles ?? []) {
    if (!toggle?.id) {
      continue;
    }
    normalized.set(toggle.id, {
      id: toggle.id,
      name: toggle.name || 'Toggle',
      value: Boolean(toggle.value),
    });
  }

  for (const block of graph.blocks) {
    if (block.type !== 'ToggleBlock') {
      continue;
    }

    const toggleId = String(block.config.toggleId || block.id);
    referencedToggleIds.add(toggleId);

    const existing = normalized.get(toggleId);
    normalized.set(toggleId, {
      id: toggleId,
      name: String(block.config.toggleName || existing?.name || `Toggle ${normalized.size + 1}`),
      value: existing?.value ?? Boolean(block.config.defaultValue ?? false),
    });
  }

  if (referencedToggleIds.size === 0) {
    return [...normalized.values()];
  }

  return [...normalized.values()].filter((toggle) => referencedToggleIds.has(toggle.id));
}

export function buildPromptBlockToggleMap(
  toggles: PromptBlockToggle[] | undefined,
): Map<string, boolean> {
  return new Map((toggles ?? []).map((toggle) => [toggle.id, Boolean(toggle.value)]));
}

export function blocksToPreset(
  graph: BlockGraph,
  basePreset?: Pick<PromptPreset, 'id' | 'name' | 'assistantPrefill'>,
): PromptPreset {
  const items = sortBlocksForFlattening(graph)
    .map((block) => blockToPromptItem(block))
    .filter((item): item is PromptItem => item !== null);

  return {
    id: basePreset?.id ?? 'migrated',
    name: basePreset?.name ?? 'Graph Preset',
    assistantPrefill: basePreset?.assistantPrefill ?? '',
    items,
    blockGraph: cloneGraph(graph),
  };
}
