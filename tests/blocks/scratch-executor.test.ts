import { describe, it, expect } from 'vitest';
import { executeScratchBlock, executeChain } from '$lib/blocks/scratch-executor';
import type { ScratchBlock } from '$lib/types/scratch-blocks';

describe('Scratch Executor', () => {
  it('executes TextBlock', () => {
    const block: ScratchBlock = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Hello World' },
      slots: {},
      next: null,
    };
    
    const result = executeScratchBlock(block, {});
    expect(result).toBe('Hello World');
  });

  it('executes chain of text blocks', () => {
    const chain: ScratchBlock = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'First' },
      slots: {},
      next: {
        id: 't2',
        type: 'TextBlock',
        config: { content: 'Second' },
        slots: {},
        next: null,
      },
    };
    
    const result = executeChain(chain);
    expect(result).toBe('First\nSecond');
  });

  it('executes MergeBlock', () => {
    const block: ScratchBlock = {
      id: 'm1',
      type: 'MergeBlock',
      config: { separator: ' | ' },
      slots: {
        input1: { id: 'i1', type: 'TextBlock', config: { content: 'A' }, slots: {}, next: null },
        input2: { id: 'i2', type: 'TextBlock', config: { content: 'B' }, slots: {}, next: null },
        input3: null,
      },
      next: null,
    };
    
    const result = executeScratchBlock(block, {});
    expect(result).toBe('A | B');
  });

  it('executes IfBlock with true condition', () => {
    const block: ScratchBlock = {
      id: 'if1',
      type: 'IfBlock',
      config: {},
      slots: {
        condition: { id: 'toggle1', type: 'ToggleBlock', config: { toggleId: 'test', defaultValue: true }, slots: {}, next: null },
        then: { id: 'then1', type: 'TextBlock', config: { content: 'Yes' }, slots: {}, next: null },
        else: null,
      },
      next: null,
    };
    
    const result = executeScratchBlock(block, { toggles: new Map([['test', true]]) });
    expect(result).toBe('Yes');
  });

  it('executes IfBlock with false condition', () => {
    const block: ScratchBlock = {
      id: 'if1',
      type: 'IfBlock',
      config: {},
      slots: {
        condition: { id: 'toggle1', type: 'ToggleBlock', config: { toggleId: 'test', defaultValue: false }, slots: {}, next: null },
        then: { id: 'then1', type: 'TextBlock', config: { content: 'Yes' }, slots: {}, next: null },
        else: { id: 'else1', type: 'TextBlock', config: { content: 'No' }, slots: {}, next: null },
      },
      next: null,
    };
    
    const result = executeScratchBlock(block, { toggles: new Map([['test', false]]) });
    expect(result).toBe('No');
  });

  it('executes FieldBlock with fallback', () => {
    const block: ScratchBlock = {
      id: 'f1',
      type: 'FieldBlock',
      config: { fieldType: 'description', fallback: 'Default description' },
      slots: {},
      next: null,
    };
    
    const result = executeScratchBlock(block, { characterFields: {} });
    expect(result).toBe('Default description');
  });

  it('executes FieldBlock with character field', () => {
    const block: ScratchBlock = {
      id: 'f1',
      type: 'FieldBlock',
      config: { fieldType: 'description', fallback: 'Default' },
      slots: {},
      next: null,
    };
    
    const result = executeScratchBlock(block, { 
      characterFields: { description: 'Alice is a curious girl' } 
    });
    expect(result).toBe('Alice is a curious girl');
  });
});
