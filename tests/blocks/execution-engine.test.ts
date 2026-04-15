import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionEngine } from '$lib/blocks/execution-engine';
import { blockRegistry } from '$lib/blocks/registry';
import type { BlockType, BlockConfig, PortValue, ExecutionContext, BlockGraph, BlockDefinition } from '$lib/types';

// Register test blocks
function registerTestBlocks() {
  const textBlock: BlockDefinition = {
    type: 'TextBlock',
    category: 'foundation',
    displayName: 'Text',
    icon: '📄',
    description: 'Test text block',
    color: '#89b4fa',
    inputPorts: [],
    outputPorts: [{ id: 'text', name: 'Text', type: 'text', direction: 'output', required: false }],
    defaultConfig: {},
  };
  
  const mergeBlock: BlockDefinition = {
    type: 'MergeBlock',
    category: 'logic',
    displayName: 'Merge',
    icon: '🔗',
    description: 'Test merge block',
    color: '#94e2d5',
    inputPorts: [
      { id: 'input1', name: 'Input 1', type: 'text', direction: 'input', required: false },
      { id: 'input2', name: 'Input 2', type: 'text', direction: 'input', required: false },
    ],
    outputPorts: [{ id: 'combined', name: 'Combined', type: 'text', direction: 'output', required: false }],
    defaultConfig: {},
  };
  
  // Only register if not already registered
  if (!blockRegistry.has('TextBlock')) {
    blockRegistry.register(textBlock);
  }
  if (!blockRegistry.has('MergeBlock')) {
    blockRegistry.register(mergeBlock);
  }
}

// Simple test executor
let blockCounter = 0;
const testExecutor = {
  execute: async (
    blockType: BlockType,
    config: BlockConfig,
    inputs: Map<string, PortValue>,
    context: ExecutionContext
  ) => {
    const blockId = `block-${++blockCounter}`;
    
    if (blockType === 'TextBlock') {
      const content = config.content as string;
      return {
        outputs: new Map([['text', content]]),
        fragments: content ? [{
          text: content,
          sourceBlockId: blockId,
          sourceBlockType: 'TextBlock' as BlockType,
        }] : [],
      };
    }
    if (blockType === 'MergeBlock') {
      const texts = Array.from(inputs.values()).filter((v): v is string => typeof v === 'string');
      const merged = texts.join('\n\n');
      return {
        outputs: new Map([['combined', merged]]),
        fragments: merged ? [{
          text: merged,
          sourceBlockId: blockId,
          sourceBlockType: 'MergeBlock' as BlockType,
        }] : [],
      };
    }
    return { outputs: new Map(), fragments: [] };
  },
};

describe('ExecutionEngine', () => {
  beforeEach(() => {
    registerTestBlocks();
  });

  it('executes a single text block', async () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [
        { id: 'text1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Hello' } },
      ],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const engine = new ExecutionEngine(testExecutor);
    const context: ExecutionContext = {
      variables: new Map(),
      toggles: new Map(),
    };

    const result = await engine.execute(graph, context);
    
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].text).toBe('Hello');
  });

  it('executes connected blocks', async () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [
        { id: 'text1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Part A' } },
        { id: 'text2', type: 'TextBlock', position: { x: 0, y: 100 }, config: { content: 'Part B' } },
        { id: 'merge1', type: 'MergeBlock', position: { x: 200, y: 50 }, config: {} },
      ],
      connections: [
        { id: 'conn1', from: { blockId: 'text1', portId: 'text' }, to: { blockId: 'merge1', portId: 'input1' } },
        { id: 'conn2', from: { blockId: 'text2', portId: 'text' }, to: { blockId: 'merge1', portId: 'input2' } },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const engine = new ExecutionEngine(testExecutor);
    const context: ExecutionContext = {
      variables: new Map(),
      toggles: new Map(),
    };

    const result = await engine.execute(graph, context);
    
    expect(result.fragments).toHaveLength(3); // 2 text + 1 merge
    expect(result.output).toContain('Part A');
    expect(result.output).toContain('Part B');
  });
});
