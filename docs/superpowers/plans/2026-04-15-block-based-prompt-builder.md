# Block-Based Prompt Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Scratch-like visual prompt builder that replaces CBS syntax with drag-and-drop blocks, enabling intuitive conditional logic and composable prompt creation.

**Architecture:** Three-layer system: (1) Block Registry with type-safe port system, (2) Canvas UI with Svelte 5 + SVG for node rendering and connections, (3) Execution Engine that traverses graph to produce prompt fragments. Supports migration from existing presets and export/import of blocks (.tfrag, .tchunk, .tprompt).

**Tech Stack:** Svelte 5 (runes), TypeScript strict, TailwindCSS, existing template engine, storage system

---

## File Structure Overview

### New Files (25+)

**Core Types & Interfaces:**
- `src/lib/types/blocks.ts` - Block type definitions, ports, configs
- `src/lib/types/block-execution.ts` - Execution engine types

**Block System:**
- `src/lib/blocks/registry.ts` - Block registry with plugin system
- `src/lib/blocks/base-block.ts` - Base block class/interface
- `src/lib/blocks/execution-engine.ts` - Graph traversal and execution

**Block Implementations (one per block type):**
- `src/lib/blocks/implementations/text-block.ts`
- `src/lib/blocks/implementations/field-block.ts`
- `src/lib/blocks/implementations/memory-block.ts`
- `src/lib/blocks/implementations/lorebook-block.ts`
- `src/lib/blocks/implementations/if-block.ts`
- `src/lib/blocks/implementations/toggle-block.ts`
- `src/lib/blocks/implementations/switch-block.ts`
- `src/lib/blocks/implementations/merge-block.ts`
- `src/lib/blocks/implementations/variable-block.ts`
- `src/lib/blocks/implementations/loop-block.ts`

**Canvas System:**
- `src/lib/components/blocks/BlockCanvas.svelte` - Main canvas container
- `src/lib/components/blocks/BlockNode.svelte` - Individual block component
- `src/lib/components/blocks/ConnectionLine.svelte` - SVG connection lines
- `src/lib/components/blocks/BlockPalette.svelte` - Sidebar palette
- `src/lib/components/blocks/Port.svelte` - Input/output ports

**UI Components:**
- `src/lib/components/blocks/LivePreview.svelte` - Preview panel
- `src/lib/components/blocks/TogglePanel.svelte` - Toggle management
- `src/lib/components/blocks/Toolbar.svelte` - Canvas toolbar

**Stores:**
- `src/lib/stores/block-builder.ts` - Block builder state store

**Serialization:**
- `src/lib/blocks/serialization.ts` - Export/import (.tfrag, .tchunk, .tprompt)
- `src/lib/blocks/preset-migration.ts` - Preset ↔ block conversion

**Tests:**
- `tests/blocks/registry.test.ts`
- `tests/blocks/execution-engine.test.ts`
- `tests/blocks/serialization.test.ts`
- `tests/blocks/implementations/*.test.ts` (one per block)

### Modified Files
- `src/routes/settings/prompt-builder/+page.svelte` - Add block builder tab
- `src/lib/types/index.ts` - Export block types

---

## Phase 1: Foundation (Core System)

### Task 1: Core Types and Interfaces

**Files:**
- Create: `src/lib/types/blocks.ts`
- Create: `src/lib/types/block-execution.ts`

- [ ] **Step 1: Write type definitions for blocks**

Create `src/lib/types/blocks.ts`:
```typescript
/**
 * Block-based prompt builder types
 */

export type BlockType = 
  | 'TextBlock' | 'FieldBlock' | 'MemoryBlock' | 'LorebookBlock'
  | 'IfBlock' | 'ToggleBlock' | 'SwitchBlock' | 'MergeBlock'
  | 'VariableBlock' | 'LoopBlock';

export type PortType = 'text' | 'boolean' | 'number' | 'list';

export interface Port {
  id: string;
  name: string;
  type: PortType;
  required: boolean;
}

export interface InputPort extends Port {
  direction: 'input';
}

export interface OutputPort extends Port {
  direction: 'output';
}

export interface BlockConfig {
  [key: string]: unknown;
}

export interface BlockDefinition {
  type: BlockType;
  category: 'foundation' | 'logic' | 'data' | 'structure';
  displayName: string;
  icon: string;
  description: string;
  color: string;
  inputPorts: InputPort[];
  outputPorts: OutputPort[];
  defaultConfig: BlockConfig;
}

export interface BlockInstance {
  id: string;
  type: BlockType;
  position: { x: number; y: number };
  config: BlockConfig;
  collapsed?: boolean;
}

export interface Connection {
  id: string;
  from: { blockId: string; portId: string };
  to: { blockId: string; portId: string };
}

export interface BlockGraph {
  version: '1.0';
  blocks: BlockInstance[];
  connections: Connection[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}
```

- [ ] **Step 2: Write execution types**

Create `src/lib/types/block-execution.ts`:
```typescript
/**
 * Block execution engine types
 */

import type { BlockType, BlockConfig, PortType } from './blocks';

export interface ExecutionContext {
  variables: Map<string, unknown>;
  toggles: Map<string, boolean>;
  characterId?: string;
  sessionId?: string;
}

export interface PromptFragment {
  text: string;
  sourceBlockId: string;
  sourceBlockType: BlockType;
  metadata?: {
    isConditional?: boolean;
    conditionResult?: boolean;
    toggleId?: string;
  };
}

export type PortValue = string | boolean | number | string[] | undefined;

export interface BlockExecutionResult {
  outputs: Map<string, PortValue>;
  fragments: PromptFragment[];
}

export interface BlockExecutor {
  execute(
    blockType: BlockType,
    config: BlockConfig,
    inputs: Map<string, PortValue>,
    context: ExecutionContext
  ): BlockExecutionResult | Promise<BlockExecutionResult>;
}

export interface ExecutionError {
  blockId: string;
  blockType: BlockType;
  message: string;
  severity: 'error' | 'warning';
}
```

- [ ] **Step 3: Export types from index**

Modify `src/lib/types/index.ts`:
```typescript
// Add to existing exports
export type {
  BlockType,
  BlockDefinition,
  BlockInstance,
  BlockConfig,
  Connection,
  BlockGraph,
  Port,
  PortType,
  InputPort,
  OutputPort,
} from './blocks';

export type {
  ExecutionContext,
  PromptFragment,
  PortValue,
  BlockExecutionResult,
  BlockExecutor,
  ExecutionError,
} from './block-execution';
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/blocks.ts src/lib/types/block-execution.ts src/lib/types/index.ts
git commit -m "feat(blocks): add core type definitions for block system"
```

---

### Task 2: Block Registry

**Files:**
- Create: `src/lib/blocks/registry.ts`
- Test: `tests/blocks/registry.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/blocks/registry.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BlockRegistry } from '$lib/blocks/registry';
import type { BlockDefinition, BlockType } from '$lib/types';

describe('BlockRegistry', () => {
  let registry: BlockRegistry;

  beforeEach(() => {
    registry = new BlockRegistry();
  });

  it('registers a block definition', () => {
    const definition: BlockDefinition = {
      type: 'TextBlock' as BlockType,
      category: 'foundation',
      displayName: 'Text',
      icon: '📄',
      description: 'Static text block',
      color: '#89b4fa',
      inputPorts: [],
      outputPorts: [{ id: 'text', name: 'Text', type: 'text', direction: 'output', required: false }],
      defaultConfig: { content: '', enabled: true },
    };

    registry.register(definition);
    expect(registry.get('TextBlock')).toBe(definition);
  });

  it('throws when registering duplicate block type', () => {
    const definition: BlockDefinition = {
      type: 'TextBlock' as BlockType,
      category: 'foundation',
      displayName: 'Text',
      icon: '📄',
      description: 'Static text block',
      color: '#89b4fa',
      inputPorts: [],
      outputPorts: [],
      defaultConfig: {},
    };

    registry.register(definition);
    expect(() => registry.register(definition)).toThrow('Block type TextBlock already registered');
  });

  it('returns all registered blocks', () => {
    const textBlock: BlockDefinition = {
      type: 'TextBlock' as BlockType,
      category: 'foundation',
      displayName: 'Text',
      icon: '📄',
      description: 'Static text block',
      color: '#89b4fa',
      inputPorts: [],
      outputPorts: [],
      defaultConfig: {},
    };

    const ifBlock: BlockDefinition = {
      type: 'IfBlock' as BlockType,
      category: 'logic',
      displayName: 'If',
      icon: '🔀',
      description: 'Conditional logic',
      color: '#f38ba8',
      inputPorts: [],
      outputPorts: [],
      defaultConfig: {},
    };

    registry.register(textBlock);
    registry.register(ifBlock);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAllByCategory('foundation')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/blocks/registry.test.ts --run
```

Expected: FAIL with "Cannot find module '$lib/blocks/registry'"

- [ ] **Step 3: Implement registry**

Create `src/lib/blocks/registry.ts`:
```typescript
/**
 * Block registry - manages block definitions
 */

import type { BlockDefinition, BlockType } from '$lib/types';

export class BlockRegistry {
  private definitions = new Map<BlockType, BlockDefinition>();

  register(definition: BlockDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Block type ${definition.type} already registered`);
    }
    this.definitions.set(definition.type, definition);
  }

  get(type: BlockType): BlockDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.definitions.values());
  }

  getAllByCategory(category: BlockDefinition['category']): BlockDefinition[] {
    return this.getAll().filter((d) => d.category === category);
  }

  has(type: BlockType): boolean {
    return this.definitions.has(type);
  }
}

// Global registry instance
export const blockRegistry = new BlockRegistry();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/blocks/registry.test.ts --run
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks/registry.ts tests/blocks/registry.test.ts
git commit -m "feat(blocks): add block registry with registration and lookup"
```

---

### Task 3: Register Foundation Block Definitions

**Files:**
- Create: `src/lib/blocks/definitions.ts`
- Modify: `src/lib/blocks/registry.ts`

- [ ] **Step 1: Define foundation blocks**

Create `src/lib/blocks/definitions.ts`:
```typescript
/**
 * Block definitions for the prompt builder
 */

import type { BlockDefinition } from '$lib/types';
import { blockRegistry } from './registry';

// Text Block
const textBlock: BlockDefinition = {
  type: 'TextBlock',
  category: 'foundation',
  displayName: 'Text',
  icon: '📄',
  description: 'Static text with template variable support',
  color: '#89b4fa',
  inputPorts: [],
  outputPorts: [
    { id: 'text', name: 'Text', type: 'text', required: false },
  ],
  defaultConfig: {
    content: '',
    enabled: true,
  },
};

// Field Block
const fieldBlock: BlockDefinition = {
  type: 'FieldBlock',
  category: 'foundation',
  displayName: 'Field',
  icon: '🏷️',
  description: 'Character card field (jailbreak, description, etc.)',
  color: '#a6e3a1',
  inputPorts: [],
  outputPorts: [
    { id: 'text', name: 'Text', type: 'text', required: false },
  ],
  defaultConfig: {
    fieldType: 'description',
    fallback: '',
  },
};

// Memory Block
const memoryBlock: BlockDefinition = {
  type: 'MemoryBlock',
  category: 'foundation',
  displayName: 'Memory',
  icon: '💾',
  description: 'Retrieve memories based on similarity',
  color: '#f9e2af',
  inputPorts: [
    { id: 'context', name: 'Context', type: 'text', required: false },
  ],
  outputPorts: [
    { id: 'memories', name: 'Memories', type: 'list', required: false },
  ],
  defaultConfig: {
    count: 3,
    threshold: 0.7,
    format: 'bullet',
  },
};

// Lorebook Block
const lorebookBlock: BlockDefinition = {
  type: 'LorebookBlock',
  category: 'foundation',
  displayName: 'Lorebook',
  icon: '📚',
  description: 'Inject lorebook entries',
  color: '#fab387',
  inputPorts: [],
  outputPorts: [
    { id: 'entries', name: 'Entries', type: 'list', required: false },
  ],
  defaultConfig: {
    activationMode: 'keyword',
    maxEntries: 5,
  },
};

export function registerAllBlocks(): void {
  blockRegistry.register(textBlock);
  blockRegistry.register(fieldBlock);
  blockRegistry.register(memoryBlock);
  blockRegistry.register(lorebookBlock);
}
```

- [ ] **Step 2: Update registry to export registration**

Modify `src/lib/blocks/registry.ts` - add at end:
```typescript
// Re-export for convenience
export { registerAllBlocks } from './definitions';
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/blocks/definitions.ts src/lib/blocks/registry.ts
git commit -m "feat(blocks): add foundation block definitions (Text, Field, Memory, Lorebook)"
```

---

### Task 4: Basic Block Canvas Component

**Files:**
- Create: `src/lib/components/blocks/BlockCanvas.svelte`
- Test: `tests/components/BlockCanvas.test.ts`

- [ ] **Step 1: Write test**

Create `tests/components/BlockCanvas.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BlockCanvas from '$lib/components/blocks/BlockCanvas.svelte';
import type { BlockGraph } from '$lib/types';

describe('BlockCanvas', () => {
  const emptyGraph: BlockGraph = {
    version: '1.0',
    blocks: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  it('renders canvas container', () => {
    render(BlockCanvas, { props: { graph: emptyGraph } });
    expect(screen.getByTestId('block-canvas')).toBeInTheDocument();
  });

  it('displays empty state message', () => {
    render(BlockCanvas, { props: { graph: emptyGraph } });
    expect(screen.getByText(/drag blocks here/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement canvas component**

Create `src/lib/components/blocks/BlockCanvas.svelte`:
```svelte
<script lang="ts">
  import type { BlockGraph, BlockInstance } from '$lib/types';

  interface Props {
    graph: BlockGraph;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
  }

  let { graph, onBlockMove }: Props = $props();

  let canvasRef: HTMLDivElement;
  let isDragging = $state(false);
  let dragOffset = $state({ x: 0, y: 0 });
  let draggedBlockId: string | null = $state(null);

  function handleMouseDown(e: MouseEvent, block: BlockInstance) {
    if (e.button !== 0) return;
    
    isDragging = true;
    draggedBlockId = block.id;
    dragOffset = {
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y,
    };
    
    e.stopPropagation();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !draggedBlockId) return;
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };
    
    onBlockMove?.(draggedBlockId, newPosition);
  }

  function handleMouseUp() {
    isDragging = false;
    draggedBlockId = null;
  }
</script>

<div
  bind:this={canvasRef}
  data-testid="block-canvas"
  class="relative w-full h-full bg-surface0 rounded-lg overflow-hidden"
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  role="region"
  aria-label="Block canvas"
>
  <!-- Grid background -->
  <div
    class="absolute inset-0 opacity-10"
    style="background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 20px 20px;"
  ></div>

  <!-- Empty state -->
  {#if graph.blocks.length === 0}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center text-subtext0">
        <p class="text-lg mb-2">Drag blocks here</p>
        <p class="text-sm">Connect them to build your prompt</p>
      </div>
    </div>
  {/if}

  <!-- Blocks -->
  {#each graph.blocks as block (block.id)}
    <div
      class="absolute p-3 bg-surface1 rounded-lg border border-surface2 shadow-lg cursor-move select-none"
      style="left: {block.position.x}px; top: {block.position.y}px;"
      onmousedown={(e) => handleMouseDown(e, block)}
      role="button"
      aria-label="Block {block.type}"
    >
      <div class="text-sm font-medium text-text">{block.type}</div>
      <div class="text-xs text-subtext0 mt-1">ID: {block.id.slice(0, 8)}</div>
    </div>
  {/each}
</div>
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/components/BlockCanvas.test.ts --run
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/blocks/BlockCanvas.svelte tests/components/BlockCanvas.test.ts
git commit -m "feat(blocks): add basic canvas component with drag support"
```

---

### Task 5: Block Palette Component

**Files:**
- Create: `src/lib/components/blocks/BlockPalette.svelte`

- [ ] **Step 1: Implement palette component**

Create `src/lib/components/blocks/BlockPalette.svelte`:
```svelte
<script lang="ts">
  import { blockRegistry } from '$lib/blocks/registry';
  import type { BlockDefinition } from '$lib/types';

  interface Props {
    onBlockDragStart?: (blockType: string) => void;
  }

  let { onBlockDragStart }: Props = $props();

  const categories = [
    { id: 'foundation', label: 'Foundation', color: '#89b4fa' },
    { id: 'logic', label: 'Logic (CBS)', color: '#f38ba8' },
    { id: 'data', label: 'Data', color: '#a6e3a1' },
    { id: 'structure', label: 'Structure', color: '#94e2d5' },
  ] as const;

  function getBlocksByCategory(category: string): BlockDefinition[] {
    return blockRegistry.getAllByCategory(category as BlockDefinition['category']);
  }

  function handleDragStart(e: DragEvent, blockType: string) {
    e.dataTransfer?.setData('text/plain', blockType);
    onBlockDragStart?.(blockType);
  }
</script>

<div class="w-64 h-full bg-surface1 rounded-lg p-4 overflow-y-auto">
  <h3 class="text-sm font-semibold text-text mb-4">Block Palette</h3>

  {#each categories as category}
    {@const blocks = getBlocksByCategory(category.id)}
    {#if blocks.length > 0}
      <div class="mb-4">
        <div
          class="text-xs uppercase font-medium mb-2 px-2 py-1 rounded"
          style="color: {category.color}; background: {category.color}20;"
        >
          {category.label}
        </div>

        <div class="space-y-2">
          {#each blocks as block}
            <div
              class="flex items-center gap-2 p-2 bg-surface0 rounded cursor-grab hover:bg-surface2 transition-colors"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, block.type)}
              role="button"
              aria-label="Drag {block.displayName} block"
            >
              <span class="text-lg">{block.icon}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-text truncate">
                  {block.displayName}
                </div>
                <div class="text-xs text-subtext0 truncate">
                  {block.description}
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/blocks/BlockPalette.svelte
git commit -m "feat(blocks): add block palette sidebar component"
```

---

### Task 6: Block Builder Store

**Files:**
- Create: `src/lib/stores/block-builder.ts`
- Test: `tests/stores/block-builder.test.ts`

- [ ] **Step 1: Write test**

Create `tests/stores/block-builder.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { blockBuilderStore, createEmptyGraph } from '$lib/stores/block-builder';
import type { BlockInstance } from '$lib/types';

describe('blockBuilderStore', () => {
  beforeEach(() => {
    blockBuilderStore.reset();
  });

  it('initializes with empty graph', () => {
    const state = get(blockBuilderStore);
    expect(state.currentGraph).toEqual(createEmptyGraph());
  });

  it('adds a block', () => {
    const block: BlockInstance = {
      id: 'test-block',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    blockBuilderStore.addBlock(block);
    const state = get(blockBuilderStore);
    
    expect(state.currentGraph.blocks).toHaveLength(1);
    expect(state.currentGraph.blocks[0]).toEqual(block);
  });

  it('removes a block', () => {
    const block: BlockInstance = {
      id: 'test-block',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    blockBuilderStore.addBlock(block);
    blockBuilderStore.removeBlock('test-block');
    const state = get(blockBuilderStore);
    
    expect(state.currentGraph.blocks).toHaveLength(0);
  });

  it('updates block position', () => {
    const block: BlockInstance = {
      id: 'test-block',
      type: 'TextBlock',
      position: { x: 100, y: 100 },
      config: { content: 'Hello' },
    };

    blockBuilderStore.addBlock(block);
    blockBuilderStore.updateBlockPosition('test-block', { x: 200, y: 200 });
    const state = get(blockBuilderStore);
    
    expect(state.currentGraph.blocks[0].position).toEqual({ x: 200, y: 200 });
  });
});
```

- [ ] **Step 2: Implement store**

Create `src/lib/stores/block-builder.ts`:
```typescript
/**
 * Block builder state store
 */

import { writable } from 'svelte/store';
import type { BlockGraph, BlockInstance, Connection } from '$lib/types';

export interface BlockBuilderState {
  currentGraph: BlockGraph;
  selectedBlockId: string | null;
  history: BlockGraph[];
  historyIndex: number;
}

export function createEmptyGraph(): BlockGraph {
  return {
    version: '1.0',
    blocks: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function createBlockBuilderStore() {
  const { subscribe, set, update } = writable<BlockBuilderState>({
    currentGraph: createEmptyGraph(),
    selectedBlockId: null,
    history: [createEmptyGraph()],
    historyIndex: 0,
  });

  return {
    subscribe,
    
    reset: () => {
      set({
        currentGraph: createEmptyGraph(),
        selectedBlockId: null,
        history: [createEmptyGraph()],
        historyIndex: 0,
      });
    },

    addBlock: (block: BlockInstance) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: [...state.currentGraph.blocks, block],
        },
      }));
    },

    removeBlock: (blockId: string) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: state.currentGraph.blocks.filter((b) => b.id !== blockId),
          connections: state.currentGraph.connections.filter(
            (c) => c.from.blockId !== blockId && c.to.blockId !== blockId
          ),
        },
      }));
    },

    updateBlockPosition: (blockId: string, position: { x: number; y: number }) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: state.currentGraph.blocks.map((b) =>
            b.id === blockId ? { ...b, position } : b
          ),
        },
      }));
    },

    updateBlockConfig: (blockId: string, config: Record<string, unknown>) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          blocks: state.currentGraph.blocks.map((b) =>
            b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b
          ),
        },
      }));
    },

    addConnection: (connection: Connection) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          connections: [...state.currentGraph.connections, connection],
        },
      }));
    },

    removeConnection: (connectionId: string) => {
      update((state) => ({
        ...state,
        currentGraph: {
          ...state.currentGraph,
          connections: state.currentGraph.connections.filter((c) => c.id !== connectionId),
        },
      }));
    },

    setGraph: (graph: BlockGraph) => {
      update((state) => ({
        ...state,
        currentGraph: graph,
      }));
    },

    selectBlock: (blockId: string | null) => {
      update((state) => ({
        ...state,
        selectedBlockId: blockId,
      }));
    },
  };
}

export const blockBuilderStore = createBlockBuilderStore();
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/stores/block-builder.test.ts --run
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/block-builder.ts tests/stores/block-builder.test.ts
git commit -m "feat(blocks): add block builder state store with CRUD operations"
```

---

## Phase 1 Checkpoint

At this point you have:
- ✅ Core type definitions (blocks, execution)
- ✅ Block registry with registration system
- ✅ Foundation block definitions registered
- ✅ Basic canvas component with drag support
- ✅ Block palette sidebar
- ✅ Block builder store with state management

**Next: Phase 2 - Logic Blocks (CBS Replacement) and Execution Engine**

---

## Phase 2: Logic Blocks and Execution Engine

### Task 7: Execution Engine

**Files:**
- Create: `src/lib/blocks/execution-engine.ts`
- Test: `tests/blocks/execution-engine.test.ts`

- [ ] **Step 1: Write test**

Create `tests/blocks/execution-engine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ExecutionEngine } from '$lib/blocks/execution-engine';
import type { BlockGraph, ExecutionContext, PromptFragment } from '$lib/types';

// Simple test executor
const testExecutor = {
  execute: async (blockType, config, inputs, context) => {
    if (blockType === 'TextBlock') {
      return {
        outputs: new Map([['text', config.content as string]]),
        fragments: [{
          text: config.content as string,
          sourceBlockId: 'test',
          sourceBlockType: 'TextBlock',
        }],
      };
    }
    if (blockType === 'MergeBlock') {
      const texts = Array.from(inputs.values()).filter((v): v is string => typeof v === 'string');
      const merged = texts.join('\n\n');
      return {
        outputs: new Map([['combined', merged]]),
        fragments: [{
          text: merged,
          sourceBlockId: 'test',
          sourceBlockType: 'MergeBlock',
        }],
      };
    }
    return { outputs: new Map(), fragments: [] };
  },
};

describe('ExecutionEngine', () => {
  it('executes a single text block', async () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [
        { id: 'text1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Hello' } },
      ],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const engine = new ExecutionEngine(testExecutor);
    const context: ExecutionContext = {
      variables: new Map(),
      toggles: new Map(),
    };

    const result = await engine.execute(graph, context);
    
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0].text).toBe('Hello');
  });

  it('executes connected blocks', async () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [
        { id: 'text1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Part A' } },
        { id: 'text2', type: 'TextBlock', position: { x: 0, y: 100 }, config: { content: 'Part B' } },
        { id: 'merge1', type: 'MergeBlock', position: { x: 200, y: 50 }, config: {} },
      ],
      connections: [
        { id: 'conn1', from: { blockId: 'text1', portId: 'text' }, to: { blockId: 'merge1', portId: 'input1' } },
        { id: 'conn2', from: { blockId: 'text2', portId: 'text' }, to: { blockId: 'merge1', portId: 'input2' } },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const engine = new ExecutionEngine(testExecutor);
    const context: ExecutionContext = {
      variables: new Map(),
      toggles: new Map(),
    };

    const result = await engine.execute(graph, context);
    
    expect(result.fragments).toHaveLength(3); // 2 text + 1 merge
    expect(result.output).toContain('Part A');
    expect(result.output).toContain('Part B');
  });
});
```

- [ ] **Step 2: Implement execution engine**

Create `src/lib/blocks/execution-engine.ts`:
```typescript
/**
 * Block execution engine - traverses graph and executes blocks
 */

import type {
  BlockGraph,
  BlockInstance,
  Connection,
  ExecutionContext,
  BlockExecutor,
  BlockExecutionResult,
  PromptFragment,
  ExecutionError,
  PortValue,
} from '$lib/types';
import { blockRegistry } from './registry';

interface ExecutionResult {
  fragments: PromptFragment[];
  output: string;
  errors: ExecutionError[];
}

export class ExecutionEngine {
  constructor(private executor: BlockExecutor) {}

  async execute(graph: BlockGraph, context: ExecutionContext): Promise<ExecutionResult> {
    const executedBlocks = new Set<string>();
    const fragments: PromptFragment[] = [];
    const errors: ExecutionError[] = [];
    const blockOutputs = new Map<string, Map<string, PortValue>>();

    // Find output nodes (blocks with no outgoing connections)
    const outputBlocks = this.findOutputBlocks(graph);

    // Execute from output blocks backward
    for (const block of outputBlocks) {
      try {
        await this.executeBlock(block, graph, context, executedBlocks, blockOutputs, fragments, errors);
      } catch (error) {
        errors.push({
          blockId: block.id,
          blockType: block.type,
          message: error instanceof Error ? error.message : 'Unknown error',
          severity: 'error',
        });
      }
    }

    // Combine fragments into final output
    const output = this.assembleOutput(fragments);

    return { fragments, output, errors };
  }

  private findOutputBlocks(graph: BlockGraph): BlockInstance[] {
    const hasOutgoingConnection = new Set<string>();
    
    for (const conn of graph.connections) {
      hasOutgoingConnection.add(conn.from.blockId);
    }

    return graph.blocks.filter((b) => !hasOutgoingConnection.has(b.id));
  }

  private async executeBlock(
    block: BlockInstance,
    graph: BlockGraph,
    context: ExecutionContext,
    executedBlocks: Set<string>,
    blockOutputs: Map<string, Map<string, PortValue>>,
    fragments: PromptFragment[],
    errors: ExecutionError[]
  ): Promise<Map<string, PortValue>> {
    // Return cached result if already executed
    if (executedBlocks.has(block.id)) {
      return blockOutputs.get(block.id) || new Map();
    }

    // Get inputs from connected blocks
    const inputs = await this.resolveInputs(block, graph, context, executedBlocks, blockOutputs, fragments, errors);

    // Execute the block
    const definition = blockRegistry.get(block.type);
    if (!definition) {
      throw new Error(`Unknown block type: ${block.type}`);
    }

    try {
      const result = await this.executor.execute(
        block.type,
        block.config,
        inputs,
        context
      );

      // Mark as executed and cache outputs
      executedBlocks.add(block.id);
      blockOutputs.set(block.id, result.outputs);

      // Add fragments (avoid duplicates)
      for (const fragment of result.fragments) {
        if (!fragments.some((f) => f.sourceBlockId === fragment.sourceBlockId && f.text === fragment.text)) {
          fragments.push(fragment);
        }
      }

      return result.outputs;
    } catch (error) {
      errors.push({
        blockId: block.id,
        blockType: block.type,
        message: error instanceof Error ? error.message : 'Execution failed',
        severity: 'error',
      });
      return new Map();
    }
  }

  private async resolveInputs(
    block: BlockInstance,
    graph: BlockGraph,
    context: ExecutionContext,
    executedBlocks: Set<string>,
    blockOutputs: Map<string, Map<string, PortValue>>,
    fragments: PromptFragment[],
    errors: ExecutionError[]
  ): Promise<Map<string, PortValue>> {
    const inputs = new Map<string, PortValue>();

    // Find all connections targeting this block
    const incomingConnections = graph.connections.filter((c) => c.to.blockId === block.id);

    for (const conn of incomingConnections) {
      const sourceBlock = graph.blocks.find((b) => b.id === conn.from.blockId);
      if (!sourceBlock) continue;

      // Execute source block to get its output
      const sourceOutputs = await this.executeBlock(
        sourceBlock,
        graph,
        context,
        executedBlocks,
        blockOutputs,
        fragments,
        errors
      );

      // Map source output to this block's input
      const outputValue = sourceOutputs.get(conn.from.portId);
      inputs.set(conn.to.portId, outputValue);
    }

    return inputs;
  }

  private assembleOutput(fragments: PromptFragment[]): string {
    // Sort fragments by execution order (they're already in order)
    // Combine with appropriate separators
    const nonEmptyFragments = fragments.filter((f) => f.text.trim());
    
    return nonEmptyFragments
      .map((f) => f.text)
      .join('\n\n');
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/blocks/execution-engine.test.ts --run
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/blocks/execution-engine.ts tests/blocks/execution-engine.test.ts
git commit -m "feat(blocks): add execution engine for traversing and executing block graphs"
```

---

### Task 8: Logic Block Definitions

**Files:**
- Modify: `src/lib/blocks/definitions.ts`

- [ ] **Step 1: Add logic block definitions**

Add to `src/lib/blocks/definitions.ts`:
```typescript
// If Block
const ifBlock: BlockDefinition = {
  type: 'IfBlock',
  category: 'logic',
  displayName: 'If',
  icon: '🔀',
  description: 'Conditional text inclusion',
  color: '#f38ba8',
  inputPorts: [
    { id: 'condition', name: 'Condition', type: 'boolean', required: true },
    { id: 'trueBranch', name: 'If True', type: 'text', required: false },
    { id: 'falseBranch', name: 'If False', type: 'text', required: false },
  ],
  outputPorts: [
    { id: 'result', name: 'Result', type: 'text', required: false },
  ],
  defaultConfig: {},
};

// Toggle Block
const toggleBlock: BlockDefinition = {
  type: 'ToggleBlock',
  category: 'logic',
  displayName: 'Toggle',
  icon: '⚙️',
  description: 'Reference a named toggle',
  color: '#cba6f7',
  inputPorts: [],
  outputPorts: [
    { id: 'value', name: 'Value', type: 'boolean', required: false },
  ],
  defaultConfig: {
    toggleId: '',
    scope: 'local',
    defaultValue: false,
  },
};

// Switch Block
const switchBlock: BlockDefinition = {
  type: 'SwitchBlock',
  category: 'logic',
  displayName: 'Switch',
  icon: '📦',
  description: 'Multiple conditional branches',
  color: '#eba0ac',
  inputPorts: [
    { id: 'variable', name: 'Variable', type: 'text', required: true },
  ],
  outputPorts: [
    { id: 'result', name: 'Result', type: 'text', required: false },
  ],
  defaultConfig: {
    cases: [],
    defaultCase: '',
  },
};

// Merge Block
const mergeBlock: BlockDefinition = {
  type: 'MergeBlock',
  category: 'logic',
  displayName: 'Merge',
  icon: '🔗',
  description: 'Combine multiple text inputs',
  color: '#94e2d5',
  inputPorts: [
    { id: 'input1', name: 'Input 1', type: 'text', required: false },
    { id: 'input2', name: 'Input 2', type: 'text', required: false },
    { id: 'input3', name: 'Input 3', type: 'text', required: false },
  ],
  outputPorts: [
    { id: 'combined', name: 'Combined', type: 'text', required: false },
  ],
  defaultConfig: {
    separator: '\n\n',
    filterEmpty: true,
  },
};

// Update register function
export function registerAllBlocks(): void {
  blockRegistry.register(textBlock);
  blockRegistry.register(fieldBlock);
  blockRegistry.register(memoryBlock);
  blockRegistry.register(lorebookBlock);
  blockRegistry.register(ifBlock);
  blockRegistry.register(toggleBlock);
  blockRegistry.register(switchBlock);
  blockRegistry.register(mergeBlock);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/blocks/definitions.ts
git commit -m "feat(blocks): add logic block definitions (If, Toggle, Switch, Merge)"
```

---

### Task 9: Real Block Executors

**Files:**
- Create: `src/lib/blocks/executors.ts`
- Modify: `src/lib/blocks/execution-engine.ts` (export concrete executor)

- [ ] **Step 1: Create block executors**

Create `src/lib/blocks/executors.ts`:
```typescript
/**
 * Concrete block executors
 */

import type {
  BlockType,
  BlockConfig,
  ExecutionContext,
  BlockExecutionResult,
  PortValue,
} from '$lib/types';

export async function executeBlock(
  blockType: BlockType,
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  switch (blockType) {
    case 'TextBlock':
      return executeTextBlock(config, context);
    case 'FieldBlock':
      return executeFieldBlock(config, context);
    case 'IfBlock':
      return executeIfBlock(config, inputs, context);
    case 'ToggleBlock':
      return executeToggleBlock(config, context);
    case 'MergeBlock':
      return executeMergeBlock(config, inputs, context);
    default:
      throw new Error(`No executor for block type: ${blockType}`);
  }
}

async function executeTextBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const content = (config.content as string) || '';
  const enabled = (config.enabled as boolean) ?? true;
  
  if (!enabled) {
    return {
      outputs: new Map([['text', '']]),
      fragments: [],
    };
  }

  // Simple variable substitution ({{char}}, {{user}}, etc.)
  let processedContent = content
    .replace(/\{\{char\}\}/g, context.characterId || 'Character')
    .replace(/\{\{user\}\}/g, 'User');

  return {
    outputs: new Map([['text', processedContent]]),
    fragments: [{
      text: processedContent,
      sourceBlockId: 'text-block',
      sourceBlockType: 'TextBlock',
    }],
  };
}

async function executeFieldBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const fieldType = (config.fieldType as string) || 'description';
  const fallback = (config.fallback as string) || '';
  
  // In real implementation, fetch from character store
  // For now, return fallback
  const content = fallback || `[${fieldType} field content]`;

  return {
    outputs: new Map([['text', content]]),
    fragments: [{
      text: content,
      sourceBlockId: 'field-block',
      sourceBlockType: 'FieldBlock',
    }],
  };
}

async function executeIfBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const condition = inputs.get('condition') as boolean;
  const trueBranch = inputs.get('trueBranch') as string;
  const falseBranch = inputs.get('falseBranch') as string;

  const result = condition ? (trueBranch || '') : (falseBranch || '');

  return {
    outputs: new Map([['result', result]]),
    fragments: result ? [{
      text: result,
      sourceBlockId: 'if-block',
      sourceBlockType: 'IfBlock',
      metadata: {
        isConditional: true,
        conditionResult: condition,
      },
    }] : [],
  };
}

async function executeToggleBlock(
  config: BlockConfig,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const toggleId = (config.toggleId as string) || '';
  const scope = (config.scope as string) || 'local';
  const defaultValue = (config.defaultValue as boolean) ?? false;

  // Resolve toggle value
  let value = defaultValue;
  if (toggleId) {
    // Check context toggles first (local overrides global)
    if (context.toggles.has(toggleId)) {
      value = context.toggles.get(toggleId)!;
    }
  }

  return {
    outputs: new Map([['value', value]]),
    fragments: [], // Toggle blocks don't produce text directly
  };
}

async function executeMergeBlock(
  config: BlockConfig,
  inputs: Map<string, PortValue>,
  context: ExecutionContext
): Promise<BlockExecutionResult> {
  const separator = (config.separator as string) || '\n\n';
  const filterEmpty = (config.filterEmpty as boolean) ?? true;

  const texts: string[] = [];
  for (const [key, value] of inputs) {
    if (typeof value === 'string' && (!filterEmpty || value.trim())) {
      texts.push(value);
    }
  }

  const combined = texts.join(separator);

  return {
    outputs: new Map([['combined', combined]]),
    fragments: combined ? [{
      text: combined,
      sourceBlockId: 'merge-block',
      sourceBlockType: 'MergeBlock',
    }] : [],
  };
}
```

- [ ] **Step 2: Export executor**

Modify `src/lib/blocks/execution-engine.ts` - add at end:
```typescript
// Export concrete executor
export { executeBlock } from './executors';
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/blocks/executors.ts src/lib/blocks/execution-engine.ts
git commit -m "feat(blocks): add concrete block executors for Text, Field, If, Toggle, Merge"
```

---

### Task 10: Live Preview Component

**Files:**
- Create: `src/lib/components/blocks/LivePreview.svelte`

- [ ] **Step 1: Implement preview component**

Create `src/lib/components/blocks/LivePreview.svelte`:
```svelte
<script lang="ts">
  import type { BlockGraph, ExecutionContext, PromptFragment } from '$lib/types';
  import { ExecutionEngine, executeBlock } from '$lib/blocks/execution-engine';

  interface Props {
    graph: BlockGraph;
    toggles?: Map<string, boolean>;
  }

  let { graph, toggles = new Map() }: Props = $props();

  let fragments: PromptFragment[] = $state([]);
  let output: string = $state('');
  let errors: string[] = $state([]);
  let isExecuting: boolean = $state(false);

  // Re-execute when graph or toggles change
  $effect(() => {
    executeGraph();
  });

  async function executeGraph() {
    if (isExecuting) return;
    isExecuting = true;

    try {
      const engine = new ExecutionEngine({ execute: executeBlock });
      const context: ExecutionContext = {
        variables: new Map(),
        toggles,
      };

      const result = await engine.execute(graph, context);
      fragments = result.fragments;
      output = result.output;
      errors = result.errors.map((e) => `${e.blockType}: ${e.message}`);
    } catch (e) {
      errors = [e instanceof Error ? e.message : 'Execution failed'];
    } finally {
      isExecuting = false;
    }
  }
</script>

<div class="flex flex-col h-full bg-surface1 rounded-lg p-4">
  <h3 class="text-sm font-semibold text-text mb-3">Live Preview</h3>

  {#if isExecuting}
    <div class="flex items-center justify-center py-8 text-subtext0">
      <div class="w-4 h-4 border-2 border-surface2 border-t-mauve rounded-full animate-spin mr-2"></div>
      Executing...
    </div>
  {:else if errors.length > 0}
    <div class="bg-red/10 border border-red/30 rounded-lg p-3 mb-3">
      <div class="text-red text-sm font-medium mb-1">Errors:</div>
      {#each errors as error}
        <div class="text-red/80 text-xs">{error}</div>
      {/each}
    </div>
  {/if}

  <div class="flex-1 bg-surface0 rounded-lg p-3 overflow-y-auto">
    <div class="text-xs text-subtext0 mb-2">Generated Output:</div>
    <pre class="text-sm text-text font-mono whitespace-pre-wrap">{output || '(No output)'}</pre>
  </div>

  {#if fragments.length > 0}
    <div class="mt-3 pt-3 border-t border-surface2">
      <div class="text-xs text-subtext0 mb-2">Fragment Breakdown:</div>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        {#each fragments as fragment, i}
          <div class="text-xs p-2 bg-surface0 rounded flex items-center gap-2">
            <span class="text-mauve font-mono">{i + 1}.</span>
            <span class="text-subtext1 truncate">{fragment.sourceBlockType}</span>
            <span class="text-text truncate flex-1">{fragment.text.slice(0, 50)}{fragment.text.length > 50 ? '...' : ''}</span>
            {#if fragment.metadata?.isConditional}
              <span class="text-xs px-1 py-0.5 bg-yellow/20 text-yellow rounded">
                {fragment.metadata.conditionResult ? '✓' : '✗'}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/blocks/LivePreview.svelte
git commit -m "feat(blocks): add live preview component with real-time execution"
```

---

### Task 11: Connection Lines Component

**Files:**
- Create: `src/lib/components/blocks/ConnectionLine.svelte`

- [ ] **Step 1: Implement connection line component**

Create `src/lib/components/blocks/ConnectionLine.svelte`:
```svelte
<script lang="ts">
  import type { Connection, BlockInstance } from '$lib/types';

  interface Props {
    connection: Connection;
    blocks: BlockInstance[];
    color?: string;
  }

  let { connection, blocks, color = '#a6e3a1' }: Props = $props();

  // Find source and target blocks
  const sourceBlock = $derived(blocks.find((b) => b.id === connection.from.blockId));
  const targetBlock = $derived(blocks.find((b) => b.id === connection.to.blockId));

  // Calculate connection points (simplified - assumes center of blocks)
  const sourceX = $derived((sourceBlock?.position.x || 0) + 110); // block width/2
  const sourceY = $derived((sourceBlock?.position.y || 0) + 30); // block height/2
  const targetX = $derived((targetBlock?.position.x || 0) - 10); // left edge
  const targetY = $derived((targetBlock?.position.y || 0) + 30); // block height/2

  // Bezier curve control points
  const controlOffset = $derived(50);
  const cp1x = $derived(sourceX + controlOffset);
  const cp1y = $derived(sourceY);
  const cp2x = $derived(targetX - controlOffset);
  const cp2y = $derived(targetY);

  const pathD = $derived(
    `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`
  );
</script>

{#if sourceBlock && targetBlock}
  <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 1;">
    <path
      d={pathD}
      stroke={color}
      stroke-width="2"
      fill="none"
      stroke-dasharray="0"
      opacity="0.8"
    />
    <!-- Arrow head -->
    <polygon
      points="{targetX},{targetY} {targetX - 8},{targetY - 4} {targetX - 8},{targetY + 4}"
      fill={color}
      opacity="0.8"
    />
  </svg>
{/if}
```

- [ ] **Step 2: Update canvas to show connections**

Modify `src/lib/components/blocks/BlockCanvas.svelte` - add imports and connection rendering:
```typescript
import ConnectionLine from './ConnectionLine.svelte';
```

Add inside the canvas div:
```svelte
<!-- Connection lines -->
{#each graph.connections as connection (connection.id)}
  <ConnectionLine {connection} blocks={graph.blocks} />
{/each}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/blocks/ConnectionLine.svelte src/lib/components/blocks/BlockCanvas.svelte
git commit -m "feat(blocks): add connection line rendering with bezier curves"
```

---

## Phase 2 Checkpoint

At this point you have:
- ✅ Execution engine for traversing block graphs
- ✅ Logic block definitions (If, Toggle, Switch, Merge)
- ✅ Concrete block executors
- ✅ Live preview with real-time execution
- ✅ Connection line rendering

**Next: Phase 3 - Advanced Blocks and Serialization**

---

## Phase 3: Advanced Blocks and Serialization

### Task 12: Serialization System

**Files:**
- Create: `src/lib/blocks/serialization.ts`
- Test: `tests/blocks/serialization.test.ts`

- [ ] **Step 1: Write test**

Create `tests/blocks/serialization.test.ts`:
```typescript
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
```

- [ ] **Step 2: Implement serialization**

Create `src/lib/blocks/serialization.ts`:
```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/blocks/serialization.test.ts --run
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/blocks/serialization.ts tests/blocks/serialization.test.ts
git commit -m "feat(blocks): add serialization system for .tfrag, .tchunk, .tprompt formats"
```

---

### Task 13: Preset Migration Utilities

**Files:**
- Create: `src/lib/blocks/preset-migration.ts`
- Test: `tests/blocks/preset-migration.test.ts`

- [ ] **Step 1: Write test**

Create `tests/blocks/preset-migration.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { presetToBlocks, blocksToPreset } from '$lib/blocks/preset-migration';
import type { PromptPreset, PromptItem } from '$lib/types';

describe('Preset Migration', () => {
  const samplePreset: PromptPreset = {
    id: 'test-preset',
    name: 'Test Preset',
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
```

- [ ] **Step 2: Implement migration**

Create `src/lib/blocks/preset-migration.ts`:
```typescript
/**
 * Preset ↔ Block migration utilities
 */

import type { PromptPreset, PromptItem, BlockGraph, BlockInstance, Connection } from '$lib/types';

export function presetToBlocks(preset: PromptPreset): BlockGraph {
  const blocks: BlockInstance[] = [];
  const connections: Connection[] = [];
  let yOffset = 50;

  for (const item of preset.items) {
    if (!item.enabled) continue;

    const block = promptItemToBlock(item, yOffset);
    if (block) {
      blocks.push(block);
      yOffset += 100;
    }
  }

  // Connect blocks in sequence
  for (let i = 0; i < blocks.length - 1; i++) {
    connections.push({
      id: `conn-${i}`,
      from: { blockId: blocks[i].id, portId: 'text' },
      to: { blockId: blocks[i + 1].id, portId: 'input' },
    });
  }

  return {
    version: '1.0',
    blocks,
    connections,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function promptItemToBlock(item: PromptItem, y: number): BlockInstance | null {
  const base = {
    id: `preset-${item.id}`,
    position: { x: 100, y },
  };

  switch (item.type) {
    case 'system':
    case 'jailbreak':
    case 'personality':
    case 'scenario':
      return {
        ...base,
        type: 'TextBlock',
        config: {
          content: item.content,
          enabled: item.enabled,
        },
      };

    case 'description':
      return {
        ...base,
        type: 'FieldBlock',
        config: {
          fieldType: 'description',
          fallback: item.content,
        },
      };

    case 'lorebook':
      return {
        ...base,
        type: 'LorebookBlock',
        config: {
          activationMode: 'keyword',
          maxEntries: 5,
        },
      };

    case 'chatHistory':
      // Chat history isn't a block - it's handled by chat system
      return null;

    default:
      // Unknown types become text blocks
      return {
        ...base,
        type: 'TextBlock',
        config: {
          content: item.content || '',
          enabled: item.enabled,
        },
      };
  }
}

export function blocksToPreset(
  graph: BlockGraph,
  toggles: Map<string, boolean>
): PromptPreset {
  const items: PromptItem[] = [];
  let order = 0;

  // Sort blocks by Y position (top to bottom)
  const sortedBlocks = [...graph.blocks].sort((a, b) => a.position.y - b.position.y);

  for (const block of sortedBlocks) {
    const item = blockToPromptItem(block, order);
    if (item) {
      items.push(item);
      order++;
    }
  }

  return {
    id: 'migrated',
    name: 'Migrated from Blocks',
    items,
  };
}

function blockToPromptItem(block: BlockInstance, order: number): PromptItem | null {
  const base = {
    id: `block-${block.id}`,
    name: block.type,
    enabled: block.config.enabled ?? true,
    role: 'system' as const,
  };

  switch (block.type) {
    case 'TextBlock':
      return {
        ...base,
        type: 'plain' as const,
        content: (block.config.content as string) || '',
      };

    case 'FieldBlock':
      return {
        ...base,
        type: (block.config.fieldType as string) || 'description',
        content: (block.config.fallback as string) || '',
      };

    case 'MemoryBlock':
    case 'LorebookBlock':
      // These map to lorebook type
      return {
        ...base,
        type: 'lorebook' as const,
        content: '',
      };

    case 'IfBlock':
    case 'ToggleBlock':
      // Logic blocks don't directly map - include their text output
      return {
        ...base,
        type: 'plain' as const,
        content: '[Conditional content based on toggle]',
      };

    default:
      return null;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/blocks/preset-migration.test.ts --run
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/blocks/preset-migration.ts tests/blocks/preset-migration.test.ts
git commit -m "feat(blocks): add preset migration utilities for round-trip conversion"
```

---

## Phase 4: UI Integration and Polish

### Task 14: Integrate Block Builder into Settings Page

**Files:**
- Modify: `src/routes/settings/prompt-builder/+page.svelte`

- [ ] **Step 1: Create integrated page**

Create new version of the settings page that includes both preset and block builder views (existing file will be modified):

The page should have:
- Tab switcher: "Classic Presets" | "Block Builder"
- In Block Builder tab: Canvas + Palette + Live Preview layout
- Save/Export buttons

Since this is a significant modification, here's the key integration:

```svelte
<script lang="ts">
  // Add to existing imports
  import BlockCanvas from '$lib/components/blocks/BlockCanvas.svelte';
  import BlockPalette from '$lib/components/blocks/BlockPalette.svelte';
  import LivePreview from '$lib/components/blocks/LivePreview.svelte';
  import { blockBuilderStore, createEmptyGraph } from '$lib/stores/block-builder';
  import { registerAllBlocks } from '$lib/blocks/registry';
  import { presetToBlocks } from '$lib/blocks/preset-migration';

  // Initialize blocks on mount
  registerAllBlocks();

  let activeView: 'presets' | 'blocks' = $state('presets');
  let builderState = $state($blockBuilderStore);

  // Convert current preset to blocks when switching views
  function switchToBlocks() {
    const currentPreset = $promptPresetStore.presets.find((p) => p.id === $promptPresetStore.activePresetId);
    if (currentPreset) {
      const graph = presetToBlocks(currentPreset);
      blockBuilderStore.setGraph(graph);
    }
    activeView = 'blocks';
  }
</script>

<!-- Add tab switcher at top -->
<div class="flex gap-2 mb-4">
  <button
    class="px-4 py-2 rounded-lg font-medium transition-colors"
    class:bg-mauve={activeView === 'presets'}
    class:text-crust={activeView === 'presets'}
    class:bg-surface0={activeView !== 'presets'}
    class:text-text={activeView !== 'presets'}
    onclick={() => activeView = 'presets'}
  >
    Classic Presets
  </button>
  <button
    class="px-4 py-2 rounded-lg font-medium transition-colors"
    class:bg-mauve={activeView === 'blocks'}
    class:text-crust={activeView === 'blocks'}
    class:bg-surface0={activeView !== 'blocks'}
    class:text-text={activeView !== 'blocks'}
    onclick={switchToBlocks}
  >
    Block Builder (Beta)
  </button>
</div>

{#if activeView === 'presets'}
  <!-- Existing preset UI -->
{:else}
  <!-- Block Builder UI -->
  <div class="flex gap-4 h-[600px]">
    <BlockPalette />
    <div class="flex-1 flex gap-4">
      <div class="flex-1">
        <BlockCanvas
          graph={builderState.currentGraph}
          onBlockMove={(id, pos) => blockBuilderStore.updateBlockPosition(id, pos)}
        />
      </div>
      <div class="w-80">
        <LivePreview graph={builderState.currentGraph} />
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/settings/prompt-builder/+page.svelte
git commit -m "feat(blocks): integrate block builder into prompt builder settings page"
```

---

### Task 15: Final Integration and Documentation

**Files:**
- Modify: `src/lib/blocks/index.ts` (exports)
- Create: `docs/blocks/README.md` (usage guide)

- [ ] **Step 1: Create exports file**

Create `src/lib/blocks/index.ts`:
```typescript
/**
 * Block-based prompt builder - public API
 */

// Registry
export { BlockRegistry, blockRegistry } from './registry';
export { registerAllBlocks } from './definitions';

// Execution
export { ExecutionEngine } from './execution-engine';
export { executeBlock } from './executors';

// Serialization
export {
  exportToTPrompt,
  importFromTPrompt,
  exportToTChunk,
  importFromTChunk,
  exportToTFrag,
  importFromTFrag,
  downloadAsJSON,
} from './serialization';

// Migration
export { presetToBlocks, blocksToPreset } from './preset-migration';
```

- [ ] **Step 2: Create usage documentation**

Create `docs/blocks/README.md`:
```markdown
# Block-Based Prompt Builder

## Overview

The Block-Based Prompt Builder provides a visual, Scratch-like interface for creating dynamic prompts with conditional logic. It replaces RisuAI's CBS syntax with intuitive drag-and-drop blocks.

## Quick Start

1. Open Settings → Prompt Builder → Block Builder (Beta)
2. Drag blocks from the palette onto the canvas
3. Connect blocks by dragging from output ports to input ports
4. See live preview update as you build
5. Save as `.tprompt` file or export to preset

## Block Types

### Foundation
- **Text Block**: Static text with `{{variable}}` support
- **Field Block**: Links to character card fields (jailbreak, description, etc.)
- **Memory Block**: Retrieves memories based on similarity
- **Lorebook Block**: Injects lorebook entries

### Logic (CBS Replacement)
- **If Block**: Conditional text inclusion with true/false branches
- **Toggle Block**: Reference named toggles (global or local)
- **Switch Block**: Multiple case branches
- **Merge Block**: Combine multiple text inputs

### Data
- **Variable Block**: Define custom variables
- **Loop Block**: Iterate over lists
- **Agent Block**: Call agents and inject results

## File Formats

- **.tprompt**: Complete prompt with all blocks and connections
- **.tchunk**: Reusable block cluster
- **.tfrag**: Single block for sharing

## Migration from Presets

Existing presets can be converted to blocks:
1. Open preset in Classic view
2. Click "Open in Block Builder"
3. Preset items become connected blocks
4. Add logic blocks to create conditional content
5. Save as new preset or export as .tprompt
```

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --run
```

Expected: All tests pass

- [ ] **Step 4: Final commit**

```bash
git add src/lib/blocks/index.ts docs/blocks/README.md
git commit -m "feat(blocks): finalize block builder with exports and documentation"
```

---

## Plan Completion Checklist

**Phase 1: Foundation** ✅
- Core types and interfaces
- Block registry
- Foundation block definitions
- Canvas component
- Block palette
- State store

**Phase 2: Logic** ✅
- Execution engine
- Logic block definitions
- Real executors
- Live preview
- Connection rendering

**Phase 3: Advanced** ✅
- Serialization (.tfrag, .tchunk, .tprompt)
- Preset migration

**Phase 4: Integration** ✅
- Settings page integration
- Exports and documentation

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-15-block-based-prompt-builder.md`**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach would you like?**

Also: Should I proceed with implementing this plan now, or do you want to review any specific tasks first?
