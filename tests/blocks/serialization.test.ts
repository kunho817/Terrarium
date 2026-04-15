import { describe, it, expect } from 'vitest';
import { exportToTPrompt, importFromTPrompt, exportToTChunk, exportToTFrag } from '$lib/blocks/serialization';
import type { BlockGraph, BlockInstance } from '$lib/types';

describe('Serialization', () => {
  const sampleGraph: BlockGraph = {
    version: '1.0',
    blocks: [
      { id: 'block1', type: 'TextBlock', position: { x: 100, y: 100 }, config: { content: 'Hello' } },
      { id: 'block2', type: 'IfBlock', position: { x: 300, y: 100 }, config: {} },
    ],
    connections: [
      { id: 'conn1', from: { blockId: 'block1', portId: 'text' }, to: { blockId: 'block2', portId: 'trueBranch' } },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  it('exports to .tprompt format', () => {
    const tprompt = exportToTPrompt('Test Prompt', sampleGraph, { author: 'User' });
    
    expect(tprompt.type).toBe('prompt');
    expect(tprompt.name).toBe('Test Prompt');
    expect(tprompt.blocks).toHaveLength(2);
    expect(tprompt.connections).toHaveLength(1);
    expect(tprompt.version).toBe('1.0');
  });

  it('imports from .tprompt format', () => {
    const tprompt = exportToTPrompt('Test Prompt', sampleGraph);
    const imported = importFromTPrompt(tprompt);
    
    expect(imported.blocks).toHaveLength(2);
    expect(imported.connections).toHaveLength(1);
    expect(imported.version).toBe('1.0');
  });

  it('exports single block to .tfrag', () => {
    const block: BlockInstance = {
      id: 'block1',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    const tfrag = exportToTFrag(block);
    
    expect(tfrag.type).toBe('fragment');
    expect(tfrag.block.type).toBe('TextBlock');
  });

  it('exports multiple blocks to .tchunk', () => {
    const tchunk = exportToTChunk('My Chunk', sampleGraph);
    
    expect(tchunk.type).toBe('chunk');
    expect(tchunk.name).toBe('My Chunk');
    expect(tchunk.blocks).toHaveLength(2);
  });
});
