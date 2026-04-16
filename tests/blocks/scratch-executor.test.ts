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

  it('executes ToggleBlock', () => {
    const block: ScratchBlock = {
      id: 't1',
      type: 'ToggleBlock',
      config: { toggleId: 'my-toggle', defaultValue: false },
      slots: {},
      next: null,
    };
    
    const result = executeScratchBlock(block, { toggles: new Map([['my-toggle', true]]) });
    expect(result).toBe('true');
  });

  it('executes MemoryBlock', () => {
    const block: ScratchBlock = {
      id: 'm1',
      type: 'MemoryBlock',
      config: { count: 2, format: 'bullet' },
      slots: {},
      next: null,
    };
    
    const result = executeScratchBlock(block, { 
      memories: [
        { content: 'Memory 1', relevance: 0.9 },
        { content: 'Memory 2', relevance: 0.8 },
        { content: 'Memory 3', relevance: 0.7 },
      ]
    });
    expect(result).toBe('- Memory 1\n- Memory 2');
  });

  it('executes LorebookBlock', () => {
    const block: ScratchBlock = {
      id: 'l1',
      type: 'LorebookBlock',
      config: { maxEntries: 2, format: 'bullet' },
      slots: {},
      next: null,
    };
    
    const result = executeScratchBlock(block, { 
      lorebookEntries: [
        { keywords: ['test'], content: 'Entry 1' },
        { keywords: ['foo'], content: 'Entry 2' },
      ]
    });
    expect(result).toBe('- Entry 1\n- Entry 2');
  });

  it('executes SwitchBlock', () => {
    const block: ScratchBlock = {
      id: 's1',
      type: 'SwitchBlock',
      config: { 
        cases: [
          { value: 'option1', result: 'First option' },
          { value: 'option2', result: 'Second option' },
        ],
        defaultCase: 'Unknown'
      },
      slots: {
        variable: { id: 'v1', type: 'TextBlock', config: { content: 'option2' }, slots: {}, next: null },
      },
      next: null,
    };
    
    const result = executeScratchBlock(block, {});
    expect(result).toBe('Second option');
  });
});
