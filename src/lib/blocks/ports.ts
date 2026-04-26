import type { BlockInstance, InputPort, OutputPort } from '$lib/types';
import { blockRegistry, registerAllBlocks } from './registry';

const MIN_MERGE_INPUTS = 2;
const MAX_MERGE_INPUTS = 12;

function clampMergeInputCount(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 3;
  }
  return Math.min(MAX_MERGE_INPUTS, Math.max(MIN_MERGE_INPUTS, Math.round(value)));
}

function buildMergePorts(block: BlockInstance): InputPort[] {
  const inputCount = clampMergeInputCount(block.config.inputCount);
  return Array.from({ length: inputCount }, (_, index) => ({
    id: `input${index + 1}`,
    name: `Input ${index + 1}`,
    type: 'text',
    direction: 'input' as const,
    required: false,
  }));
}

export function getBlockInputPorts(block: BlockInstance): InputPort[] {
  registerAllBlocks();
  const definition = blockRegistry.get(block.type);
  if (!definition) {
    return [];
  }

  if (block.type === 'MergeBlock') {
    return buildMergePorts(block);
  }

  return definition.inputPorts;
}

export function getBlockOutputPorts(block: BlockInstance): OutputPort[] {
  registerAllBlocks();
  const definition = blockRegistry.get(block.type);
  if (!definition) {
    return [];
  }

  return definition.outputPorts;
}

export function getMergeInputCount(block: BlockInstance): number {
  return clampMergeInputCount(block.config.inputCount);
}
