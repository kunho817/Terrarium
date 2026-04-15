/**
 * Block serialization - export/import .tfrag, .tchunk, .tprompt
 */

import type { BlockGraph, BlockInstance } from '$lib/types';

// .tprompt - Complete prompt export
export interface TPromptFile {
  type: 'prompt';
  version: '1.0';
  name: string;
  description?: string;
  blocks: BlockInstance[];
  connections: BlockGraph['connections'];
  toggles?: Array<{
    id: string;
    name: string;
    scope: 'global' | 'local' | 'inherited';
    defaultValue: boolean;
  }>;
  variables?: Array<{
    name: string;
    defaultValue: unknown;
    scope: 'block' | 'prompt' | 'global';
  }>;
  metadata?: {
    author?: string;
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
  };
}

// .tchunk - Block cluster export
export interface TChunkFile {
  type: 'chunk';
  version: '1.0';
  name: string;
  description?: string;
  blocks: BlockInstance[];
  connections: BlockGraph['connections'];
  toggles?: TPromptFile['toggles'];
}

// .tfrag - Single block export
export interface TFragFile {
  type: 'fragment';
  version: '1.0';
  block: BlockInstance;
}

export function exportToTPrompt(
  name: string,
  graph: BlockGraph,
  metadata?: TPromptFile['metadata']
): TPromptFile {
  return {
    type: 'prompt',
    version: '1.0',
    name,
    blocks: graph.blocks,
    connections: graph.connections,
    metadata: {
      ...metadata,
      createdAt: new Date().toISOString(),
    },
  };
}

export function importFromTPrompt(file: TPromptFile): BlockGraph {
  return {
    version: '1.0',
    blocks: file.blocks,
    connections: file.connections,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function exportToTChunk(
  name: string,
  graph: BlockGraph,
  description?: string
): TChunkFile {
  return {
    type: 'chunk',
    version: '1.0',
    name,
    description,
    blocks: graph.blocks,
    connections: graph.connections,
  };
}

export function importFromTChunk(file: TChunkFile): BlockGraph {
  return {
    version: '1.0',
    blocks: file.blocks,
    connections: file.connections,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function exportToTFrag(block: BlockInstance): TFragFile {
  return {
    type: 'fragment',
    version: '1.0',
    block,
  };
}

export function importFromTFrag(file: TFragFile): BlockInstance {
  return file.block;
}

// File download helpers
export function downloadAsJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
