# Block Builder Phase 2: Connections & Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add port-based connections, block editing on double-click, and toggle panel to the block builder.

**Architecture:** Port components on BlockNode, SVG connection layer, editor integration via double-click, toggle management in right panel.

**Tech Stack:** Svelte 5, SVG for connections, existing block definitions and editors

---

## File Structure

```
src/lib/components/blocks/
├── BlockBuilder.svelte      # MODIFY: Add toggle panel
├── BlockCanvas.svelte       # MODIFY: Add connection layer, double-click
├── BlockNode.svelte         # MODIFY: Add ports with click-to-connect
├── BlockPreview.svelte      # MODIFY: Show toggle status
├── ConnectionLayer.svelte   # MODIFY: Render SVG connections
├── Port.svelte              # EXISTS: Already implemented in Phase 1 (old)
├── TogglePanel.svelte       # NEW: Toggle management UI
├── editors/
│   └── TextBlockEditor.svelte  # EXISTS: Will be used for editing

src/lib/stores/
├── block-builder.ts         # MODIFY: Add toggle state
└── connection-drag.ts       # NEW: Connection drag state

src/lib/types/
└── blocks.ts                # VERIFY: Connection type exists
```

---

## Phase 2 Tasks

### Task 1: Add Ports to BlockNode

**Files:**
- Modify: `src/lib/components/blocks/BlockNode.svelte`
- Create: `tests/components/blocks/BlockNode.ports.test.ts`

**Decision:** MODIFY - Add port rendering to existing BlockNode

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';
import type { BlockInstance } from '$lib/types';

describe('BlockNode with ports', () => {
  it('renders input and output ports', () => {
    const block: BlockInstance = {
      id: 'test-1',
      type: 'TextBlock', // Has 1 output port
      position: { x: 0, y: 0 },
      config: { content: 'Test', enabled: true }
    };
    
    const { container } = render(BlockNode, {
      props: { block, isSelected: false, onPortClick: () => {} }
    });
    
    // TextBlock has output port 'text'
    const outputPort = container.querySelector('[data-port-id="text"]');
    expect(outputPort).toBeTruthy();
  });
});
```

- [ ] **Step 2: Add port props to BlockNode**

Add to BlockNode.svelte Props interface:
```typescript
interface Props {
  block: BlockInstance;
  isSelected: boolean;
  onPortClick?: (portId: string, isInput: boolean, e: MouseEvent) => void;
  connectedPorts?: Set<string>;  // Set of "blockId-portId" strings
}
```

- [ ] **Step 3: Add port rendering in body**

Add ports section after content in BlockNode.svelte:
```svelte
<!-- Ports -->
<div class="ports-row relative h-6 mt-2">
  <!-- Output ports (right side) -->
  {#each definition?.outputPorts || [] as port}
    <button
      data-port-id={port.id}
      data-port-type={port.type}
      class="port output absolute w-4 h-4 rounded-full border-2 border-surface1 cursor-pointer
             hover:scale-110 transition-transform"
      style="right: -8px; top: 50%; transform: translateY(-50%);
             background: {port.type === 'text' ? '#a6e3a1' : port.type === 'boolean' ? '#cba6f7' : '#89b4fa'};"
      onclick={(e) => {
        e.stopPropagation();
        onPortClick?.(port.id, false, e);
      }}
      title="{port.name} (output)"
    ></button>
  {/each}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/blocks/BlockNode.svelte tests/components/blocks/BlockNode.ports.test.ts
git commit -m "feat(blocks): add output ports to BlockNode"
```

---

### Task 2: Create Connection Drag Store

**Files:**
- Create: `src/lib/stores/connection-drag.ts`
- Create: `tests/stores/connection-drag.test.ts`

**Decision:** CREATE - New store for managing connection drag state

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { connectionDragStore } from '$lib/stores/connection-drag';

describe('connectionDragStore', () => {
  it('tracks drag state', () => {
    expect($connectionDragStore.isDragging).toBe(false);
    
    connectionDragStore.startDrag('block-1', 'output', { x: 100, y: 100 });
    expect($connectionDragStore.isDragging).toBe(true);
    expect($connectionDragStore.fromBlockId).toBe('block-1');
  });
});
```

- [ ] **Step 2: Create connection drag store**

```typescript
// src/lib/stores/connection-drag.ts
import { writable } from 'svelte/store';

interface ConnectionDragState {
  isDragging: boolean;
  fromBlockId: string | null;
  fromPortId: string | null;
  isInput: boolean;
  mouseX: number;
  mouseY: number;
}

function createConnectionDragStore() {
  const { subscribe, set, update } = writable<ConnectionDragState>({
    isDragging: false,
    fromBlockId: null,
    fromPortId: null,
    isInput: false,
    mouseX: 0,
    mouseY: 0,
  });

  return {
    subscribe,
    
    startDrag: (blockId: string, portId: string, isInput: boolean, x: number, y: number) => {
      set({
        isDragging: true,
        fromBlockId: blockId,
        fromPortId: portId,
        isInput,
        mouseX: x,
        mouseY: y,
      });
    },
    
    updateMouse: (x: number, y: number) => {
      update(s => ({ ...s, mouseX: x, mouseY: y }));
    },
    
    endDrag: () => {
      set({
        isDragging: false,
        fromBlockId: null,
        fromPortId: null,
        isInput: false,
        mouseX: 0,
        mouseY: 0,
      });
    },
  };
}

export const connectionDragStore = createConnectionDragStore();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/connection-drag.ts tests/stores/connection-drag.test.ts
git commit -m "feat(blocks): add connection drag store"
```

---

### Task 3: Integrate Connection Layer in Canvas

**Files:**
- Modify: `src/lib/components/blocks/BlockCanvas.svelte`
- Modify: `src/lib/components/blocks/ConnectionLayer.svelte`

**Decision:** MODIFY - Add connection layer and drag handling

- [ ] **Step 1: Update ConnectionLayer to use absolute positions**

ConnectionLayer.svelte already exists. Update it to work with direct positioning:
```svelte
<script lang="ts">
  import type { Connection, BlockInstance } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';

  interface Props {
    connections: Connection[];
    blocks: BlockInstance[];
    livePreview: { fromBlockId: string; fromPortId: string; mouseX: number; mouseY: number } | null;
  }

  let { connections, blocks, livePreview }: Props = $props();

  function getPortPosition(blockId: string, portId: string): { x: number; y: number } | null {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return null;
    
    // Port is at right edge of block (208px width) + offset
    return {
      x: block.position.x + 200, // Right edge
      y: block.position.y + 50,  // Middle of body
    };
  }
</script>

<svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 5;">
  {#each connections as conn}
    {@const from = getPortPosition(conn.from.blockId, conn.from.portId)}
    {@const to = getPortPosition(conn.to.blockId, conn.to.portId)}
    
    {#if from && to}
      <path
        d="M {from.x} {from.y} C {from.x + 50} {from.y}, {to.x - 50} {to.y}, {to.x} {to.y}"
        stroke="#a6e3a1"
        stroke-width="2"
        fill="none"
      />
    {/if}
  {/each}

  {#if livePreview}
    {@const from = getPortPosition(livePreview.fromBlockId, livePreview.fromPortId)}
    {#if from}
      <line
        x1={from.x}
        y1={from.y}
        x2={livePreview.mouseX}
        y2={livePreview.mouseY}
        stroke="#cba6f7"
        stroke-width="2"
        stroke-dasharray="5,3"
      />
    {/if}
  {/if}
</svg>
```

- [ ] **Step 2: Add ConnectionLayer to BlockCanvas**

In BlockCanvas.svelte, add:
```svelte
<!-- Connection Layer -->
<ConnectionLayer 
  connections={graph.connections}
  blocks={graph.blocks}
  livePreview={$connectionDragStore.isDragging ? {
    fromBlockId: $connectionDragStore.fromBlockId!,
    fromPortId: $connectionDragStore.fromPortId!,
    mouseX: $connectionDragStore.mouseX,
    mouseY: $connectionDragStore.mouseY,
  } : null}
/>

<!-- Blocks -->
{#each graph.blocks as block (block.id)}
  ...
{/each}
```

- [ ] **Step 3: Add port click handling**

```typescript
// In BlockCanvas.svelte
import { connectionDragStore } from '$lib/stores/connection-drag';

function handlePortClick(blockId: string, portId: string, isInput: boolean, e: MouseEvent) {
  if (!isInput) {
    // Starting a connection from output port
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    connectionDragStore.startDrag(blockId, portId, isInput, 
      rect.left + rect.width / 2, 
      rect.top + rect.height / 2
    );
  }
}

function handleCanvasMouseMove(e: MouseEvent) {
  if ($connectionDragStore.isDragging) {
    connectionDragStore.updateMouse(e.clientX, e.clientY);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/blocks/BlockCanvas.svelte src/lib/components/blocks/ConnectionLayer.svelte
git commit -m "feat(blocks): integrate connection layer with drag preview"
```

---

### Task 4: Add Double-Click Editing

**Files:**
- Modify: `src/lib/components/blocks/BlockCanvas.svelte`
- Modify: `src/lib/components/blocks/BlockBuilder.svelte`

**Decision:** MODIFY - Add double-click to open editor

- [ ] **Step 1: Add editor state to BlockBuilder**

```typescript
// In BlockBuilder.svelte
let editingBlock: BlockInstance | null = $state(null);

function handleBlockDoubleClick(blockId: string) {
  const block = graph.blocks.find(b => b.id === blockId);
  if (block) {
    editingBlock = block;
  }
}

function handleEditorClose() {
  editingBlock = null;
}

function handleEditorSave(blockId: string, config: Record<string, unknown>) {
  onBlockConfigChange?.(blockId, config);
  editingBlock = null;
}
```

- [ ] **Step 2: Add editor overlay**

```svelte
<!-- In BlockBuilder.svelte, after the grid -->
{#if editingBlock}
  <div class="absolute inset-0 bg-crust/80 z-50 flex items-center justify-center">
    <div class="bg-surface1 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-text">Edit {editingBlock.type}</h3>
        <button 
          class="text-subtext0 hover:text-text"
          onclick={handleEditorClose}
        >✕</button>
      </div>
      
      {#if editingBlock.type === 'TextBlock'}
        <TextBlockEditor 
          config={editingBlock.config}
          onChange={(config) => handleEditorSave(editingBlock.id, config)}
        />
      {:else}
        <p class="text-subtext0">No editor for this block type</p>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Wire double-click from canvas**

BlockCanvas already has `onBlockDoubleClick`. Ensure it's passed through.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/blocks/BlockBuilder.svelte src/lib/components/blocks/BlockCanvas.svelte
git commit -m "feat(blocks): add double-click editing with overlay"
```

---

### Task 5: Create Toggle Panel

**Files:**
- Create: `src/lib/components/blocks/TogglePanel.svelte`
- Modify: `src/lib/stores/block-builder.ts`

**Decision:** CREATE - New panel for managing toggles

- [ ] **Step 1: Add toggle state to block-builder store**

```typescript
// Add to BlockBuilderState in block-builder.ts
toggles: Map<string, boolean>;

// Add methods
setToggle: (id: string, value: boolean) => {
  update(state => {
    const toggles = new Map(state.toggles);
    toggles.set(id, value);
    return { ...state, toggles };
  });
},

addToggle: (id: string, name: string) => {
  update(state => {
    const toggles = new Map(state.toggles);
    toggles.set(id, false);
    return { ...state, toggles };
  });
},
```

- [ ] **Step 2: Create TogglePanel component**

```svelte
<script lang="ts">
  import { blockBuilderStore } from '$lib/stores/block-builder';

  const toggles = $derived($blockBuilderStore.toggles);

  function handleToggle(id: string, value: boolean) {
    blockBuilderStore.setToggle(id, value);
  }

  function handleAddToggle() {
    const id = crypto.randomUUID();
    const name = `Toggle ${toggles.size + 1}`;
    blockBuilderStore.addToggle(id, name);
  }
</script>

<div class="toggle-panel bg-surface1 rounded-lg p-3">
  <h4 class="text-sm font-semibold text-text mb-3">Active Toggles</h4>

  <div class="space-y-2">
    {#each [...toggles.entries()] as [id, value]}
      <div class="flex items-center justify-between p-2 bg-surface0 rounded">
        <span class="text-sm text-text">🔘 Toggle</span>
        <button
          class="w-9 h-5 rounded-full transition-colors"
          style="background: {value ? '#a6e3a1' : '#45475a'};"
          onclick={() => handleToggle(id, !value)}
        >
          <div 
            class="w-4 h-4 bg-white rounded-full transition-transform"
            style="transform: translateX({value ? '14px' : '2px'});"
          ></div>
        </button>
      </div>
    {/each}
  </div>

  <button
    class="w-full mt-3 p-2 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
    onclick={handleAddToggle}
  >
    + Add Toggle
  </button>
</div>
```

- [ ] **Step 3: Add to BlockBuilder**

```svelte
<!-- In BlockBuilder grid, add TogglePanel below BlockPreview -->
<div class="flex flex-col gap-4">
  <BlockPreview {graph} />
  <TogglePanel />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/blocks/TogglePanel.svelte src/lib/stores/block-builder.ts
git commit -m "feat(blocks): add toggle panel for managing toggle states"
```

---

### Task 6: Complete Connection Creation

**Files:**
- Modify: `src/lib/components/blocks/BlockCanvas.svelte`
- Modify: `src/lib/stores/block-builder.ts`

**Decision:** MODIFY - Complete the connection flow (click output → click input)

- [ ] **Step 1: Handle connection completion**

When clicking an input port while dragging:
```typescript
function handlePortClick(blockId: string, portId: string, isInput: boolean, e: MouseEvent) {
  if ($connectionDragStore.isDragging && isInput) {
    // Complete connection
    const conn: Connection = {
      id: crypto.randomUUID(),
      from: { 
        blockId: $connectionDragStore.fromBlockId!, 
        portId: $connectionDragStore.fromPortId! 
      },
      to: { blockId, portId },
    };
    blockBuilderStore.addConnection(conn);
    connectionDragStore.endDrag();
  } else if (!isInput) {
    // Start drag
    connectionDragStore.startDrag(blockId, portId, isInput, e.clientX, e.clientY);
  }
}
```

- [ ] **Step 2: Add addConnection to store**

Already exists in block-builder.ts. Verify it works.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/blocks/BlockCanvas.svelte
git commit -m "feat(blocks): complete connection creation flow"
```

---

## Plan Summary

**Phase 2 Tasks (6 total):**

| Task | Feature | Priority |
|------|---------|----------|
| **1** | Add ports to BlockNode | High |
| **2** | Create connection drag store | High |
| **3** | Integrate connection layer | High |
| **4** | Add double-click editing | Medium |
| **5** | Create toggle panel | Medium |
| **6** | Complete connection creation | High |

**Deliverable after Phase 2:**
- ✅ Ports on blocks (click to start connection)
- ✅ Drag from output port to input port
- ✅ SVG connections rendered
- ✅ Double-click opens block editor
- ✅ Toggle panel with add/switch toggles

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-block-builder-phase2.md`**

**Execution: Subagent-Driven Development** (proceeding automatically)
