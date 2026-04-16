import { describe, it, expect } from 'vitest';
import { scratchBlockRegistry, getBlockDefinition, getAllBlocksByCategory } from '$lib/blocks/scratch-definitions';

describe('Scratch Block Definitions', () => {
  it('registers TextBlock', () => {
    const def = getBlockDefinition('TextBlock');
    expect(def).toBeDefined();
    expect(def?.displayName).toBe('Text');
    expect(def?.category).toBe('foundation');
    expect(def?.slots).toHaveLength(0);
  });

  it('registers IfBlock with slots', () => {
    const def = getBlockDefinition('IfBlock');
    expect(def).toBeDefined();
    expect(def?.slots).toHaveLength(3);
    expect(def?.slots[0].name).toBe('condition');
    expect(def?.slots[0].type).toBe('boolean');
    expect(def?.slots[1].name).toBe('then');
    expect(def?.slots[1].type).toBe('chain');
  });

  it('registers MergeBlock with multiple text slots', () => {
    const def = getBlockDefinition('MergeBlock');
    expect(def).toBeDefined();
    expect(def?.slots).toHaveLength(3);
    expect(def?.slots.every(s => s.type === 'text')).toBe(true);
  });

  it('getAllBlocksByCategory returns foundation blocks', () => {
    const foundation = getAllBlocksByCategory('foundation');
    expect(foundation.length).toBeGreaterThanOrEqual(4);
    expect(foundation.every(b => b.category === 'foundation')).toBe(true);
  });

  it('getAllBlocksByCategory returns logic blocks', () => {
    const logic = getAllBlocksByCategory('logic');
    expect(logic.length).toBeGreaterThanOrEqual(4);
    expect(logic.every(b => b.category === 'logic')).toBe(true);
  });
});
