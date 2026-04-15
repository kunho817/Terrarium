/**
 * Block execution engine - traverses graph and executes blocks
 */

import type {
  BlockGraph,
  BlockInstance,
  Connection,
  ExecutionContext,
  BlockExecutor,
  BlockExecutionResult,
  PromptFragment,
  ExecutionError,
  PortValue,
} from '$lib/types';
import { blockRegistry } from './registry';

interface ExecutionResult {
  fragments: PromptFragment[];
  output: string;
  errors: ExecutionError[];
}

export class ExecutionEngine {
  constructor(private executor: BlockExecutor) {}

  async execute(graph: BlockGraph, context: ExecutionContext): Promise<ExecutionResult> {
    const executedBlocks = new Set<string>();
    const fragments: PromptFragment[] = [];
    const errors: ExecutionError[] = [];
    const blockOutputs = new Map<string, Map<string, PortValue>>();

    // Find output nodes (blocks with no outgoing connections)
    const outputBlocks = this.findOutputBlocks(graph);

    // Execute from output blocks backward
    for (const block of outputBlocks) {
      try {
        await this.executeBlock(block, graph, context, executedBlocks, blockOutputs, fragments, errors);
      } catch (error) {
        errors.push({
          blockId: block.id,
          blockType: block.type,
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
        });
      }
    }

    // Combine fragments into final output
    const output = this.assembleOutput(fragments);

    return { fragments, output, errors };
  }

  private findOutputBlocks(graph: BlockGraph): BlockInstance[] {
    const hasOutgoingConnection = new Set<string>();
    
    for (const conn of graph.connections) {
      hasOutgoingConnection.add(conn.from.blockId);
    }

    return graph.blocks.filter((b) => !hasOutgoingConnection.has(b.id));
  }

  private async executeBlock(
    block: BlockInstance,
    graph: BlockGraph,
    context: ExecutionContext,
    executedBlocks: Set<string>,
    blockOutputs: Map<string, Map<string, PortValue>>,
    fragments: PromptFragment[],
    errors: ExecutionError[]
  ): Promise<Map<string, PortValue>> {
    // Return cached result if already executed
    if (executedBlocks.has(block.id)) {
      return blockOutputs.get(block.id) || new Map();
    }

    // Get inputs from connected blocks
    const inputs = await this.resolveInputs(block, graph, context, executedBlocks, blockOutputs, fragments, errors);

    // Execute the block
    const definition = blockRegistry.get(block.type);
    if (!definition) {
      throw new Error(`Unknown block type: ${block.type}`);
    }

    try {
      const result = await this.executor.execute(
        block.type,
        block.config,
        inputs,
        context
      );

      // Mark as executed and cache outputs
      executedBlocks.add(block.id);
      blockOutputs.set(block.id, result.outputs);

      // Add fragments (avoid duplicates)
      for (const fragment of result.fragments) {
        if (!fragments.some((f) => f.sourceBlockId === fragment.sourceBlockId && f.text === fragment.text)) {
          fragments.push(fragment);
        }
      }

      return result.outputs;
    } catch (error) {
      errors.push({
        blockId: block.id,
        blockType: block.type,
        message: error instanceof Error ? error.message : 'Execution failed',
        severity: 'error',
      });
      return new Map();
    }
  }

  private async resolveInputs(
    block: BlockInstance,
    graph: BlockGraph,
    context: ExecutionContext,
    executedBlocks: Set<string>,
    blockOutputs: Map<string, Map<string, PortValue>>,
    fragments: PromptFragment[],
    errors: ExecutionError[]
  ): Promise<Map<string, PortValue>> {
    const inputs = new Map<string, PortValue>();

    // Find all connections targeting this block
    const incomingConnections = graph.connections.filter((c) => c.to.blockId === block.id);

    for (const conn of incomingConnections) {
      const sourceBlock = graph.blocks.find((b) => b.id === conn.from.blockId);
      if (!sourceBlock) continue;

      // Execute source block to get its output
      const sourceOutputs = await this.executeBlock(
        sourceBlock,
        graph,
        context,
        executedBlocks,
        blockOutputs,
        fragments,
        errors
      );

      // Map source output to this block's input
      const outputValue = sourceOutputs.get(conn.from.portId);
      inputs.set(conn.to.portId, outputValue);
    }

    return inputs;
  }

  private assembleOutput(fragments: PromptFragment[]): string {
    // Sort fragments by execution order (they're already in order)
    // Combine with appropriate separators
    const nonEmptyFragments = fragments.filter((f) => f.text.trim());
    
    return nonEmptyFragments
      .map((f) => f.text)
      .join('\n\n');
  }
}
