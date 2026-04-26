import type { BlockGraph, GraphPromptTemplate, PromptBlockToggle } from '$lib/types';
import { ExecutionEngine } from './execution-engine';
import { executeBlock } from './executors';
import { buildPromptBlockToggleMap } from './preset-migration';
import { registerAllBlocks } from './registry';

export async function compileBlockGraphText(
  graph: BlockGraph,
  toggles?: PromptBlockToggle[],
): Promise<string> {
  registerAllBlocks();
  const engine = new ExecutionEngine({ execute: executeBlock });
  const result = await engine.execute(graph, {
    variables: new Map(),
    toggles: buildPromptBlockToggleMap(toggles),
  });

  return result.output.trim();
}

export function createTextGraphTemplate(
  content: string,
  itemName: string,
  role: 'system' | 'user' | 'assistant' = 'system',
): GraphPromptTemplate {
  return {
    graph: {
      version: '1.0',
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'TextBlock',
          position: { x: 140, y: 140 },
          config: {
            itemType: 'plain',
            itemName,
            role,
            content,
            enabled: true,
          },
        },
      ],
      connections: [],
    },
    toggles: [],
    compiledText: content,
  };
}
