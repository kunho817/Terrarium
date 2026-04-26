import { describe, it, expect } from 'vitest';
import {
  blocksToPreset,
  normalizePromptBlockToggles,
  presetToBlocks,
} from '$lib/blocks/preset-migration';
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
    
    expect(graph.blocks).toHaveLength(samplePreset.items.length);
    expect(graph.blocks.some((block) => block.type === 'TextBlock')).toBe(true);
    expect(graph.blocks.some((block) => block.type === 'FieldBlock')).toBe(true);
  });

  it('converts blocks back to preset', () => {
    const graph = presetToBlocks(samplePreset);
    const restoredPreset = blocksToPreset(graph, samplePreset);
    
    expect(restoredPreset.id).toBe(samplePreset.id);
    expect(restoredPreset.name).toBe(samplePreset.name);
    expect(restoredPreset.items).toHaveLength(samplePreset.items.length);
    expect(restoredPreset.items.map((item) => item.type)).toEqual(
      samplePreset.items.map((item) => item.type),
    );
  });

  it('normalizes persisted toggle state from toggle blocks', () => {
    const toggles = normalizePromptBlockToggles(
      [{ id: 'debug', name: 'Debug', value: true }],
      {
        version: '1.0',
        blocks: [
          {
            id: 'toggle-1',
            type: 'ToggleBlock',
            position: { x: 10, y: 20 },
            config: {
              toggleId: 'debug',
              toggleName: 'Debug',
              defaultValue: false,
            },
          },
        ],
        connections: [],
      },
    );

    expect(toggles).toEqual([
      { id: 'debug', name: 'Debug', value: true },
    ]);
  });
});
