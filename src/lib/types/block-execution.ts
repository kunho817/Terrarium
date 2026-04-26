/**
 * Block execution engine types
 */

import type { BlockType, BlockConfig, PortType } from './blocks';

export interface ExecutionContext {
  variables: Map<string, unknown>;
  toggles: Map<string, boolean>;
  characterId?: string;
  sessionId?: string;
}

export interface PromptFragment {
  text: string;
  sourceBlockId: string;
  sourceBlockType: BlockType;
  metadata?: {
    isConditional?: boolean;
    conditionResult?: boolean;
    toggleId?: string;
    outputKey?: string;
  };
}

export type PortValue = string | boolean | number | string[] | undefined;

export interface BlockExecutionResult {
  outputs: Map<string, PortValue>;
  fragments: PromptFragment[];
}

export interface BlockExecutor {
  execute(
    blockType: BlockType,
    config: BlockConfig,
    inputs: Map<string, PortValue>,
    context: ExecutionContext,
    blockContext?: { blockId: string }
  ): BlockExecutionResult | Promise<BlockExecutionResult>;
}

export interface ExecutionError {
  blockId: string;
  blockType: BlockType;
  message: string;
  severity: 'error' | 'warning';
}
