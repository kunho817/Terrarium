import type {
  BlockGraph,
  BlockInstance,
  GraphPromptTemplate,
  PortValue,
  PromptBlockToggle,
} from '$lib/types';
import { ExecutionEngine } from './execution-engine';
import { executeBlock } from './executors';
import {
  buildPromptBlockToggleMap,
  normalizePromptBlockToggles,
} from './preset-migration';
import { registerAllBlocks } from './registry';
import { compileBlockGraphText, createTextGraphTemplate } from './template-runtime';
import { getBlockOutputPorts } from './ports';
import { cloneSerializable } from '$lib/utils/clone-serializable';

export type PromptBoardGroup = 'main' | 'agent' | 'image' | 'workflow' | 'other';
export type PromptBoardComposeMode = 'replace' | 'augment';

export interface PromptBoardTarget {
  key: string;
  label: string;
  role?: 'system' | 'assistant';
  fallbackText?: string;
  group?: PromptBoardGroup;
  template?: GraphPromptTemplate;
  systemTargets?: string[];
  prefillTargets?: string[];
  prefillTemplate?: GraphPromptTemplate;
  composeMode?: PromptBoardComposeMode;
  stageOrder?: number;
  description?: string;
  internalTargets?: PromptBoardTarget[];
}

export interface CompiledBoardTarget {
  key: string;
  label: string;
  compiledText: string;
  template: GraphPromptTemplate;
  composeMode?: PromptBoardComposeMode;
}

const BOARD_COLUMN_WIDTH = 860;
const BOARD_ROW_HEIGHT = 520;
const OUTPUT_X = 560;
const OUTPUT_Y = 120;
const MERGE_X = 360;
const MERGE_FAN_IN = 6;

const STAGE_BASE_X = 220;
const STAGE_BASE_Y = 520;
const STAGE_SPACING_X = 430;
const STAGE_UPSTREAM_COLUMN_GAP = 240;
const STAGE_UPSTREAM_ROW_GAP = 108;

const ARRANGE_BASE_X = 180;
const ARRANGE_BASE_Y = 140;
const ARRANGE_COLUMN_GAP = 280;
const ARRANGE_ROW_GAP = 120;
const ARRANGE_CLUSTER_GAP = 150;
const ARRANGE_GROUP_GAP = 220;
const GROUP_ORDER = ['main', 'agent', 'image', 'workflow', 'other'] as const;

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

function getIncomingConnections(graph: BlockGraph): Map<string, BlockGraph['connections']> {
  const incoming = new Map<string, BlockGraph['connections']>();
  for (const connection of graph.connections) {
    const bucket = incoming.get(connection.to.blockId) ?? [];
    bucket.push(connection);
    incoming.set(connection.to.blockId, bucket);
  }
  return incoming;
}

function getOutputGroup(block: BlockInstance): PromptBoardGroup {
  const configuredGroup = String(block.config.outputGroup || block.config.stageGroup || '').trim();
  if (
    configuredGroup === 'main' ||
    configuredGroup === 'agent' ||
    configuredGroup === 'image' ||
    configuredGroup === 'workflow' ||
    configuredGroup === 'other'
  ) {
    return configuredGroup;
  }

  const outputKey = String(block.config.outputKey || '');
  if (outputKey === 'main.prompt' || outputKey.startsWith('main.')) {
    return 'main';
  }
  if (outputKey.startsWith('agent.')) {
    return 'agent';
  }
  if (outputKey.startsWith('image.')) {
    return 'image';
  }
  if (outputKey.startsWith('workflow.')) {
    return 'workflow';
  }

  return 'other';
}

function computeDistanceToRoot(
  blockId: string,
  rootId: string,
  incoming: Map<string, BlockGraph['connections']>,
  allowedBlockIds: Set<string>,
  memo: Map<string, number>,
): number {
  if (memo.has(blockId)) {
    return memo.get(blockId) ?? 0;
  }

  if (blockId === rootId) {
    memo.set(blockId, 0);
    return 0;
  }

  const upstream = (incoming.get(blockId) ?? [])
    .map((connection) => connection.from.blockId)
    .filter((candidate) => allowedBlockIds.has(candidate));

  if (upstream.length === 0) {
    memo.set(blockId, 1);
    return 1;
  }

  const distance = Math.max(
    ...upstream.map((candidate) =>
      computeDistanceToRoot(candidate, rootId, incoming, allowedBlockIds, memo) + 1,
    ),
  );
  memo.set(blockId, distance);
  return distance;
}

function stripTerminalBlocks(graph: BlockGraph): BlockGraph {
  const terminalBlockIds = new Set(
    graph.blocks
      .filter((block) => block.type === 'OutputBlock' || block.type === 'StageBlock')
      .map((block) => block.id),
  );

  if (terminalBlockIds.size === 0) {
    return cloneGraph(graph);
  }

  return {
    version: '1.0',
    blocks: graph.blocks
      .filter((block) => !terminalBlockIds.has(block.id))
      .map((block) => ({
        ...block,
        position: { ...block.position },
        config: { ...block.config },
      })),
    connections: graph.connections
      .filter((connection) =>
        !terminalBlockIds.has(connection.from.blockId) &&
        !terminalBlockIds.has(connection.to.blockId),
      )
      .map((connection) => ({
        ...connection,
        from: { ...connection.from },
        to: { ...connection.to },
      })),
  };
}

function namespaceGraph(
  graph: BlockGraph,
  prefix: string,
  offsetX: number,
  offsetY: number,
): BlockGraph {
  const idMap = new Map<string, string>();

  const blocks = graph.blocks.map((block) => {
    const nextId = `${prefix}-${block.id}`;
    idMap.set(block.id, nextId);
    return {
      ...block,
      id: nextId,
      position: {
        x: block.position.x + offsetX,
        y: block.position.y + offsetY,
      },
      config: { ...block.config },
    };
  });

  const connections = graph.connections
    .map((connection) => {
      const fromId = idMap.get(connection.from.blockId);
      const toId = idMap.get(connection.to.blockId);

      if (!fromId || !toId) {
        return null;
      }

      return {
        ...connection,
        id: `${prefix}-${connection.id}`,
        from: { ...connection.from, blockId: fromId },
        to: { ...connection.to, blockId: toId },
      };
    })
    .filter((connection): connection is BlockGraph['connections'][number] => connection !== null);

  return {
    version: '1.0',
    blocks,
    connections,
  };
}

function findRootBlocks(graph: BlockGraph): BlockInstance[] {
  const hasOutgoing = new Set<string>();

  for (const connection of graph.connections) {
    hasOutgoing.add(connection.from.blockId);
  }

  return graph.blocks.filter((block) => !hasOutgoing.has(block.id));
}

function getPrimaryOutputPortId(block: BlockInstance): string | null {
  return getBlockOutputPorts(block)[0]?.id ?? null;
}

function connectBlock(
  graph: BlockGraph,
  fromBlockId: string,
  toBlockId: string,
  toPortId: string,
) {
  const fromBlock = graph.blocks.find((block) => block.id === fromBlockId);
  if (!fromBlock) {
    return;
  }

  const fromPortId = getPrimaryOutputPortId(fromBlock);
  if (!fromPortId) {
    return;
  }

  graph.connections.push({
    id: crypto.randomUUID(),
    from: { blockId: fromBlockId, portId: fromPortId },
    to: { blockId: toBlockId, portId: toPortId },
  });
}

function collapseRootsIntoSingleSource(
  graph: BlockGraph,
  sourceIds: string[],
  baseX: number,
  baseY: number,
  targetLabel: string,
): string | null {
  let currentSources = [...sourceIds];
  let mergeLevel = 0;

  while (currentSources.length > 1) {
    const nextSources: string[] = [];

    for (let index = 0; index < currentSources.length; index += MERGE_FAN_IN) {
      const chunk = currentSources.slice(index, index + MERGE_FAN_IN);

      if (chunk.length === 1) {
        nextSources.push(chunk[0]);
        continue;
      }

      const mergeId = crypto.randomUUID();
      const chunkY =
        chunk
          .map((sourceId) => graph.blocks.find((block) => block.id === sourceId)?.position.y ?? baseY)
          .reduce((sum, y) => sum + y, 0) / chunk.length;

      graph.blocks.push({
        id: mergeId,
        type: 'MergeBlock',
        position: {
          x: baseX + MERGE_X + mergeLevel * 70,
          y: chunkY,
        },
        config: {
          inputCount: chunk.length,
          separator: '\n\n',
          filterEmpty: true,
          itemName: `${targetLabel} Merge`,
        },
      });

      chunk.forEach((sourceId, chunkIndex) => {
        connectBlock(graph, sourceId, mergeId, `input${chunkIndex + 1}`);
      });

      nextSources.push(mergeId);
    }

    currentSources = nextSources;
    mergeLevel += 1;
  }

  return currentSources[0] ?? null;
}

function hasStageBlocks(graph: BlockGraph): boolean {
  return graph.blocks.some((block) => block.type === 'StageBlock');
}

function arrangeLegacyBoard(graph: BlockGraph): BlockGraph {
  const cloned = cloneGraph(graph);
  const blockMap = new Map(cloned.blocks.map((block) => [block.id, block]));
  const outputBlocks = cloned.blocks.filter((block) => block.type === 'OutputBlock');
  const incoming = getIncomingConnections(cloned);
  const arranged = new Set<string>();
  let cursorY = ARRANGE_BASE_Y;

  for (const group of GROUP_ORDER) {
    const groupOutputs = outputBlocks
      .filter((block) => getOutputGroup(block) === group)
      .sort((left, right) => {
        if (left.position.y !== right.position.y) {
          return left.position.y - right.position.y;
        }
        return String(left.config.outputLabel || '').localeCompare(String(right.config.outputLabel || ''));
      });

    if (groupOutputs.length === 0) {
      continue;
    }

    for (const outputBlock of groupOutputs) {
      const subgraph = extractUpstreamSubgraph(cloned, outputBlock.id);
      const blockIds = new Set(subgraph.blocks.map((block) => block.id));
      const clusterBlocks = subgraph.blocks
        .filter((block) => !arranged.has(block.id))
        .sort((left, right) => left.position.y - right.position.y);

      const contentBlocks = clusterBlocks.filter((block) => block.id !== outputBlock.id);
      const memo = new Map<string, number>();
      const blocksByDepth = new Map<number, BlockInstance[]>();
      let maxDepth = 1;

      for (const block of contentBlocks) {
        const depth = computeDistanceToRoot(block.id, outputBlock.id, incoming, blockIds, memo);
        maxDepth = Math.max(maxDepth, depth);
        const bucket = blocksByDepth.get(depth) ?? [];
        bucket.push(block);
        blocksByDepth.set(depth, bucket);
      }

      const tallestColumn = Math.max(
        1,
        ...Array.from(blocksByDepth.values()).map((entries) => entries.length),
      );
      const clusterHeight = Math.max(180, tallestColumn * ARRANGE_ROW_GAP + 100);
      const outputX = ARRANGE_BASE_X + maxDepth * ARRANGE_COLUMN_GAP;
      const outputY = cursorY + clusterHeight / 2 - 50;

      for (let depth = maxDepth; depth >= 1; depth -= 1) {
        const columnBlocks = (blocksByDepth.get(depth) ?? [])
          .sort((left, right) => left.position.y - right.position.y);

        if (columnBlocks.length === 0) {
          continue;
        }

        const totalHeight = (columnBlocks.length - 1) * ARRANGE_ROW_GAP;
        const startY = outputY - totalHeight / 2;
        const columnX = ARRANGE_BASE_X + (maxDepth - depth) * ARRANGE_COLUMN_GAP;

        columnBlocks.forEach((block, index) => {
          const target = blockMap.get(block.id);
          if (!target) {
            return;
          }
          target.position = {
            x: columnX,
            y: startY + index * ARRANGE_ROW_GAP,
          };
          arranged.add(block.id);
        });
      }

      const outputTarget = blockMap.get(outputBlock.id);
      if (outputTarget) {
        outputTarget.position = { x: outputX, y: outputY };
        arranged.add(outputTarget.id);
      }

      cursorY += clusterHeight + ARRANGE_CLUSTER_GAP;
    }

    cursorY += ARRANGE_GROUP_GAP;
  }

  const orphanBlocks = cloned.blocks
    .filter((block) => !arranged.has(block.id))
    .sort((left, right) => left.position.y - right.position.y);

  orphanBlocks.forEach((block, index) => {
    const target = blockMap.get(block.id);
    if (!target) {
      return;
    }
    target.position = {
      x: ARRANGE_BASE_X,
      y: cursorY + index * ARRANGE_ROW_GAP,
    };
  });

  return cloned;
}

function arrangeStageBoard(graph: BlockGraph): BlockGraph {
  const cloned = cloneGraph(graph);
  const blockMap = new Map(cloned.blocks.map((block) => [block.id, block]));
  const incoming = getIncomingConnections(cloned);
  const stageBlocks = cloned.blocks
    .filter((block) => block.type === 'StageBlock')
    .sort((left, right) => Number(left.config.stageOrder ?? 0) - Number(right.config.stageOrder ?? 0));
  const arranged = new Set<string>();

  stageBlocks.forEach((stageBlock, index) => {
    const stageX = STAGE_BASE_X + index * STAGE_SPACING_X;
    const stageY = STAGE_BASE_Y;
    const stageTarget = blockMap.get(stageBlock.id);
    if (stageTarget) {
      stageTarget.position = { x: stageX, y: stageY };
      arranged.add(stageTarget.id);
    }

    const subgraph = extractUpstreamSubgraph(cloned, stageBlock.id);
    const contentBlocks = subgraph.blocks.filter(
      (block) => block.id !== stageBlock.id && block.type !== 'StageBlock',
    );
    const allowedBlockIds = new Set(contentBlocks.map((block) => block.id).concat(stageBlock.id));
    const memo = new Map<string, number>();
    const blocksByDepth = new Map<number, BlockInstance[]>();
    let maxDepth = 1;

    for (const block of contentBlocks) {
      const depth = computeDistanceToRoot(block.id, stageBlock.id, incoming, allowedBlockIds, memo);
      maxDepth = Math.max(maxDepth, depth);
      const bucket = blocksByDepth.get(depth) ?? [];
      bucket.push(block);
      blocksByDepth.set(depth, bucket);
    }

    for (let depth = maxDepth; depth >= 1; depth -= 1) {
      const columnBlocks = (blocksByDepth.get(depth) ?? [])
        .sort((left, right) => left.position.y - right.position.y);
      if (columnBlocks.length === 0) {
        continue;
      }

      const totalHeight = (columnBlocks.length - 1) * STAGE_UPSTREAM_ROW_GAP;
      const startY = stageY - 220 - totalHeight / 2;
      const columnX = stageX - depth * STAGE_UPSTREAM_COLUMN_GAP;

      columnBlocks.forEach((block, rowIndex) => {
        const target = blockMap.get(block.id);
        if (!target) {
          return;
        }
        target.position = {
          x: columnX,
          y: startY + rowIndex * STAGE_UPSTREAM_ROW_GAP,
        };
        arranged.add(block.id);
      });
    }
  });

  const orphanBlocks = cloned.blocks
    .filter((block) => !arranged.has(block.id))
    .sort((left, right) => left.position.y - right.position.y);

  orphanBlocks.forEach((block, index) => {
    const target = blockMap.get(block.id);
    if (!target) {
      return;
    }
    target.position = {
      x: STAGE_BASE_X,
      y: STAGE_BASE_Y + 220 + index * STAGE_UPSTREAM_ROW_GAP,
    };
  });

  return cloned;
}

export function arrangePromptBoard(graph: BlockGraph): BlockGraph {
  if (hasStageBlocks(graph)) {
    return arrangeStageBoard(graph);
  }
  return arrangeLegacyBoard(graph);
}

function makeStageTemplate(content: string, itemName: string, role: 'system' | 'assistant'): GraphPromptTemplate | undefined {
  if (!content.trim()) {
    return undefined;
  }
  return createTextGraphTemplate(content, itemName, role);
}

export function buildPromptBoard(targets: PromptBoardTarget[]): GraphPromptTemplate {
  registerAllBlocks();

  const board: BlockGraph = {
    version: '1.0',
    blocks: [],
    connections: [],
  };

  const toggles: PromptBlockToggle[] = [];
  const useStages = targets.some((target) =>
    (target.systemTargets?.length ?? 0) > 0 ||
    (target.prefillTargets?.length ?? 0) > 0 ||
    (target.internalTargets?.length ?? 0) > 0,
  );

  if (!useStages) {
    targets.forEach((target, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const offsetX = 120 + column * BOARD_COLUMN_WIDTH;
      const offsetY = 120 + row * BOARD_ROW_HEIGHT;

      const sourceTemplate = target.template ?? createTextGraphTemplate(target.fallbackText ?? '', target.label, target.role ?? 'system');
      const namespaced = namespaceGraph(
        stripTerminalBlocks(sourceTemplate.graph),
        target.key,
        offsetX,
        offsetY,
      );

      board.blocks.push(...namespaced.blocks);
      board.connections.push(...namespaced.connections);
      toggles.push(...(sourceTemplate.toggles ?? []));

      const outputId = crypto.randomUUID();
      board.blocks.push({
        id: outputId,
        type: 'OutputBlock',
        position: { x: offsetX + OUTPUT_X, y: offsetY + OUTPUT_Y },
        config: {
          outputKey: target.key,
          outputLabel: target.label,
          role: target.role ?? 'system',
          outputGroup: target.group ?? 'other',
          composeMode: target.composeMode ?? 'replace',
          group: 'board',
        },
      });

      const roots = findRootBlocks(namespaced).map((block) => block.id);
      const mergedRoot = collapseRootsIntoSingleSource(
        board,
        roots,
        offsetX,
        offsetY + OUTPUT_Y,
        target.label,
      );

      if (mergedRoot) {
        connectBlock(board, mergedRoot, outputId, 'input');
      }
    });

    return {
      graph: arrangePromptBoard(board),
      toggles: normalizePromptBlockToggles(toggles, board),
      compiledText: '',
    };
  }

  targets.forEach((target, index) => {
    const stageId = crypto.randomUUID();
    const stageSystemTemplate =
      target.template ??
      makeStageTemplate(target.fallbackText ?? '', `${target.label} Base`, 'system');
    const stagePrefillTemplate = target.prefillTemplate;
    const stageBoardTemplate = target.internalTargets?.length
      ? buildPromptBoard(target.internalTargets)
      : undefined;
    const useInternalStageCanvas = true;

    const baseX = STAGE_BASE_X + index * STAGE_SPACING_X - 320;
    const baseY = 180;

    if (stageSystemTemplate && !useInternalStageCanvas) {
      const namespaced = namespaceGraph(
        stripTerminalBlocks(stageSystemTemplate.graph),
        `${target.key}-system`,
        baseX,
        baseY,
      );
      board.blocks.push(...namespaced.blocks);
      board.connections.push(...namespaced.connections);
      toggles.push(...(stageSystemTemplate.toggles ?? []));

      const roots = findRootBlocks(namespaced).map((block) => block.id);
      const mergedRoot = collapseRootsIntoSingleSource(
        board,
        roots,
        baseX,
        baseY,
        `${target.label} Base`,
      );

      if (mergedRoot) {
        connectBlock(board, mergedRoot, stageId, 'base');
      }
    }

    if (stagePrefillTemplate && !useInternalStageCanvas) {
      const namespaced = namespaceGraph(
        stripTerminalBlocks(stagePrefillTemplate.graph),
        `${target.key}-prefill`,
        baseX,
        baseY + 170,
      );
      board.blocks.push(...namespaced.blocks);
      board.connections.push(...namespaced.connections);
      toggles.push(...(stagePrefillTemplate.toggles ?? []));

      const roots = findRootBlocks(namespaced).map((block) => block.id);
      const mergedRoot = collapseRootsIntoSingleSource(
        board,
        roots,
        baseX,
        baseY + 170,
        `${target.label} Prefill`,
      );

      if (mergedRoot) {
        connectBlock(board, mergedRoot, stageId, 'prefill');
      }
    }

    board.blocks.push({
      id: stageId,
      type: 'StageBlock',
      position: { x: STAGE_BASE_X + index * STAGE_SPACING_X, y: STAGE_BASE_Y },
      config: {
        stageKey: target.key,
        stageLabel: target.label,
        stageGroup: target.group ?? 'workflow',
        stageOrder: target.stageOrder ?? index,
        composeMode: target.composeMode ?? 'augment',
        separator: '\n\n',
        systemTargetKeys: target.systemTargets ?? [],
        prefillTargetKeys: target.prefillTargets ?? [],
        description: target.description ?? '',
        stageBoardTemplate: stageBoardTemplate ? cloneSerializable(stageBoardTemplate) : undefined,
        stageSystemTemplate: useInternalStageCanvas && stageSystemTemplate
          ? cloneSerializable(stageSystemTemplate)
          : undefined,
        stagePrefillTemplate: useInternalStageCanvas && stagePrefillTemplate
          ? cloneSerializable(stagePrefillTemplate)
          : undefined,
      },
    });
  });

  return {
    graph: arrangePromptBoard(board),
    toggles: normalizePromptBlockToggles(toggles, board),
    compiledText: '',
  };
}

export function extractUpstreamSubgraph(
  graph: BlockGraph,
  rootBlockId: string,
): BlockGraph {
  const included = new Set<string>();
  const stack = [rootBlockId];

  while (stack.length > 0) {
    const blockId = stack.pop();
    if (!blockId || included.has(blockId)) {
      continue;
    }

    included.add(blockId);

    for (const connection of graph.connections) {
      if (connection.to.blockId === blockId) {
        stack.push(connection.from.blockId);
      }
    }
  }

  return {
    version: '1.0',
    blocks: graph.blocks
      .filter((block) => included.has(block.id))
      .map((block) => ({
        ...block,
        position: { ...block.position },
        config: { ...block.config },
      })),
    connections: graph.connections
      .filter((connection) =>
        included.has(connection.from.blockId) &&
        included.has(connection.to.blockId),
      )
      .map((connection) => ({
        ...connection,
        from: { ...connection.from },
        to: { ...connection.to },
      })),
  };
}

export function extractUpstreamInputSubgraph(
  graph: BlockGraph,
  rootBlockId: string,
  inputPortIds: string[],
  includeRootBlock: boolean,
): BlockGraph {
  const included = new Set<string>();
  const stack = graph.connections
    .filter((connection) =>
      connection.to.blockId === rootBlockId &&
      inputPortIds.includes(connection.to.portId),
    )
    .map((connection) => connection.from.blockId);

  if (includeRootBlock) {
    included.add(rootBlockId);
  }

  while (stack.length > 0) {
    const blockId = stack.pop();
    if (!blockId || included.has(blockId)) {
      continue;
    }

    included.add(blockId);

    for (const connection of graph.connections) {
      if (connection.to.blockId === blockId) {
        stack.push(connection.from.blockId);
      }
    }
  }

  return {
    version: '1.0',
    blocks: graph.blocks
      .filter((block) => included.has(block.id))
      .map((block) => ({
        ...block,
        position: { ...block.position },
        config: { ...block.config },
      })),
    connections: graph.connections
      .filter((connection) =>
        included.has(connection.from.blockId) &&
        included.has(connection.to.blockId) &&
        (connection.to.blockId !== rootBlockId || inputPortIds.includes(connection.to.portId)),
      )
      .map((connection) => ({
        ...connection,
        from: { ...connection.from },
        to: { ...connection.to },
      })),
  };
}

async function executeStageInput(
  graph: BlockGraph,
  stageBlock: BlockInstance,
  inputPortIds: string[],
  outputPortId: 'system' | 'prefill',
  toggles?: PromptBlockToggle[],
): Promise<{ text: string; template: GraphPromptTemplate }> {
  const executionGraph = extractUpstreamInputSubgraph(graph, stageBlock.id, inputPortIds, true);
  const templateGraph = extractUpstreamInputSubgraph(graph, stageBlock.id, inputPortIds, false);
  const engine = new ExecutionEngine({ execute: executeBlock });
  const result = await engine.execute(executionGraph, {
    variables: new Map(),
    toggles: buildPromptBlockToggleMap(toggles),
  });
  const stageOutputs = result.blockOutputs.get(stageBlock.id) ?? new Map<string, PortValue>();
  const text = String(stageOutputs.get(outputPortId) ?? '').trim();
  const normalizedToggles = normalizePromptBlockToggles(toggles, templateGraph);

  return {
    text,
    template: {
      graph: templateGraph,
      toggles: normalizedToggles,
      compiledText: text,
    },
  };
}

export async function compileBoardOutput(
  graph: BlockGraph,
  outputBlockId: string,
  toggles?: PromptBlockToggle[],
): Promise<CompiledBoardTarget | null> {
  const outputBlock = graph.blocks.find((block) => block.id === outputBlockId && block.type === 'OutputBlock');
  if (!outputBlock) {
    return null;
  }

  const subgraph = extractUpstreamSubgraph(graph, outputBlockId);
  const compiledText = await compileBlockGraphText(subgraph, toggles);
  const normalizedToggles = normalizePromptBlockToggles(toggles, subgraph);

  return {
    key: String(outputBlock.config.outputKey || ''),
    label: String(outputBlock.config.outputLabel || outputBlock.config.outputKey || 'Output'),
    compiledText,
    template: {
      graph: subgraph,
      toggles: normalizedToggles,
      compiledText,
    },
    composeMode: String(outputBlock.config.composeMode || 'replace') as PromptBoardComposeMode,
  };
}

async function compileStageBlock(
  graph: BlockGraph,
  stageBlock: BlockInstance,
  toggles?: PromptBlockToggle[],
): Promise<CompiledBoardTarget[]> {
  const label = String(stageBlock.config.stageLabel || stageBlock.config.stageKey || 'Stage');
  const composeMode = (String(stageBlock.config.composeMode || 'augment') as PromptBoardComposeMode);
  const separator = String(stageBlock.config.separator || '\n\n');
  const systemTargetKeys = Array.isArray(stageBlock.config.systemTargetKeys)
    ? stageBlock.config.systemTargetKeys.map((key) => String(key)).filter(Boolean)
    : [];
  const prefillTargetKeys = Array.isArray(stageBlock.config.prefillTargetKeys)
    ? stageBlock.config.prefillTargetKeys.map((key) => String(key)).filter(Boolean)
    : [];

  const storedBoardTemplate = stageBlock.config.stageBoardTemplate as GraphPromptTemplate | undefined;
  if (storedBoardTemplate) {
    return compilePromptBoard(storedBoardTemplate.graph, storedBoardTemplate.toggles);
  }

  const storedSystemTemplate = stageBlock.config.stageSystemTemplate as GraphPromptTemplate | undefined;
  const storedPrefillTemplate = stageBlock.config.stagePrefillTemplate as GraphPromptTemplate | undefined;
  const storedSystemText = storedSystemTemplate
    ? await compileBlockGraphText(storedSystemTemplate.graph, storedSystemTemplate.toggles)
    : '';
  const storedPrefillText = storedPrefillTemplate
    ? await compileBlockGraphText(storedPrefillTemplate.graph, storedPrefillTemplate.toggles)
    : '';
  const systemResult = await executeStageInput(graph, stageBlock, ['base', 'augment', 'augment1', 'augment2'], 'system', toggles);
  const prefillResult = await executeStageInput(graph, stageBlock, ['prefill'], 'prefill', toggles);
  const combinedSystemText = storedSystemTemplate
    ? storedSystemText
    : [storedSystemText, systemResult.text].filter((value) => value.trim().length > 0).join(separator);
  const combinedPrefillText = storedPrefillTemplate
    ? storedPrefillText
    : [storedPrefillText, prefillResult.text].filter((value) => value.trim().length > 0).join(separator);

  const compiled: CompiledBoardTarget[] = [];

  for (const key of systemTargetKeys) {
    compiled.push({
      key,
      label,
      compiledText: combinedSystemText,
      template: storedSystemTemplate ?? systemResult.template,
      composeMode,
    });
  }

  for (const key of prefillTargetKeys) {
    compiled.push({
      key,
      label: `${label} Prefill`,
      compiledText: combinedPrefillText,
      template: storedPrefillTemplate ?? prefillResult.template,
      composeMode,
    });
  }

  return compiled;
}

export async function compilePromptBoard(
  graph: BlockGraph,
  toggles?: PromptBlockToggle[],
): Promise<CompiledBoardTarget[]> {
  const compiled: CompiledBoardTarget[] = [];
  const outputBlocks = graph.blocks.filter((block) => block.type === 'OutputBlock');
  const stageBlocks = graph.blocks
    .filter((block) => block.type === 'StageBlock')
    .sort((left, right) => Number(left.config.stageOrder ?? 0) - Number(right.config.stageOrder ?? 0));

  for (const output of outputBlocks) {
    const result = await compileBoardOutput(graph, output.id, toggles);
    if (result) {
      compiled.push(result);
    }
  }

  for (const stageBlock of stageBlocks) {
    compiled.push(...await compileStageBlock(graph, stageBlock, toggles));
  }

  return compiled;
}
