# Scratch-Style Block Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the graph-based Block Builder with a Scratch-style visual programming interface using tree-based block structure.

**Architecture:** Tree-based data model where blocks have slots for nested inputs and a `next` pointer for vertical stacking. No separate connection entities. Execution traverses the tree recursively.

**Tech Stack:** Svelte 5, TypeScript, Svelte stores, Tailwind CSS

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/lib/types/scratch-blocks.ts` | Type definitions for ScratchBlock, ScratchScript, SlotDefinition |
| `src/lib/stores/scratch-script.ts` | Store for managing Scratch scripts |
| `src/lib/blocks/scratch-executor.ts` | Tree traversal execution engine |
| `src/lib/blocks/scratch-definitions.ts` | Block definitions with slot metadata |
| `src/lib/components/scratch/ScratchBuilder.svelte` | Main builder layout component |
| `src/lib/components/scratch/ScratchCanvas.svelte` | Canvas workspace with drag-drop |
| `src/lib/components/scratch/ScratchBlock.svelte` | Block component with shaped connectors |
| `src/lib/components/scratch/BlockPalette.svelte` | Left sidebar block palette |
| `src/lib/components/scratch/SlotRenderer.svelte` | Renders shaped input slots |
| `src/lib/components/scratch/PreviewPanel.svelte` | Collapsible right preview panel |

### Test Files

| File | Purpose |
|------|---------|
| `tests/types/scratch-blocks.test.ts` | Type validation tests |
| `tests/stores/scratch-script.test.ts` | Store operation tests |
| `tests/blocks/scratch-executor.test.ts` | Execution engine tests |
| `tests/blocks/scratch-definitions.test.ts` | Block definition tests |
| `tests/components/scratch/ScratchBlock.test.ts` | Block component tests |
| `tests/components/scratch/BlockPalette.test.ts` | Palette component tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/types/index.ts` | Export new scratch types |
| `src/routes/settings/prompt-builder/+page.svelte` | Use ScratchBuilder instead of BlockBuilder |

---

## Task 1: Define Scratch Block Types

**Files:**
- Create: `src/lib/types/scratch-blocks.ts`
- Create: `tests/types/scratch-blocks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/types/scratch-blocks.test.ts
import { describe, it, expect } from 'vitest';
import type { ScratchBlock, ScratchScript, SlotDefinition, BlockDefinition } from '$lib/types/scratch-blocks';

describe('Scratch Block Types', () => {
  it('ScratchBlock has required fields', () => {
    const block: ScratchBlock = {
      id: 'test-1',
      type: 'TextBlock',
      config: { content: 'Hello' },
      slots: {},
      next: null,
    };
    
    expect(block.id).toBe('test-1');
    expect(block.type).toBe('TextBlock');
    expect(block.next).toBeNull();
  });

  it('ScratchScript has root block', () => {
    const script: ScratchScript = {
      id: 'script-1',
      name: 'Test Script',
      root: {
        id: 'block-1',
        type: 'TextBlock',
        config: { content: 'Test' },
        slots: {},
        next: null,
      },
    };
    
    expect(script.root.type).toBe('TextBlock');
  });

  it('SlotDefinition describes slot types', () => {
    const slot: SlotDefinition = {
      name: 'condition',
      type: 'boolean',
      acceptsMultiple: false,
    };
    
    expect(slot.type).toBe('boolean');
    expect(slot.acceptsMultiple).toBe(false);
  });

  it('BlockDefinition has slots metadata', () => {
    const def: BlockDefinition = {
      type: 'IfBlock',
      category: 'logic',
      displayName: 'If',
      icon: '🔀',
      color: '#f38ba8',
      slots: [
        { name: 'condition', type: 'boolean', acceptsMultiple: false },
        { name: 'then', type: 'chain', acceptsMultiple: false },
        { name: 'else', type: 'chain', acceptsMultiple: false },
      ],
      outputType: 'text',
      defaultConfig: {},
    };
    
    expect(def.slots).toHaveLength(3);
    expect(def.outputType).toBe('text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/types/scratch-blocks.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create type definitions file**

```typescript
// src/lib/types/scratch-blocks.ts
export type BlockType =
  | 'TextBlock'
  | 'FieldBlock'
  | 'MemoryBlock'
  | 'LorebookBlock'
  | 'IfBlock'
  | 'ToggleBlock'
  | 'SwitchBlock'
  | 'MergeBlock';

export type SlotType = 'text' | 'boolean' | 'number' | 'list' | 'chain';

export interface BlockConfig {
  [key: string]: unknown;
}

export interface ScratchBlock {
  id: string;
  type: BlockType;
  config: BlockConfig;
  slots: Record<string, ScratchBlock | null>;
  next: ScratchBlock | null;
}

export interface ScratchScript {
  id: string;
  name: string;
  root: ScratchBlock;
}

export interface SlotDefinition {
  name: string;
  type: SlotType;
  acceptsMultiple: boolean;
}

export interface BlockDefinition {
  type: BlockType;
  category: 'foundation' | 'logic' | 'data' | 'structure';
  displayName: string;
  icon: string;
  color: string;
  slots: SlotDefinition[];
  outputType: SlotType;
  defaultConfig: BlockConfig;
}

export function createBlock(type: BlockType, id: string): ScratchBlock {
  return {
    id,
    type,
    config: {},
    slots: {},
    next: null,
  };
}

export function createScript(name: string): ScratchScript {
  return {
    id: crypto.randomUUID(),
    name,
    root: createBlock('TextBlock', crypto.randomUUID()),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/types/scratch-blocks.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/scratch-blocks.ts tests/types/scratch-blocks.test.ts
git commit -m "feat: add Scratch block type definitions"
```

---

## Task 2: Create Scratch Block Definitions

**Files:**
- Create: `src/lib/blocks/scratch-definitions.ts`
- Create: `tests/blocks/scratch-definitions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/blocks/scratch-definitions.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/blocks/scratch-definitions.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create block definitions**

```typescript
// src/lib/blocks/scratch-definitions.ts
import type { BlockDefinition, BlockType } from '$lib/types/scratch-blocks';

class ScratchBlockRegistry {
  private definitions = new Map<BlockType, BlockDefinition>();

  register(definition: BlockDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  get(type: BlockType): BlockDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.definitions.values());
  }

  getByCategory(category: BlockDefinition['category']): BlockDefinition[] {
    return this.getAll().filter(d => d.category === category);
  }
}

export const scratchBlockRegistry = new ScratchBlockRegistry();

// Foundation Blocks
scratchBlockRegistry.register({
  type: 'TextBlock',
  category: 'foundation',
  displayName: 'Text',
  icon: '📄',
  color: '#89b4fa',
  slots: [],
  outputType: 'text',
  defaultConfig: { content: '' },
});

scratchBlockRegistry.register({
  type: 'FieldBlock',
  category: 'foundation',
  displayName: 'Field',
  icon: '🏷️',
  color: '#a6e3a1',
  slots: [],
  outputType: 'text',
  defaultConfig: { fieldType: 'description', fallback: '' },
});

scratchBlockRegistry.register({
  type: 'MemoryBlock',
  category: 'foundation',
  displayName: 'Memory',
  icon: '💾',
  color: '#f9e2af',
  slots: [],
  outputType: 'list',
  defaultConfig: { count: 3, threshold: 0.7, format: 'bullet' },
});

scratchBlockRegistry.register({
  type: 'LorebookBlock',
  category: 'foundation',
  displayName: 'Lorebook',
  icon: '📚',
  color: '#fab387',
  slots: [],
  outputType: 'list',
  defaultConfig: { activationMode: 'keyword', maxEntries: 5, format: 'bullet' },
});

// Logic Blocks
scratchBlockRegistry.register({
  type: 'IfBlock',
  category: 'logic',
  displayName: 'If',
  icon: '🔀',
  color: '#f38ba8',
  slots: [
    { name: 'condition', type: 'boolean', acceptsMultiple: false },
    { name: 'then', type: 'chain', acceptsMultiple: false },
    { name: 'else', type: 'chain', acceptsMultiple: false },
  ],
  outputType: 'text',
  defaultConfig: {},
});

scratchBlockRegistry.register({
  type: 'ToggleBlock',
  category: 'logic',
  displayName: 'Toggle',
  icon: '⚙️',
  color: '#cba6f7',
  slots: [],
  outputType: 'boolean',
  defaultConfig: { toggleId: '', defaultValue: false },
});

scratchBlockRegistry.register({
  type: 'SwitchBlock',
  category: 'logic',
  displayName: 'Switch',
  icon: '📦',
  color: '#eba0ac',
  slots: [
    { name: 'variable', type: 'text', acceptsMultiple: false },
  ],
  outputType: 'text',
  defaultConfig: { cases: [], defaultCase: '' },
});

scratchBlockRegistry.register({
  type: 'MergeBlock',
  category: 'logic',
  displayName: 'Merge',
  icon: '🔗',
  color: '#94e2d5',
  slots: [
    { name: 'input1', type: 'text', acceptsMultiple: false },
    { name: 'input2', type: 'text', acceptsMultiple: false },
    { name: 'input3', type: 'text', acceptsMultiple: false },
  ],
  outputType: 'text',
  defaultConfig: { separator: '\n\n', filterEmpty: true },
});

export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return scratchBlockRegistry.get(type);
}

export function getAllBlocksByCategory(category: BlockDefinition['category']): BlockDefinition[] {
  return scratchBlockRegistry.getByCategory(category);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/blocks/scratch-definitions.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks/scratch-definitions.ts tests/blocks/scratch-definitions.test.ts
git commit -m "feat: add Scratch block definitions with slots"
```

---

## Task 3: Create Scratch Script Store

**Files:**
- Create: `src/lib/stores/scratch-script.ts`
- Create: `tests/stores/scratch-script.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/stores/scratch-script.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/stores/scratch-script.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create the store**

```typescript
// src/lib/stores/scratch-script.ts
import { writable } from 'svelte/store';
import type { ScratchBlock, ScratchScript } from '$lib/types/scratch-blocks';
import { createBlock } from '$lib/types/scratch-blocks';

export interface ScratchScriptState {
  currentScript: ScratchScript | null;
  scripts: ScratchScript[];
  toggles: Map<string, boolean>;
  toggleNames: Map<string, string>;
}

export function createEmptyScript(name: string): ScratchScript {
  return {
    id: crypto.randomUUID(),
    name,
    root: createBlock('TextBlock', crypto.randomUUID()),
  };
}

function createScratchScriptStore() {
  const { subscribe, set, update } = writable<ScratchScriptState>({
    currentScript: null,
    scripts: [],
    toggles: new Map(),
    toggleNames: new Map(),
  });

  function findBlockById(block: ScratchBlock | null, id: string): ScratchBlock | null {
    if (!block) return null;
    if (block.id === id) return block;
    
    // Check slots
    for (const slotBlock of Object.values(block.slots)) {
      const found = findBlockById(slotBlock, id);
      if (found) return found;
    }
    
    // Check chain
    return findBlockById(block.next, id);
  }

  function findParentOf(block: ScratchBlock | null, targetId: string, parent: ScratchBlock | null = null, slotName?: string): { parent: ScratchBlock | null; slotName?: string } | null {
    if (!block) return null;
    if (block.next?.id === targetId) return { parent: block };
    
    for (const [name, slotBlock] of Object.entries(block.slots)) {
      if (slotBlock?.id === targetId) {
        return { parent: block, slotName: name };
      }
      const found = findParentOf(slotBlock, targetId, block, name);
      if (found) return found;
    }
    
    return findParentOf(block.next, targetId, block);
  }

  function deepClone(block: ScratchBlock): ScratchBlock {
    return {
      ...block,
      config: { ...block.config },
      slots: Object.fromEntries(
        Object.entries(block.slots).map(([k, v]) => [k, v ? deepClone(v) : null])
      ),
      next: block.next ? deepClone(block.next) : null,
    };
  }

  return {
    subscribe,

    reset: () => {
      set({
        currentScript: null,
        scripts: [],
        toggles: new Map(),
        toggleNames: new Map(),
      });
    },

    newScript: (name: string) => {
      const script = createEmptyScript(name);
      update(state => ({
        ...state,
        currentScript: script,
        scripts: [...state.scripts, script],
      }));
    },

    loadScript: (script: ScratchScript) => {
      update(state => ({
        ...state,
        currentScript: script,
      }));
    },

    setRootBlock: (block: ScratchBlock) => {
      update(state => {
        if (!state.currentScript) return state;
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root: block,
          },
        };
      });
    },

    appendToChain: (block: ScratchBlock) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        let current = root;
        while (current.next) {
          current = current.next;
        }
        current.next = block;
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    nestInSlot: (blockId: string, slotName: string, block: ScratchBlock) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        const target = findBlockById(root, blockId);
        if (target) {
          target.slots[slotName] = block;
        }
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    removeBlock: (blockId: string) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        
        // If removing root, replace with next or create empty
        if (root.id === blockId) {
          const newRoot = root.next || createBlock('TextBlock', crypto.randomUUID());
          return {
            ...state,
            currentScript: {
              ...state.currentScript,
              root: newRoot,
            },
          };
        }
        
        // Find parent and remove
        const result = findParentOf(root, blockId);
        if (result?.parent) {
          if (result.slotName) {
            result.parent.slots[result.slotName] = null;
          } else {
            // Removing from chain - bypass it
            const toRemove = result.parent.next;
            if (toRemove) {
              result.parent.next = toRemove.next;
            }
          }
        }
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    updateBlockConfig: (blockId: string, config: Record<string, unknown>) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        const block = findBlockById(root, blockId);
        if (block) {
          block.config = { ...block.config, ...config };
        }
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },

    duplicateBlock: (blockId: string) => {
      update(state => {
        if (!state.currentScript) return state;
        
        const root = deepClone(state.currentScript.root);
        const block = findBlockById(root, blockId);
        if (!block) return state;
        
        const duplicate = deepClone({
          ...block,
          id: crypto.randomUUID(),
        });
        
        // Find end of chain and append
        let current = root;
        while (current.next) {
          current = current.next;
        }
        current.next = duplicate;
        
        return {
          ...state,
          currentScript: {
            ...state.currentScript,
            root,
          },
        };
      });
    },
  };
}

export const scratchScriptStore = createScratchScriptStore();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/stores/scratch-script.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/scratch-script.ts tests/stores/scratch-script.test.ts
git commit -m "feat: add Scratch script store with tree operations"
```

---

## Task 4: Create Scratch Executor

**Files:**
- Create: `src/lib/blocks/scratch-executor.ts`
- Create: `tests/blocks/scratch-executor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/blocks/scratch-executor.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/blocks/scratch-executor.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create the executor**

```typescript
// src/lib/blocks/scratch-executor.ts
import type { ScratchBlock } from '$lib/types/scratch-blocks';

export interface ExecutionContext {
  toggles?: Map<string, boolean>;
  characterFields?: Record<string, string>;
  memories?: Array<{ content: string; relevance: number }>;
  lorebookEntries?: Array<{ keywords: string[]; content: string }>;
}

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 0;
  return Boolean(value);
}

function formatList(items: string[], format: 'bullet' | 'paragraph'): string {
  if (items.length === 0) return '';
  
  if (format === 'bullet') {
    return items.map(item => `- ${item}`).join('\n');
  }
  return items.join('\n\n');
}

export function executeScratchBlock(block: ScratchBlock, context: ExecutionContext): string {
  switch (block.type) {
    case 'TextBlock':
      return block.config.content as string ?? '';

    case 'FieldBlock': {
      const fieldType = block.config.fieldType as string;
      const fallback = block.config.fallback as string ?? '';
      const fields = context.characterFields ?? {};
      return fields[fieldType] ?? fallback;
    }

    case 'ToggleBlock': {
      const toggleId = block.config.toggleId as string;
      const defaultValue = block.config.defaultValue as boolean ?? false;
      const toggles = context.toggles ?? new Map();
      return toggles.get(toggleId) ?? defaultValue ? 'true' : 'false';
    }

    case 'MemoryBlock': {
      const count = block.config.count as number ?? 3;
      const format = block.config.format as 'bullet' | 'paragraph' ?? 'bullet';
      const memories = context.memories ?? [];
      
      const items = memories
        .slice(0, count)
        .map(m => m.content);
      
      return formatList(items, format);
    }

    case 'LorebookBlock': {
      const maxEntries = block.config.maxEntries as number ?? 5;
      const format = block.config.format as 'bullet' | 'paragraph' ?? 'bullet';
      const entries = context.lorebookEntries ?? [];
      
      const items = entries
        .slice(0, maxEntries)
        .map(e => e.content);
      
      return formatList(items, format);
    }

    case 'IfBlock': {
      const conditionBlock = block.slots.condition;
      const conditionValue = conditionBlock ? executeScratchBlock(conditionBlock, context) : '';
      
      if (isTruthy(conditionValue)) {
        const thenBlock = block.slots.then;
        return thenBlock ? executeChain(thenBlock, context) : '';
      } else {
        const elseBlock = block.slots.else;
        return elseBlock ? executeChain(elseBlock, context) : '';
      }
    }

    case 'MergeBlock': {
      const separator = block.config.separator as string ?? '\n\n';
      const filterEmpty = block.config.filterEmpty as boolean ?? true;
      
      const inputs = ['input1', 'input2', 'input3']
        .map(slotName => block.slots[slotName])
        .filter(Boolean)
        .map(b => b ? executeScratchBlock(b, context) : '');
      
      const filtered = filterEmpty ? inputs.filter(s => s.trim()) : inputs;
      return filtered.join(separator);
    }

    case 'SwitchBlock': {
      const variableBlock = block.slots.variable;
      const variable = variableBlock ? executeScratchBlock(variableBlock, context) : '';
      const cases = block.config.cases as Array<{ value: string; result: string }> ?? [];
      const defaultCase = block.config.defaultCase as string ?? '';
      
      const match = cases.find(c => c.value === variable);
      return match?.result ?? defaultCase;
    }

    default:
      return '';
  }
}

export function executeChain(block: ScratchBlock | null, context: ExecutionContext = {}): string {
  if (!block) return '';
  
  const current = executeScratchBlock(block, context);
  const next = executeChain(block.next, context);
  
  if (!current.trim()) return next;
  if (!next.trim()) return current;
  return `${current}\n${next}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/blocks/scratch-executor.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks/scratch-executor.ts tests/blocks/scratch-executor.test.ts
git commit -m "feat: add Scratch executor with tree traversal"
```

---

## Task 5: Export Types from Index

**Files:**
- Modify: `src/lib/types/index.ts`

- [ ] **Step 1: Add scratch block exports**

Add these lines at the end of `src/lib/types/index.ts`:

```typescript
// Scratch Blocks
export type {
  ScratchBlock,
  ScratchScript,
  SlotType,
  SlotDefinition,
  BlockDefinition as ScratchBlockDefinition,
  BlockType as ScratchBlockType,
  BlockConfig as ScratchBlockConfig,
} from './scratch-blocks';
export { createBlock, createScript } from './scratch-blocks';
```

- [ ] **Step 2: Verify types are accessible**

Run: `npm test tests/types/scratch-blocks.test.ts -- --run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: export scratch block types from index"
```

---

## Task 6: Create BlockPalette Component

**Files:**
- Create: `src/lib/components/scratch/BlockPalette.svelte`
- Create: `tests/components/scratch/BlockPalette.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/components/scratch/BlockPalette.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockPalette from '$lib/components/scratch/BlockPalette.svelte';

describe('BlockPalette', () => {
  it('renders foundation category', () => {
    const { container } = render(BlockPalette);
    const foundationHeader = container.querySelector('[data-category="foundation"]');
    expect(foundationHeader).toBeTruthy();
  });

  it('renders logic category', () => {
    const { container } = render(BlockPalette);
    const logicHeader = container.querySelector('[data-category="logic"]');
    expect(logicHeader).toBeTruthy();
  });

  it('renders TextBlock in palette', () => {
    const { getByText } = render(BlockPalette);
    expect(getByText('Text')).toBeTruthy();
  });

  it('renders IfBlock in palette', () => {
    const { getByText } = render(BlockPalette);
    expect(getByText('If')).toBeTruthy();
  });

  it('has draggable blocks', () => {
    const { container } = render(BlockPalette);
    const blocks = container.querySelectorAll('[draggable="true"]');
    expect(blocks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/scratch/BlockPalette.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create BlockPalette component**

```svelte
<!-- src/lib/components/scratch/BlockPalette.svelte -->
<script lang="ts">
  import { getAllBlocksByCategory } from '$lib/blocks/scratch-definitions';
  import type { BlockDefinition } from '$lib/types/scratch-blocks';

  const categories = [
    { id: 'foundation' as const, name: 'Foundation', color: '#89b4fa' },
    { id: 'logic' as const, name: 'Logic', color: '#f38ba8' },
  ];

  function handleDragStart(e: DragEvent, block: BlockDefinition) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'new-block',
      blockType: block.type,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }
</script>

<aside class="palette w-48 bg-base flex flex-col overflow-y-auto">
  {#each categories as category}
    <div class="category" data-category={category.id}>
      <div 
        class="category-header px-3 py-2 text-xs font-semibold uppercase tracking-wider"
        style="background: {category.color}22; color: {category.color};"
      >
        {category.name}
      </div>
      <div class="category-blocks p-2 space-y-1">
        {#each getAllBlocksByCategory(category.id) as block}
          <div
            class="palette-block flex items-center gap-2 px-3 py-2 rounded cursor-grab hover:brightness-110 transition-all"
            style="background: {block.color};"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, block)}
            data-block-type={block.type}
            role="button"
            tabindex="0"
          >
            <span class="text-lg">{block.icon}</span>
            <span class="text-sm font-medium text-crust">{block.displayName}</span>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</aside>

<style>
  .palette {
    border-right: 1px solid var(--surface2);
  }
  .palette-block:active {
    cursor: grabbing;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/scratch/BlockPalette.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scratch/BlockPalette.svelte tests/components/scratch/BlockPalette.test.ts
git commit -m "feat: add BlockPalette component with draggable blocks"
```

---

## Task 7: Create ScratchBlock Component

**Files:**
- Create: `src/lib/components/scratch/ScratchBlock.svelte`
- Create: `tests/components/scratch/ScratchBlock.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/components/scratch/ScratchBlock.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ScratchBlock from '$lib/components/scratch/ScratchBlock.svelte';
import type { ScratchBlock as ScratchBlockType } from '$lib/types/scratch-blocks';

describe('ScratchBlock', () => {
  it('renders TextBlock', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Hello' },
      slots: {},
      next: null,
    };
    
    const { getByText } = render(ScratchBlock, { props: { block } });
    expect(getByText('📄')).toBeTruthy();
    expect(getByText('Text')).toBeTruthy();
  });

  it('renders block content', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Hello World' },
      slots: {},
      next: null,
    };
    
    const { getByText } = render(ScratchBlock, { props: { block } });
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders IfBlock with slots', () => {
    const block: ScratchBlockType = {
      id: 'if1',
      type: 'IfBlock',
      config: {},
      slots: {},
      next: null,
    };
    
    const { getByText, container } = render(ScratchBlock, { props: { block } });
    expect(getByText('🔀')).toBeTruthy();
    expect(getByText('If')).toBeTruthy();
    
    // Check for slot placeholders
    const slots = container.querySelectorAll('.slot');
    expect(slots.length).toBeGreaterThan(0);
  });

  it('has draggable attribute', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Test' },
      slots: {},
      next: null,
    };
    
    const { container } = render(ScratchBlock, { props: { block } });
    const blockEl = container.querySelector('[data-block-id="t1"]');
    expect(blockEl?.hasAttribute('draggable')).toBe(true);
  });

  it('shows notch at bottom for chaining', () => {
    const block: ScratchBlockType = {
      id: 't1',
      type: 'TextBlock',
      config: { content: 'Test' },
      slots: {},
      next: null,
    };
    
    const { container } = render(ScratchBlock, { props: { block } });
    const notch = container.querySelector('.notch');
    expect(notch).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/scratch/ScratchBlock.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create ScratchBlock component**

```svelte
<!-- src/lib/components/scratch/ScratchBlock.svelte -->
<script lang="ts">
  import type { ScratchBlock as ScratchBlockType, BlockDefinition } from '$lib/types/scratch-blocks';
  import { getBlockDefinition } from '$lib/blocks/scratch-definitions';
  import SlotRenderer from './SlotRenderer.svelte';

  interface Props {
    block: ScratchBlockType;
    onDragStart?: (e: DragEvent, block: ScratchBlockType) => void;
    onSlotDrop?: (blockId: string, slotName: string, block: ScratchBlockType) => void;
  }

  let { block, onDragStart, onSlotDrop }: Props = $props();

  const definition: BlockDefinition | undefined = $derived(getBlockDefinition(block.type));

  function handleDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'existing-block',
      block,
    }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(e, block);
  }

  function handleSlotDrop(e: DragEvent, slotName: string) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'new-block') {
        const newBlock: ScratchBlockType = {
          id: crypto.randomUUID(),
          type: data.blockType,
          config: { ...getBlockDefinition(data.blockType)?.defaultConfig },
          slots: {},
          next: null,
        };
        onSlotDrop?.(block.id, slotName, newBlock);
      }
    } catch {
      // Ignore parse errors
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }
</script>

<div
  class="scratch-block"
  style="--block-color: {definition?.color ?? '#6c7086'};"
  data-block-id={block.id}
  data-block-type={block.type}
  draggable="true"
  ondragstart={handleDragStart}
>
  <div class="block-header">
    <span class="block-icon">{definition?.icon ?? '🔷'}</span>
    <span class="block-name">{definition?.displayName ?? block.type}</span>
  </div>
  
  <div class="block-content">
    {#if block.type === 'TextBlock'}
      <div class="text-preview">
        {block.config.content || <span class="placeholder">Click to edit...</span>}
      </div>
    {:else if block.type === 'FieldBlock'}
      <div class="field-config text-xs">
        {block.config.fieldType ?? 'description'}
      </div>
    {:else if block.type === 'ToggleBlock'}
      <div class="toggle-config text-xs">
        {block.config.toggleId || 'Select toggle...'}
      </div>
    {:else}
      {#each definition?.slots ?? [] as slot}
        <SlotRenderer 
          slotDef={slot} 
          block={block.slots[slot.name]}
          ondrop={(e) => handleSlotDrop(e, slot.name)}
          ondragover={handleDragOver}
        />
      {/each}
    {/if}
  </div>
  
  <div class="notch" ondragover={handleDragOver} ondrop={() => {}}></div>
</div>

<style>
  .scratch-block {
    background: var(--block-color);
    border-radius: 8px;
    min-width: 180px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    user-select: none;
  }
  
  .block-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px 8px 0 0;
  }
  
  .block-icon {
    font-size: 1.1rem;
  }
  
  .block-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--crust);
  }
  
  .block-content {
    padding: 0.5rem 0.75rem;
    min-height: 2rem;
  }
  
  .text-preview {
    font-size: 0.75rem;
    color: var(--crust);
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .placeholder {
    opacity: 0.5;
    font-style: italic;
  }
  
  .notch {
    height: 8px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 0 0 8px 8px;
    cursor: pointer;
  }
  
  .notch:hover {
    background: rgba(0, 0, 0, 0.25);
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/scratch/ScratchBlock.test.ts -- --run`
Expected: PASS (will need SlotRenderer first - see Task 8)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scratch/ScratchBlock.svelte tests/components/scratch/ScratchBlock.test.ts
git commit -m "feat: add ScratchBlock component with shaped slots"
```

---

## Task 8: Create SlotRenderer Component

**Files:**
- Create: `src/lib/components/scratch/SlotRenderer.svelte`
- Create: `tests/components/scratch/SlotRenderer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/components/scratch/SlotRenderer.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SlotRenderer from '$lib/components/scratch/SlotRenderer.svelte';
import type { SlotDefinition, ScratchBlock } from '$lib/types/scratch-blocks';

describe('SlotRenderer', () => {
  it('renders text slot with rounded shape', () => {
    const slot: SlotDefinition = { name: 'input', type: 'text', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const slotEl = container.querySelector('.slot');
    
    expect(slotEl).toBeTruthy();
    expect(slotEl?.classList.contains('text-slot')).toBe(true);
  });

  it('renders boolean slot with pointed shape', () => {
    const slot: SlotDefinition = { name: 'condition', type: 'boolean', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const slotEl = container.querySelector('.slot');
    
    expect(slotEl?.classList.contains('boolean-slot')).toBe(true);
  });

  it('renders chain slot for If then/else', () => {
    const slot: SlotDefinition = { name: 'then', type: 'chain', acceptsMultiple: false };
    
    const { container } = render(SlotRenderer, { props: { slotDef: slot } });
    const slotEl = container.querySelector('.slot');
    
    expect(slotEl?.classList.contains('chain-slot')).toBe(true);
  });

  it('shows placeholder text when empty', () => {
    const slot: SlotDefinition = { name: 'condition', type: 'boolean', acceptsMultiple: false };
    
    const { getByText } = render(SlotRenderer, { props: { slotDef: slot } });
    expect(getByText('condition')).toBeTruthy();
  });

  it('renders nested block when provided', () => {
    const slot: SlotDefinition = { name: 'input', type: 'text', acceptsMultiple: false };
    const block: ScratchBlock = {
      id: 'nested',
      type: 'TextBlock',
      config: { content: 'Nested content' },
      slots: {},
      next: null,
    };
    
    const { getByText } = render(SlotRenderer, { props: { slotDef: slot, block } });
    expect(getByText('Nested content')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/scratch/SlotRenderer.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create SlotRenderer component**

```svelte
<!-- src/lib/components/scratch/SlotRenderer.svelte -->
<script lang="ts">
  import type { SlotDefinition, ScratchBlock } from '$lib/types/scratch-blocks';
  import ScratchBlock from './ScratchBlock.svelte';

  interface Props {
    slotDef: SlotDefinition;
    block?: ScratchBlock | null;
    ondrop?: (e: DragEvent) => void;
    ondragover?: (e: DragEvent) => void;
  }

  let { slotDef, block, ondrop, ondragover }: Props = $props();

  const slotClass = $derived(
    `slot ${slotDef.type}-slot`
  );
</script>

<div
  class={slotClass}
  ondrop={ondrop}
  ondragover={ondragover}
  data-slot-name={slotDef.name}
  data-slot-type={slotDef.type}
>
  {#if block}
    <ScratchBlock {block} />
  {:else}
    <span class="slot-placeholder">{slotDef.name}</span>
  {/if}
</div>

<style>
  .slot {
    min-height: 1.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0.25rem 0;
    display: flex;
    align-items: center;
  }
  
  .text-slot {
    border-radius: 9999px;
    border: 2px dashed rgba(255, 255, 255, 0.3);
  }
  
  .boolean-slot {
    clip-path: polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%);
    border: none;
    background: rgba(245, 139, 168, 0.2);
  }
  
  .chain-slot {
    border-radius: 4px;
    min-height: 3rem;
    border: 2px dashed rgba(255, 255, 255, 0.3);
    flex-direction: column;
    align-items: stretch;
  }
  
  .slot-placeholder {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/scratch/SlotRenderer.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scratch/SlotRenderer.svelte tests/components/scratch/SlotRenderer.test.ts
git commit -m "feat: add SlotRenderer with shaped slot containers"
```

---

## Task 9: Create ScratchCanvas Component

**Files:**
- Create: `src/lib/components/scratch/ScratchCanvas.svelte`
- Create: `tests/components/scratch/ScratchCanvas.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/components/scratch/ScratchCanvas.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ScratchCanvas from '$lib/components/scratch/ScratchCanvas.svelte';
import { scratchScriptStore } from '$lib/stores/scratch-script';
import { get } from 'svelte/store';

describe('ScratchCanvas', () => {
  beforeEach(() => {
    scratchScriptStore.reset();
  });

  it('renders empty state message', () => {
    const { getByText } = render(ScratchCanvas);
    expect(getByText(/drag a block/i)).toBeTruthy();
  });

  it('renders blocks from script', () => {
    scratchScriptStore.newScript('Test');
    const state = get(scratchScriptStore);
    
    const { container } = render(ScratchCanvas);
    const blocks = container.querySelectorAll('[data-block-id]');
    
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('is a drop zone', () => {
    const { container } = render(ScratchCanvas);
    const canvas = container.querySelector('.scratch-canvas');
    
    expect(canvas).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/scratch/ScratchCanvas.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create ScratchCanvas component**

```svelte
<!-- src/lib/components/scratch/ScratchCanvas.svelte -->
<script lang="ts">
  import { scratchScriptStore } from '$lib/stores/scratch-script';
  import { getBlockDefinition } from '$lib/blocks/scratch-definitions';
  import ScratchBlock from './ScratchBlock.svelte';
  import type { ScratchBlock as ScratchBlockType } from '$lib/types/scratch-blocks';
  import { get } from 'svelte/store';

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'new-block') {
        const newBlock: ScratchBlockType = {
          id: crypto.randomUUID(),
          type: data.blockType,
          config: { ...getBlockDefinition(data.blockType)?.defaultConfig },
          slots: {},
          next: null,
        };
        
        const state = get(scratchScriptStore);
        if (!state.currentScript) {
          scratchScriptStore.newScript('Untitled');
        }
        scratchScriptStore.appendToChain(newBlock);
      }
    } catch {
      // Ignore parse errors
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  const script = $derived(get(scratchScriptStore).currentScript);
</script>

<div
  class="scratch-canvas flex-1 bg-base overflow-auto p-4"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  role="region"
  aria-label="Block workspace"
>
  {#if script}
    <div class="blocks-container">
      <ScratchBlock block={script.root} />
      
      {#if script.root.next}
        {#each [] as _}
          <!-- Chain is rendered recursively in ScratchBlock -->
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty-state flex items-center justify-center h-full text-subtext0">
      <div class="text-center">
        <p class="text-lg mb-2">📄</p>
        <p>Drag a block from the palette to start</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .blocks-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/scratch/ScratchCanvas.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scratch/ScratchCanvas.svelte tests/components/scratch/ScratchCanvas.test.ts
git commit -m "feat: add ScratchCanvas with drop zone"
```

---

## Task 10: Create PreviewPanel Component

**Files:**
- Create: `src/lib/components/scratch/PreviewPanel.svelte`
- Create: `tests/components/scratch/PreviewPanel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/components/scratch/PreviewPanel.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PreviewPanel from '$lib/components/scratch/PreviewPanel.svelte';

describe('PreviewPanel', () => {
  it('renders preview title', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: 'Test prompt', tokens: 10 } });
    expect(getByText('Preview')).toBeTruthy();
  });

  it('displays prompt content', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: 'Hello World', tokens: 2 } });
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('displays token count', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: 'Test', tokens: 127 } });
    expect(getByText(/127/)).toBeTruthy();
  });

  it('has close button', () => {
    const { container } = render(PreviewPanel, { props: { prompt: '', tokens: 0 } });
    const closeBtn = container.querySelector('[data-action="close"]');
    expect(closeBtn).toBeTruthy();
  });

  it('shows empty state when no prompt', () => {
    const { getByText } = render(PreviewPanel, { props: { prompt: '', tokens: 0 } });
    expect(getByText(/no content/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/scratch/PreviewPanel.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create PreviewPanel component**

```svelte
<!-- src/lib/components/scratch/PreviewPanel.svelte -->
<script lang="ts">
  interface Props {
    prompt: string;
    tokens: number;
    isOpen?: boolean;
    onClose?: () => void;
  }

  let { prompt, tokens, isOpen = true, onClose }: Props = $props();
</script>

{#if isOpen}
  <aside class="preview-panel w-72 bg-surface1 border-l border-surface2 flex flex-col">
    <header class="px-4 py-3 border-b border-surface2 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-text">Preview</h2>
      <button
        class="text-subtext0 hover:text-text transition-colors"
        onclick={() => onClose?.()}
        data-action="close"
        aria-label="Close preview"
      >
        ✕
      </button>
    </header>
    
    <div class="flex-1 overflow-auto p-4">
      {#if prompt.trim()}
        <pre class="text-xs text-text whitespace-pre-wrap font-mono">{prompt}</pre>
      {:else}
        <p class="text-xs text-subtext0 italic">No content generated yet.</p>
      {/if}
    </div>
    
    <footer class="px-4 py-2 border-t border-surface2 text-xs text-subtext0">
      Tokens: {tokens}
    </footer>
  </aside>
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/scratch/PreviewPanel.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scratch/PreviewPanel.svelte tests/components/scratch/PreviewPanel.test.ts
git commit -m "feat: add PreviewPanel with token count"
```

---

## Task 11: Create ScratchBuilder Main Component

**Files:**
- Create: `src/lib/components/scratch/ScratchBuilder.svelte`
- Create: `tests/components/scratch/ScratchBuilder.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/components/scratch/ScratchBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ScratchBuilder from '$lib/components/scratch/ScratchBuilder.svelte';

describe('ScratchBuilder', () => {
  it('renders full layout', () => {
    const { container } = render(ScratchBuilder);
    
    expect(container.querySelector('.palette')).toBeTruthy();
    expect(container.querySelector('.scratch-canvas')).toBeTruthy();
    expect(container.querySelector('.preview-panel')).toBeTruthy();
  });

  it('has header with title', () => {
    const { getByText } = render(ScratchBuilder);
    expect(getByText('Prompt Builder')).toBeTruthy();
  });

  it('has preview toggle button', () => {
    const { container } = render(ScratchBuilder);
    const toggleBtn = container.querySelector('[data-action="toggle-preview"]');
    expect(toggleBtn).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/components/scratch/ScratchBuilder.test.ts -- --run`
Expected: FAIL - module not found

- [ ] **Step 3: Create ScratchBuilder component**

```svelte
<!-- src/lib/components/scratch/ScratchBuilder.svelte -->
<script lang="ts">
  import { get } from 'svelte/store';
  import BlockPalette from './BlockPalette.svelte';
  import ScratchCanvas from './ScratchCanvas.svelte';
  import PreviewPanel from './PreviewPanel.svelte';
  import { scratchScriptStore } from '$lib/stores/scratch-script';
  import { executeChain } from '$lib/blocks/scratch-executor';
  import { countTokens } from '$lib/utils/tokenizer';

  let showPreview = $state(true);

  function togglePreview() {
    showPreview = !showPreview;
  }

  function handleSave() {
    // TODO: Implement save logic
    console.log('Save script');
  }

  const prompt = $derived(() => {
    const script = get(scratchScriptStore).currentScript;
    if (!script) return '';
    return executeChain(script.root);
  });

  const tokens = $derived(() => {
    return countTokens(prompt());
  });
</script>

<div class="scratch-builder h-full flex flex-col bg-base">
  <header class="px-4 py-3 border-b border-surface2 flex items-center justify-between">
    <h1 class="text-lg font-semibold text-text">Prompt Builder</h1>
    
    <div class="flex items-center gap-3">
      <button
        class="px-3 py-1.5 text-sm rounded bg-surface2 text-text hover:bg-surface1 transition-colors"
        onclick={togglePreview}
        data-action="toggle-preview"
      >
        Preview {showPreview ? '◀' : '▶'}
      </button>
      
      <button
        class="px-3 py-1.5 text-sm rounded bg-lavender text-crust font-medium hover:brightness-110 transition-all"
        onclick={handleSave}
      >
        Save
      </button>
    </div>
  </header>
  
  <div class="flex-1 flex overflow-hidden">
    <BlockPalette />
    <ScratchCanvas />
    <PreviewPanel 
      prompt={prompt()} 
      tokens={tokens()} 
      isOpen={showPreview}
      onClose={togglePreview}
    />
  </div>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/components/scratch/ScratchBuilder.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/scratch/ScratchBuilder.svelte tests/components/scratch/ScratchBuilder.test.ts
git commit -m "feat: add ScratchBuilder main layout component"
```

---

## Task 12: Update Prompt Builder Page

**Files:**
- Modify: `src/routes/settings/prompt-builder/+page.svelte`

- [ ] **Step 1: Read current page**

Run: Read `src/routes/settings/prompt-builder/+page.svelte`

- [ ] **Step 2: Replace with ScratchBuilder**

Replace the content with:

```svelte
<script lang="ts">
  import ScratchBuilder from '$lib/components/scratch/ScratchBuilder.svelte';
</script>

<ScratchBuilder />
```

- [ ] **Step 3: Verify app loads**

Run: `npm run dev`
Navigate to `/settings/prompt-builder`

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/prompt-builder/+page.svelte
git commit -m "feat: use ScratchBuilder in prompt builder page"
```

---

## Task 13: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`

- [ ] **Step 2: Fix any failing tests**

If any tests fail, debug and fix.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Scratch-style block builder implementation"
```
