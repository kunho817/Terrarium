import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { scratchScriptStore, createEmptyScript } from '$lib/stores/scratch-script';
import type { ScratchBlock } from '$lib/types/scratch-blocks';

describe('scratchScriptStore', () => {
  beforeEach(() => {
    scratchScriptStore.reset();
  });

  it('initializes with empty script', () => {
    const state = get(scratchScriptStore);
    expect(state.currentScript).toBeNull();
  });

  it('creates a new script with root block', () => {
    scratchScriptStore.newScript('Test Script');
    const state = get(scratchScriptStore);
    
    expect(state.currentScript).not.toBeNull();
    expect(state.currentScript?.name).toBe('Test Script');
    expect(state.currentScript?.root).toBeDefined();
  });

  it('adds block to chain end', () => {
    scratchScriptStore.newScript('Test');
    const textBlock: ScratchBlock = {
      id: 'block-2',
      type: 'TextBlock',
      config: { content: 'Second' },
      slots: {},
      next: null,
    };
    
    scratchScriptStore.appendToChain(textBlock);
    const state = get(scratchScriptStore);
    
    expect(state.currentScript?.root.next).toEqual(textBlock);
  });

  it('nests block in slot', () => {
    scratchScriptStore.newScript('Test');
    const ifBlock: ScratchBlock = {
      id: 'if-1',
      type: 'IfBlock',
      config: {},
      slots: {},
      next: null,
    };
    const toggleBlock: ScratchBlock = {
      id: 'toggle-1',
      type: 'ToggleBlock',
      config: { toggleId: 'test-toggle' },
      slots: {},
      next: null,
    };
    
    scratchScriptStore.setRootBlock(ifBlock);
    scratchScriptStore.nestInSlot('if-1', 'condition', toggleBlock);
    const state = get(scratchScriptStore);
    
    expect(state.currentScript?.root.slots.condition).toEqual(toggleBlock);
  });

  it('removes block from chain', () => {
    scratchScriptStore.newScript('Test');
    const block1: ScratchBlock = {
      id: 'b1',
      type: 'TextBlock',
      config: { content: 'First' },
      slots: {},
      next: null,
    };
    const block2: ScratchBlock = {
      id: 'b2',
      type: 'TextBlock',
      config: { content: 'Second' },
      slots: {},
      next: null,
    };
    
    scratchScriptStore.appendToChain(block1);
    scratchScriptStore.appendToChain(block2);
    scratchScriptStore.removeBlock('b1');
    const state = get(scratchScriptStore);
    
    // b1 removed, b2 should now be root.next
    expect(state.currentScript?.root.next?.id).toBe('b2');
  });

  it('updates block config', () => {
    scratchScriptStore.newScript('Test');
    scratchScriptStore.updateBlockConfig(
      get(scratchScriptStore).currentScript!.root.id,
      { content: 'Updated content' }
    );
    const state = get(scratchScriptStore);
    
    expect(state.currentScript?.root.config.content).toBe('Updated content');
  });

  it('duplicates block and appends to chain', () => {
    scratchScriptStore.newScript('Test');
    const block1: ScratchBlock = {
      id: 'b1',
      type: 'TextBlock',
      config: { content: 'Original' },
      slots: {},
      next: null,
    };
    
    scratchScriptStore.appendToChain(block1);
    scratchScriptStore.duplicateBlock('b1');
    const state = get(scratchScriptStore);
    
    const root = state.currentScript?.root;
    expect(root?.next?.id).toBe('b1');
    expect(root?.next?.next).toBeDefined();
    expect(root?.next?.next?.type).toBe('TextBlock');
    expect(root?.next?.next?.config.content).toBe('Original');
    expect(root?.next?.next?.id).not.toBe('b1');
  });
});
