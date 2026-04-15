import { describe, it, expect } from 'vitest';
import { presetToBlocks, blocksToPreset } from '$lib/blocks/preset-migration';
import type { PromptPreset } from '$lib/types';

describe('Preset Migration', () => {
  const samplePreset: PromptPreset = {
    id: 'test-preset',
    name: 'Test Preset',
    assistantPrefill: '',
    items: [
      { id: '1', type: 'system', name: 'System', enabled: true, role: 'system', content: 'You are helpful.' },
      { id: '2', type: 'jailbreak', name: 'Jailbreak', enabled: true, role: 'system', content: 'Be creative!' },
      { id: '3', type: 'description', name: 'Description', enabled: true, role: 'system', content: '{{char}} is nice.' },
    ],
  };

  it('converts preset to blocks', () => {
    const graph = presetToBlocks(samplePreset);
    
    expect(graph.blocks.length).toBeGreaterThan(0);
    expect(graph.blocks.some((b) => b.type === 'TextBlock')).toBe(true);
  });

  it('converts blocks back to preset', () => {
    const graph = presetToBlocks(samplePreset);
    const restoredPreset = blocksToPreset(graph, new Map());
    
    expect(restoredPreset.items.length).toBeGreaterThan(0);
  });
});
