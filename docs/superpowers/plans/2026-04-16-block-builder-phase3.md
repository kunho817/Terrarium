# Block Builder Phase 3: ComfyUI-Style Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Block Builder from a fixed 3-column layout to a full-screen canvas with zoom/pan navigation, minimap, collapsible nodes, context menu, and enhanced preview panel with token count.

**Architecture:** Full-screen canvas with floating/dockable panels, viewport-based coordinate system using offset+scale transform, minimap for navigation overview.

**Tech Stack:** Svelte 5, Tailwind CSS, SVG for minimap and connections

---

## File Structure

```
src/lib/components/blocks/
├── BlockBuilder.svelte      # REBUILD: Full-screen layout
├── BlockCanvas.svelte       # REBUILD: Viewport transform, zoom/pan
├── BlockNode.svelte         # MODIFY: Add collapse button
├── BlockPreview.svelte      # MODIFY: Add token count
├── ConnectionLayer.svelte   # MODIFY: Large SVG for viewport
├── Minimap.svelte           # NEW: Scaled graph overview
├── ContextMenu.svelte       # NEW: Right-click actions
├── Toolbar.svelte           # MODIFY: Zoom controls

src/lib/stores/
├── block-builder.ts         # MODIFY: Add setBlockCollapsed method
└── viewport.ts              # REBUILD: Offset+scale approach

src/lib/utils/
└── tokenizer.ts             # NEW: Token counting

tests/
├── stores/viewport.test.ts          # NEW
├── utils/tokenizer.test.ts          # NEW
└── components/blocks/
    ├── Minimap.test.ts              # NEW
    ├── ContextMenu.test.ts          # NEW
    └── BlockNode.collapse.test.ts   # NEW
```

---

## Phase 3 Tasks (8 total)

### Task 1: Rebuild Viewport Store

**Files:**
- Rebuild: `src/lib/stores/viewport.ts`
- Create: `tests/stores/viewport.test.ts`

**Decision:** REBUILD - Use offset+scale approach (simpler for CSS transform) instead of camera center approach

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { viewportStore } from '$lib/stores/viewport';
import { get } from 'svelte/store';

describe('viewportStore', () => {
  it('has default state', () => {
    const state = get(viewportStore);
    expect(state.scale).toBe(1.0);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('zooms centered on a point', () => {
    viewportStore.reset();
    viewportStore.zoomAt(100, 100, 0.1); // 10% zoom in
    
    const state = get(viewportStore);
    expect(state.scale).toBeCloseTo(1.1, 2);
    // Offset should shift so point (100,100) stays at same screen position
  });

  it('pans by screen delta', () => {
    viewportStore.reset();
    viewportStore.pan(50, 30);
    
    const state = get(viewportStore);
    expect(state.offsetX).toBe(50);
    expect(state.offsetY).toBe(30);
  });

  it('clamps scale between 0.25 and 2.0', () => {
    viewportStore.reset();
    viewportStore.zoomAt(0, 0, 10); // Try to zoom way in
    expect(get(viewportStore).scale).toBe(2.0);
    
    viewportStore.reset();
    viewportStore.zoomAt(0, 0, -10); // Try to zoom way out
    expect(get(viewportStore).scale).toBe(0.25);
  });

  it('converts coordinates', () => {
    viewportStore.reset();
    
    // Canvas (100, 100) -> Screen at scale 1.0, offset 0 = (100, 100)
    let screen = viewportStore.canvasToScreen(100, 100);
    expect(screen.x).toBe(100);
    expect(screen.y).toBe(100);
    
    // Now pan
    viewportStore.pan(50, 25);
    screen = viewportStore.canvasToScreen(100, 100);
    expect(screen.x).toBe(150);
    expect(screen.y).toBe(125);
    
    // And zoom
    viewportStore.zoomAt(0, 0, 0.5); // scale becomes 1.5
    screen = viewportStore.canvasToScreen(100, 100);
    expect(screen.x).toBeCloseTo(200, 0); // (100 + 50) * 1.5 = 225... wait let me recalculate
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/stores/viewport.test.ts`
Expected: FAIL - Methods don't exist yet

- [ ] **Step 3: Rebuild viewport store with offset+scale**

```typescript
// src/lib/stores/viewport.ts
import { writable, get } from 'svelte/store';

export interface ViewportState {
  scale: number;      // Zoom level: 0.25 to 2.0
  offsetX: number;    // Pan offset in screen pixels
  offsetY: number;
}

const DEFAULT_STATE: ViewportState = {
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.0;

function createViewportStore() {
  const { subscribe, set, update } = writable<ViewportState>(DEFAULT_STATE);

  return {
    subscribe,
    
    reset: () => set(DEFAULT_STATE),
    
    setScale: (scale: number) => {
      update(s => ({ ...s, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) }));
    },
    
    setOffset: (offsetX: number, offsetY: number) => {
      update(s => ({ ...s, offsetX, offsetY }));
    },
    
    /**
     * Zoom centered on a screen point.
     * delta: positive = zoom in, negative = zoom out
     */
    zoomAt: (screenX: number, screenY: number, delta: number) => {
      update(state => {
        const oldScale = state.scale;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale + delta));
        
        if (newScale === oldScale) return state;
        
        // Calculate the canvas point under the cursor before zoom
        const canvasX = (screenX - state.offsetX) / oldScale;
        const canvasY = (screenY - state.offsetY) / oldScale;
        
        // Adjust offset so that canvas point stays under cursor after zoom
        const newOffsetX = screenX - canvasX * newScale;
        const newOffsetY = screenY - canvasY * newScale;
        
        return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
      });
    },
    
    /**
     * Pan by screen pixel delta.
     */
    pan: (deltaX: number, deltaY: number) => {
      update(s => ({
        ...s,
        offsetX: s.offsetX + deltaX,
        offsetY: s.offsetY + deltaY,
      }));
    },
    
    /**
     * Zoom in by fixed increment.
     */
    zoomIn: () => {
      const state = get({ subscribe });
      // Zoom at center of current view
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      // @ts-ignore - we're calling the method
      createViewportStore().zoomAt(centerX, centerY, 0.1);
    },
    
    /**
     * Zoom out by fixed increment.
     */
    zoomOut: () => {
      const state = get({ subscribe });
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      // @ts-ignore
      createViewportStore().zoomAt(centerX, centerY, -0.1);
    },
    
    /**
     * Convert canvas coordinates to screen coordinates.
     */
    canvasToScreen: (canvasX: number, canvasY: number) => {
      const state = get({ subscribe });
      return {
        x: canvasX * state.scale + state.offsetX,
        y: canvasY * state.scale + state.offsetY,
      };
    },
    
    /**
     * Convert screen coordinates to canvas coordinates.
     */
    screenToCanvas: (screenX: number, screenY: number) => {
      const state = get({ subscribe });
      return {
        x: (screenX - state.offsetX) / state.scale,
        y: (screenY - state.offsetY) / state.scale,
      };
    },
    
    /**
     * Fit all blocks in view.
     */
    fitToContent: (
      blocks: Array<{ position: { x: number; y: number } }>,
      containerWidth: number,
      containerHeight: number,
      padding: number = 50
    ) => {
      if (blocks.length === 0) {
        set({ scale: 1.0, offsetX: containerWidth / 2, offsetY: containerHeight / 2 });
        return;
      }
      
      // Calculate bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const block of blocks) {
        minX = Math.min(minX, block.position.x);
        minY = Math.min(minY, block.position.y);
        maxX = Math.max(maxX, block.position.x + 208); // Block width
        maxY = Math.max(maxY, block.position.y + 100); // Approximate block height
      }
      
      const contentWidth = maxX - minX + padding * 2;
      const contentHeight = maxY - minY + padding * 2;
      
      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const scale = Math.min(scaleX, scaleY, MAX_SCALE);
      
      // Center on content
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      set({
        scale,
        offsetX: containerWidth / 2 - centerX * scale,
        offsetY: containerHeight / 2 - centerY * scale,
      });
    },
  };
}

export const viewportStore = createViewportStore();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/stores/viewport.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/viewport.ts tests/stores/viewport.test.ts
git commit -m "refactor(blocks): rebuild viewport store with offset+scale approach"
```

---

### Task 2: Create Tokenizer Utility

**Files:**
- Create: `src/lib/utils/tokenizer.ts`
- Create: `tests/utils/tokenizer.test.ts`

**Decision:** CREATE - Simple token counting for preview

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { countTokens, countTokensAccurate } from '$lib/utils/tokenizer';

describe('tokenizer', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
    expect(countTokens('   ')).toBe(0);
  });

  it('counts tokens approximately by character count', () => {
    // "Hello" = 5 chars ~ 1-2 tokens
    expect(countTokens('Hello')).toBeGreaterThanOrEqual(1);
    
    // 40 chars ~ 10 tokens
    expect(countTokens('a'.repeat(40))).toBe(10);
  });

  it('normalizes whitespace', () => {
    const result1 = countTokens('hello world');
    const result2 = countTokens('hello    world');
    expect(result1).toBe(result2);
  });

  it('countTokensAccurate uses word boundaries', () => {
    expect(countTokensAccurate('Hello, world!')).toBe(3); // 2 words + 2 punctuation/2
    expect(countTokensAccurate('The quick brown fox')).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils/tokenizer.test.ts`
Expected: FAIL - Module not found

- [ ] **Step 3: Create tokenizer utility**

```typescript
// src/lib/utils/tokenizer.ts

/**
 * Simple whitespace-based tokenizer for approximate token count.
 * For more accurate counting, integrate tiktoken or similar.
 * 
 * Rule of thumb: ~4 characters per token for English text.
 */
export function countTokens(text: string): number {
  if (!text.trim()) return 0;
  
  // Remove extra whitespace
  const normalized = text.trim().replace(/\s+/g, ' ');
  
  // Approximate: 1 token per 4 characters, minimum 1
  return Math.max(1, Math.ceil(normalized.length / 4));
}

/**
 * More accurate tokenization using word boundaries.
 * Still approximate but closer to real tokenizers.
 */
export function countTokensAccurate(text: string): number {
  if (!text.trim()) return 0;
  
  // Split on word boundaries
  const words = text.match(/\b\w+\b/g) || [];
  const punctuation = text.match(/[^\w\s]/g) || [];
  
  // Words typically = 1 token each
  // Punctuation often merges with adjacent tokens
  return words.length + Math.ceil(punctuation.length / 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils/tokenizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/tokenizer.ts tests/utils/tokenizer.test.ts
git commit -m "feat(blocks): add tokenizer utility for token counting"
```

---

### Task 3: Rebuild BlockCanvas with Viewport

**Files:**
- Rebuild: `src/lib/components/blocks/BlockCanvas.svelte`
- Modify: `src/lib/components/blocks/ConnectionLayer.svelte`

**Decision:** REBUILD - Add viewport transform layer with zoom/pan

- [ ] **Step 1: Update ConnectionLayer for viewport**

The connection layer needs to be large enough to cover all possible connection positions. Modify the SVG positioning:

```svelte
<!-- In ConnectionLayer.svelte, change the SVG positioning: -->
<svg 
  class="absolute pointer-events-none"
  style="left: -5000px; top: -5000px; width: 10000px; height: 10000px; overflow: visible;"
>
```

This ensures connections are visible at any pan offset.

- [ ] **Step 2: Add minimap placeholder to BlockCanvas**

Add the minimap container (we'll implement Minimap in Task 5):

```svelte
<!-- Placeholder minimap -->
<div class="absolute bottom-4 right-4 w-40 h-28 bg-surface1/90 rounded-lg border border-surface2">
  <span class="text-xs text-subtext0 p-2">Minimap (coming soon)</span>
</div>
```

- [ ] **Step 3: Rebuild BlockCanvas with viewport transform**

```svelte
<script lang="ts">
  import type { BlockGraph, BlockInstance, Connection } from '$lib/types';
  import BlockNode from './BlockNode.svelte';
  import ConnectionLayer from './ConnectionLayer.svelte';
  import Minimap from './Minimap.svelte';
  import { connectionDragStore } from '$lib/stores/connection-drag';
  import { blockBuilderStore } from '$lib/stores/block-builder';
  import { viewportStore } from '$lib/stores/viewport';

  interface Props {
    graph: BlockGraph;
    selectedBlockId: string | null;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    onBlockDoubleClick?: (blockId: string) => void;
    onBlockCollapse?: (blockId: string, collapsed: boolean) => void;
  }

  let { graph, selectedBlockId, onBlockSelect, onBlockMove, onBlockDoubleClick, onBlockCollapse }: Props = $props();

  // Viewport state
  const viewport = $derived($viewportStore);

  // Pan state
  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0 });
  let panOffsetStart = $state({ x: 0, y: 0 });

  // Block drag state
  let isDraggingBlock = $state(false);
  let dragBlockId: string | null = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });

  // Context menu state
  let contextMenu = $state<{ x: number; y: number; type: 'canvas' | 'node'; blockId?: string } | null>(null);

  // Container dimensions for minimap
  let containerWidth = $state(800);
  let containerHeight = $state(600);

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // deltaY is positive for scroll down (zoom out), negative for scroll up (zoom in)
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    viewportStore.zoomAt(mouseX, mouseY, delta);
  }

  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    
    // Check if clicking on canvas background (not a block or port)
    if (target.classList.contains('canvas-area') || target.classList.contains('grid-background')) {
      // Start panning
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panOffsetStart = { x: viewport.offsetX, y: viewport.offsetY };
      onBlockSelect?.(null);
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Handle panning
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      viewportStore.setOffset(panOffsetStart.x + deltaX, panOffsetStart.y + deltaY);
    }

    // Handle connection drag preview
    if ($connectionDragStore.isDragging) {
      connectionDragStore.updateMouse(mouseX, mouseY);
    }

    // Handle block dragging
    if (isDraggingBlock && dragBlockId) {
      const canvasPos = viewportStore.screenToCanvas(mouseX, mouseY);
      onBlockMove?.(dragBlockId, {
        x: Math.max(0, canvasPos.x - dragOffset.x),
        y: Math.max(0, canvasPos.y - dragOffset.y),
      });
    }
  }

  function handleMouseUp() {
    isPanning = false;
    isDraggingBlock = false;
    dragBlockId = null;
    if ($connectionDragStore.isDragging) {
      connectionDragStore.endDrag();
    }
  }

  function handleBlockMouseDown(block: BlockInstance, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = (e.currentTarget as HTMLElement).closest('.canvas-area')?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const canvasPos = viewportStore.screenToCanvas(mouseX, mouseY);
    
    isDraggingBlock = true;
    dragBlockId = block.id;
    dragOffset = {
      x: canvasPos.x - block.position.x,
      y: canvasPos.y - block.position.y,
    };
    onBlockSelect?.(block.id);
  }

  function handleCanvasClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('canvas-area') || target.classList.contains('grid-background')) {
      onBlockSelect?.(null);
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const target = e.target as HTMLElement;
    
    // Check if right-clicked on a block
    const blockEl = target.closest('[data-block-id]');
    if (blockEl) {
      const blockId = blockEl.getAttribute('data-block-id');
      if (blockId) {
        contextMenu = { x: e.clientX, y: e.clientY, type: 'node', blockId };
        return;
      }
    }
    
    // Otherwise, canvas context menu
    contextMenu = { x: e.clientX, y: e.clientY, type: 'canvas' };
  }

  function handlePortClick(blockId: string, portId: string, isInput: boolean, e: MouseEvent) {
    e.stopPropagation();
    
    const rect = (e.currentTarget as HTMLElement).closest('.canvas-area')?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if ($connectionDragStore.isDragging && isInput) {
      const fromBlockId = $connectionDragStore.fromBlockId;
      const fromPortId = $connectionDragStore.fromPortId;
      if (!fromBlockId || !fromPortId) return;
      
      if (fromBlockId === blockId) {
        connectionDragStore.endDrag();
        return;
      }
      
      const exists = graph.connections.some(c => 
        c.from.blockId === fromBlockId && c.from.portId === fromPortId &&
        c.to.blockId === blockId && c.to.portId === portId
      );
      if (exists) {
        connectionDragStore.endDrag();
        return;
      }
      
      const conn: Connection = {
        id: crypto.randomUUID(),
        from: { blockId: fromBlockId, portId: fromPortId },
        to: { blockId, portId },
      };
      blockBuilderStore.addConnection(conn);
      connectionDragStore.endDrag();
    } else if (!isInput) {
      connectionDragStore.startDrag(blockId, portId, isInput, mouseX, mouseY);
    }
  }

  function handleContextMenuAction(action: string, data?: { blockId?: string }) {
    contextMenu = null;
    
    if (action === 'delete' && data?.blockId) {
      blockBuilderStore.removeBlock(data.blockId);
    } else if (action === 'duplicate' && data?.blockId) {
      const block = graph.blocks.find(b => b.id === data.blockId);
      if (block) {
        blockBuilderStore.addBlock({
          ...block,
          id: crypto.randomUUID(),
          position: { x: block.position.x + 50, y: block.position.y + 50 },
        });
      }
    } else if (action === 'collapse' && data?.blockId) {
      const block = graph.blocks.find(b => b.id === data.blockId);
      if (block) {
        onBlockCollapse?.(data.blockId, !block.collapsed);
      }
    }
  }

  // Transform string for the content layer
  const transform = $derived(`translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`);
</script>

<svelte:window 
  onmouseup={handleMouseUp}
/>

<div 
  class="canvas-area relative w-full h-full bg-mantle overflow-hidden"
  style="cursor: {isPanning ? 'grabbing' : 'default'};"
  onwheel={handleWheel}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onclick={handleCanvasClick}
  oncontextmenu={handleContextMenu}
  role="application"
  aria-label="Block canvas"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <!-- Grid background (transforms with viewport) -->
  <div 
    class="grid-background absolute pointer-events-none opacity-20"
    style="transform: {transform}; transform-origin: 0 0; width: 10000px; height: 10000px; left: -5000px; top: -5000px;"
  >
    <div 
      style="background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 20px 20px; width: 100%; height: 100%;"
    ></div>
  </div>

  <!-- Transform layer for all content -->
  <div 
    class="transform-layer absolute"
    style="transform: {transform}; transform-origin: 0 0;"
  >
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
      <div
        data-block-id={block.id}
        class="absolute"
        style="left: {block.position.x}px; top: {block.position.y}px;"
      >
        <BlockNode
          {block}
          isSelected={block.id === selectedBlockId}
          onSelect={() => onBlockSelect?.(block.id)}
          onDoubleClick={() => onBlockDoubleClick?.(block.id)}
          onDragStart={(e) => handleBlockMouseDown(block, e)}
          onPortClick={(portId, isInput, e) => handlePortClick(block.id, portId, isInput, e)}
          onCollapse={() => onBlockCollapse?.(block.id, !block.collapsed)}
        />
      </div>
    {/each}
  </div>

  <!-- Minimap (fixed position, not transformed) -->
  <Minimap 
    {graph} 
    scale={viewport.scale}
    offsetX={viewport.offsetX}
    offsetY={viewport.offsetY}
    {containerWidth}
    {containerHeight}
  />

  <!-- Context Menu -->
  {#if contextMenu}
    <ContextMenu 
      x={contextMenu.x}
      y={contextMenu.y}
      type={contextMenu.type}
      blockId={contextMenu.blockId}
      onAction={handleContextMenuAction}
      onClose={() => contextMenu = null}
    />
  {/if}

  <!-- Empty state -->
  {#if graph.blocks.length === 0}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="text-center">
        <p class="text-text text-lg font-medium">Double-click to add a block</p>
        <p class="text-subtext0 text-sm">or drag from the sidebar</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .canvas-area {
    cursor: default;
  }
  .canvas-area:has([data-block-id]:active) {
    cursor: grabbing;
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/blocks/BlockCanvas.svelte src/lib/components/blocks/ConnectionLayer.svelte
git commit -m "feat(blocks): rebuild BlockCanvas with viewport zoom/pan"
```

---

### Task 4: Create Minimap Component

**Files:**
- Create: `src/lib/components/blocks/Minimap.svelte`
- Create: `tests/components/blocks/Minimap.test.ts`

**Decision:** CREATE - Scaled graph overview for navigation

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Minimap from '$lib/components/blocks/Minimap.svelte';
import type { BlockGraph } from '$lib/types';

describe('Minimap', () => {
  it('renders with empty graph', () => {
    const graph: BlockGraph = { version: '1.0', blocks: [], connections: [] };
    const { container } = render(Minimap, {
      props: { graph, scale: 1, offsetX: 0, offsetY: 0, containerWidth: 800, containerHeight: 600 }
    });
    expect(container.querySelector('.minimap')).toBeTruthy();
  });

  it('renders blocks as rectangles', () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [{ id: '1', type: 'TextBlock', position: { x: 100, y: 100 }, config: {} }],
      connections: []
    };
    const { container } = render(Minimap, {
      props: { graph, scale: 1, offsetX: 0, offsetY: 0, containerWidth: 800, containerHeight: 600 }
    });
    expect(container.querySelector('.minimap-block')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/blocks/Minimap.test.ts`
Expected: FAIL - Cannot find module

- [ ] **Step 3: Create Minimap component**

```svelte
<script lang="ts">
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';

  interface Props {
    graph: BlockGraph;
    scale: number;
    offsetX: number;
    offsetY: number;
    containerWidth: number;
    containerHeight: number;
  }

  let { graph, scale, offsetX, offsetY, containerWidth, containerHeight }: Props = $props();

  // Minimap dimensions
  const MINIMAP_WIDTH = 160;
  const MINIMAP_HEIGHT = 100;
  const PADDING = 20;

  // Calculate bounds of all blocks
  const bounds = $derived(() => {
    if (graph.blocks.length === 0) {
      return { minX: 0, minY: 0, maxX: 500, maxY: 400 };
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const block of graph.blocks) {
      minX = Math.min(minX, block.position.x);
      minY = Math.min(minY, block.position.y);
      maxX = Math.max(maxX, block.position.x + 208);
      maxY = Math.max(maxY, block.position.y + 100);
    }
    return { 
      minX: minX - PADDING, 
      minY: minY - PADDING, 
      maxX: maxX + PADDING, 
      maxY: maxY + PADDING 
    };
  });

  const contentWidth = $derived(bounds().maxX - bounds().minX);
  const contentHeight = $derived(bounds().maxY - bounds().minY);

  // Scale minimap to fit content
  const minimapScale = $derived(Math.min(
    MINIMAP_WIDTH / contentWidth,
    MINIMAP_HEIGHT / contentHeight
  ));

  // Viewport rectangle in minimap coordinates
  const viewportRect = $derived(() => {
    const b = bounds();
    const viewLeft = (-offsetX / scale - b.minX) * minimapScale;
    const viewTop = (-offsetY / scale - b.minY) * minimapScale;
    const viewWidth = (containerWidth / scale) * minimapScale;
    const viewHeight = (containerHeight / scale) * minimapScale;
    
    return { x: viewLeft, y: viewTop, width: viewWidth, height: viewHeight };
  });

  // Get block color
  function getBlockColor(block: BlockInstance): string {
    const def = blockRegistry.get(block.type);
    const categoryColors: Record<string, string> = {
      foundation: '#89b4fa',
      logic: '#f38ba8',
      data: '#a6e3a1',
      structure: '#94e2d5',
    };
    return def ? categoryColors[def.category] || '#6c7086' : '#6c7086';
  }

  // Handle click on minimap to navigate
  function handleClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert to click position to canvas coordinates
    const b = bounds();
    const canvasX = clickX / minimapScale + b.minX;
    const canvasY = clickY / minimapScale + b.minY;
    
    // Center viewport on this point
    const newOffsetX = containerWidth / 2 - canvasX * scale;
    const newOffsetY = containerHeight / 2 - canvasY * scale;
    
    // We need to emit an event to update viewport - for now, we'll import the store directly
    const { viewportStore } = await import('$lib/stores/viewport');
    viewportStore.setOffset(newOffsetX, newOffsetY);
  }
</script>

<div 
  class="minimap absolute bottom-4 right-4 bg-surface1/90 rounded-lg border border-surface2 overflow-hidden"
  style="width: {MINIMAP_WIDTH}px; height: {MINIMAP_HEIGHT}px;"
  onclick={handleClick}
>
  <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} class="pointer-events-none">
    <!-- Blocks as rectangles -->
    {#each graph.blocks as block (block.id)}
      {@const b = bounds()}
      {@const x = (block.position.x - b.minX) * minimapScale}
      {@const y = (block.position.y - b.minY) * minimapScale}
      {@const w = 208 * minimapScale}
      {@const h = 60 * minimapScale}
      
      <rect
        class="minimap-block"
        x={Math.max(0, x)}
        y={Math.max(0, y)}
        width={Math.min(w, MINIMAP_WIDTH - x)}
        height={Math.min(h, MINIMAP_HEIGHT - y)}
        fill={getBlockColor(block)}
        rx="2"
      />
    {/each}

    <!-- Viewport indicator -->
    {@const vr = viewportRect()}
    <rect
      x={Math.max(0, vr.x)}
      y={Math.max(0, vr.y)}
      width={Math.min(vr.width, MINIMAP_WIDTH)}
      height={Math.min(vr.height, MINIMAP_HEIGHT)}
      fill="#89b4fa20"
      stroke="#89b4fa"
      stroke-width="1"
      rx="2"
    />
  </svg>
  
  <!-- Zoom indicator -->
  <div class="absolute bottom-1 right-1 text-xs text-subtext0">
    {Math.round(scale * 100)}%
  </div>
</div>
```

- [ ] **Step 4: Fix the async import issue**

The `await import` won't work in an event handler like that. Let's fix it:

```svelte
<script lang="ts">
  // Add at the top
  import { viewportStore } from '$lib/stores/viewport';
  
  // Change handleClick to:
  function handleClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const b = bounds();
    const canvasX = clickX / minimapScale + b.minX;
    const canvasY = clickY / minimapScale + b.minY;
    
    const newOffsetX = containerWidth / 2 - canvasX * scale;
    const newOffsetY = containerHeight / 2 - canvasY * scale;
    
    viewportStore.setOffset(newOffsetX, newOffsetY);
  }
</script>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/Minimap.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/blocks/Minimap.svelte tests/components/blocks/Minimap.test.ts
git commit -m "feat(blocks): add Minimap component for graph navigation"
```

---

### Task 5: Create ContextMenu Component

**Files:**
- Create: `src/lib/components/blocks/ContextMenu.svelte`
- Create: `tests/components/blocks/ContextMenu.test.ts`

**Decision:** CREATE - Right-click menu for actions

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ContextMenu from '$lib/components/blocks/ContextMenu.svelte';

describe('ContextMenu', () => {
  it('renders canvas menu items', () => {
    const { getByText } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'canvas', onAction: () => {}, onClose: () => {} }
    });
    expect(getByText('Clear Canvas')).toBeTruthy();
  });

  it('renders node menu items', () => {
    const { getByText } = render(ContextMenu, {
      props: { x: 100, y: 100, type: 'node', blockId: 'test', onAction: () => {}, onClose: () => {} }
    });
    expect(getByText('Delete')).toBeTruthy();
  });

  it('calls onAction when item clicked', async () => {
    let actionCalled = false;
    const { getByText } = render(ContextMenu, {
      props: { 
        x: 100, y: 100, type: 'canvas', 
        onAction: (action: string) => { actionCalled = action === 'clear'; },
        onClose: () => {}
      }
    });
    await fireEvent.click(getByText('Clear Canvas'));
    expect(actionCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/blocks/ContextMenu.test.ts`
Expected: FAIL - Cannot find module

- [ ] **Step 3: Create ContextMenu component**

```svelte
<script lang="ts">
  interface Props {
    x: number;
    y: number;
    type: 'canvas' | 'node' | 'port';
    blockId?: string;
    portId?: string;
    onAction: (action: string, data?: Record<string, string>) => void;
    onClose: () => void;
  }

  let { x, y, type, blockId, portId, onAction, onClose }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleAction(action: string) {
    const data: Record<string, string> = {};
    if (blockId) data.blockId = blockId;
    if (portId) data.portId = portId;
    onAction(action, data);
    onClose();
  }
</script>

<svelte:window onclick={onClose} onkeydown={handleKeydown} />

<div 
  class="context-menu fixed bg-surface1 border border-surface2 rounded-lg shadow-lg p-1 z-50 min-w-32"
  style="left: {x}px; top: {y}px;"
  onclick={(e) => e.stopPropagation()}
  role="menu"
>
  {#if type === 'canvas'}
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-text hover:bg-surface2 rounded" onclick={() => handleAction('add-block')} role="menuitem">
      Add Block...
    </button>
    <hr class="border-surface2 my-1">
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-text hover:bg-surface2 rounded" onclick={() => handleAction('clear')} role="menuitem">
      Clear Canvas
    </button>
  {:else if type === 'node'}
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-text hover:bg-surface2 rounded" onclick={() => handleAction('edit')} role="menuitem">
      Edit
    </button>
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-text hover:bg-surface2 rounded" onclick={() => handleAction('duplicate')} role="menuitem">
      Duplicate
    </button>
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-text hover:bg-surface2 rounded" onclick={() => handleAction('collapse')} role="menuitem">
      Collapse
    </button>
    <hr class="border-surface2 my-1">
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-red hover:bg-surface2 rounded" onclick={() => handleAction('delete')} role="menuitem">
      Delete
    </button>
  {:else if type === 'port'}
    <button class="menu-item w-full text-left px-3 py-2 text-sm text-text hover:bg-surface2 rounded" onclick={() => handleAction('disconnect')} role="menuitem">
      Disconnect All
    </button>
  {/if}
</div>

<style>
  .menu-item {
    transition: background-color 0.1s;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/ContextMenu.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/blocks/ContextMenu.svelte tests/components/blocks/ContextMenu.test.ts
git commit -m "feat(blocks): add ContextMenu component for right-click actions"
```

---

### Task 6: Add Collapse to BlockNode

**Files:**
- Modify: `src/lib/components/blocks/BlockNode.svelte`
- Create: `tests/components/blocks/BlockNode.collapse.test.ts`

**Decision:** MODIFY - Add collapse button and collapsed state rendering

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';
import type { BlockInstance } from '$lib/types';

describe('BlockNode collapse', () => {
  it('shows collapse button', () => {
    const block: BlockInstance = {
      id: '1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Test' }
    };
    const { container } = render(BlockNode, { props: { block, isSelected: false } });
    expect(container.querySelector('.collapse-btn')).toBeTruthy();
  });

  it('hides body when collapsed', () => {
    const block: BlockInstance = {
      id: '1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Test' }, collapsed: true
    };
    const { container } = render(BlockNode, { props: { block, isSelected: false } });
    expect(container.querySelector('.block-body')).toBeFalsy();
  });

  it('shows body when expanded', () => {
    const block: BlockInstance = {
      id: '1', type: 'TextBlock', position: { x: 0, y: 0 }, config: { content: 'Test' }, collapsed: false
    };
    const { container } = render(BlockNode, { props: { block, isSelected: false } });
    expect(container.querySelector('.block-body')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/blocks/BlockNode.collapse.test.ts`
Expected: FAIL - collapse-btn not found

- [ ] **Step 3: Modify BlockNode to add collapse**

Read the current BlockNode.svelte and add:

1. Collapse button in header
2. Conditional body rendering
3. onCollapse callback prop

```svelte
<!-- In the header div, add collapse button: -->
<div class="header ..." onclick={handleHeaderClick}>
  <span class="icon">{definition?.icon}</span>
  <span class="title">{definition?.displayName}</span>
  <button 
    class="collapse-btn ml-auto text-xs opacity-60 hover:opacity-100"
    onclick={handleCollapseClick}
    title={block.collapsed ? 'Expand' : 'Collapse'}
  >
    {block.collapsed ? '▼' : '▲'}
  </button>
</div>

<!-- Conditional body: -->
{#if !block.collapsed}
  <div class="block-body ...">
    <!-- existing body content -->
  </div>
{/if}
```

Add to Props:
```typescript
interface Props {
  // ... existing
  onCollapse?: () => void;
}

function handleCollapseClick(e: MouseEvent) {
  e.stopPropagation();
  onCollapse?.();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/BlockNode.collapse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/blocks/BlockNode.svelte tests/components/blocks/BlockNode.collapse.test.ts
git commit -m "feat(blocks): add collapse functionality to BlockNode"
```

---

### Task 7: Enhance BlockPreview with Token Count

**Files:**
- Modify: `src/lib/components/blocks/BlockPreview.svelte`
- Modify: `src/lib/stores/block-builder.ts`

**Decision:** MODIFY - Add token count display

- [ ] **Step 1: Modify BlockPreview to add token count**

```svelte
<script lang="ts">
  import type { BlockGraph } from '$lib/types';
  import { countTokens } from '$lib/utils/tokenizer';

  interface Props {
    graph: BlockGraph;
  }

  let { graph }: Props = $props();

  // Generate preview text (simplified - concatenate all enabled TextBlocks)
  const previewText = $derived(() => {
    const texts: string[] = [];
    for (const block of graph.blocks) {
      if (block.type === 'TextBlock' && block.config.content) {
        const enabled = block.config.enabled ?? true;
        if (enabled && !block.collapsed) {
          texts.push(block.config.content as string);
        }
      }
    }
    return texts.join('\n\n');
  });

  const tokenCount = $derived(countTokens(previewText()));
</script>

<div class="preview-panel flex flex-col h-full bg-surface1 overflow-hidden">
  <div class="px-4 py-3 border-b border-surface2 flex items-center justify-between">
    <h3 class="text-sm font-semibold text-text">Live Preview</h3>
    <span class="text-xs text-subtext0">{tokenCount} tokens</span>
  </div>
  
  <div class="flex-1 p-4 overflow-y-auto">
    {#if previewText().trim()}
      <pre class="text-sm text-text whitespace-pre-wrap font-mono">{previewText()}</pre>
    {:else}
      <p class="text-sm text-subtext0 italic">Add blocks to see preview...</p>
    {/if}
  </div>
  
  <div class="px-4 py-2 border-t border-surface2 text-xs text-subtext0">
    {graph.blocks.length} block{graph.blocks.length !== 1 ? 's' : ''}
  </div>
</div>
```

- [ ] **Step 2: Add setBlockCollapsed to block-builder store**

```typescript
// In block-builder.ts, add method:
setBlockCollapsed: (blockId: string, collapsed: boolean) => {
  update(state => ({
    ...state,
    currentGraph: {
      ...state.currentGraph,
      blocks: state.currentGraph.blocks.map(b => 
        b.id === blockId ? { ...b, collapsed } : b
      ),
    },
  }));
},
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/blocks/BlockPreview.svelte src/lib/stores/block-builder.ts
git commit -m "feat(blocks): add token count to BlockPreview"
```

---

### Task 8: Rebuild BlockBuilder for Full-Screen Layout

**Files:**
- Rebuild: `src/lib/components/blocks/BlockBuilder.svelte`
- Modify: `src/lib/components/blocks/Toolbar.svelte`

**Decision:** REBUILD - Full-screen layout with collapsible preview panel

- [ ] **Step 1: Rebuild BlockBuilder with full-screen layout**

```svelte
<script lang="ts">
  import { tick } from 'svelte';
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import BlockCanvas from './BlockCanvas.svelte';
  import BlockPreview from './BlockPreview.svelte';
  import TextBlockEditor from './editors/TextBlockEditor.svelte';
  import Toolbar from './Toolbar.svelte';
  import { viewportStore } from '$lib/stores/viewport';
  import { blockBuilderStore } from '$lib/stores/block-builder';

  interface Props {
    graph: BlockGraph;
    onBlockAdd?: (blockType: string) => void;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    onBlockConfigChange?: (blockId: string, config: Record<string, unknown>) => void;
    selectedBlockId?: string | null;
  }

  let { 
    graph, 
    onBlockAdd, 
    onBlockSelect,
    onBlockMove,
    onBlockConfigChange,
    selectedBlockId 
  }: Props = $props();

  // Preview panel state
  let previewCollapsed = $state(false);

  // Editor modal state
  let editingBlock: BlockInstance | null = $state(null);
  let modalElement: HTMLDivElement | undefined = $state();

  // Container dimensions
  let containerWidth = $state(800);
  let containerHeight = $state(600);

  $effect(() => {
    if (editingBlock) {
      tick().then(() => modalElement?.focus());
    }
  });

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

  function handleBlockCollapse(blockId: string, collapsed: boolean) {
    blockBuilderStore.setBlockCollapsed(blockId, collapsed);
  }

  function handleZoomIn() {
    viewportStore.zoomAt(containerWidth / 2, containerHeight / 2, 0.1);
  }

  function handleZoomOut() {
    viewportStore.zoomAt(containerWidth / 2, containerHeight / 2, -0.1);
  }

  function handleFitView() {
    viewportStore.fitToContent(graph.blocks, containerWidth, containerHeight);
  }

  function handleResetView() {
    viewportStore.reset();
  }
</script>

<div class="block-builder h-full flex flex-col bg-mantle">
  <!-- Toolbar -->
  <Toolbar 
    zoom={$viewportStore.scale}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
    onFitView={handleFitView}
    onResetView={handleResetView}
  />
  
  <!-- Main area -->
  <div 
    class="flex-1 relative overflow-hidden"
    bind:clientWidth={containerWidth}
    bind:clientHeight={containerHeight}
  >
    <!-- Canvas fills entire area -->
    <BlockCanvas 
      class="absolute inset-0"
      {graph}
      selectedBlockId={selectedBlockId ?? null}
      onBlockSelect={onBlockSelect}
      onBlockMove={onBlockMove}
      onBlockDoubleClick={handleBlockDoubleClick}
      onBlockCollapse={handleBlockCollapse}
    />
    
    <!-- Preview panel - docked right, collapsible -->
    <div 
      class="absolute right-0 top-0 bottom-0 transition-all duration-300 ease-in-out flex"
    >
      {#if previewCollapsed}
        <!-- Collapsed: thin bar -->
        <button 
          class="w-10 h-full bg-surface1 border-l border-surface2 flex items-center justify-center hover:bg-surface2 transition-colors"
          onclick={() => previewCollapsed = false}
          title="Expand preview"
        >
          <span class="text-xs text-subtext0" style="writing-mode: vertical-rl;">Preview</span>
        </button>
      {:else}
        <!-- Expanded: full panel -->
        <div class="w-80 h-full flex flex-col bg-surface1 border-l border-surface2">
          <div class="flex items-center justify-between px-4 py-2 border-b border-surface2 shrink-0">
            <h3 class="text-sm font-semibold text-text">Preview</h3>
            <button 
              class="text-subtext0 hover:text-text transition-colors"
              onclick={() => previewCollapsed = true}
              title="Collapse"
            >
              ◀
            </button>
          </div>
          <div class="flex-1 overflow-hidden">
            <BlockPreview {graph} />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Editor Modal -->
{#if editingBlock}
  {@const block = editingBlock}
  <div 
    bind:this={modalElement}
    class="fixed inset-0 bg-mantle/80 z-50 flex items-center justify-center"
    onclick={handleEditorClose}
    onkeydown={(e) => e.key === 'Escape' && handleEditorClose()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div 
      class="bg-surface1 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto border border-surface2"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-text">Edit {block.type}</h3>
        <button 
          class="text-subtext0 hover:text-text transition-colors"
          onclick={handleEditorClose}
        >✕</button>
      </div>
      
      {#if block.type === 'TextBlock'}
        <TextBlockEditor 
          config={block.config}
          onChange={(config) => handleEditorSave(block.id, config)}
        />
      {:else}
        <p class="text-subtext0">No editor available for this block type</p>
      {/if}
      
      <div class="flex gap-2 mt-4">
        <button 
          class="flex-1 px-4 py-2 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
          onclick={handleEditorClose}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Update Toolbar with zoom controls**

```svelte
<script lang="ts">
  interface Props {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onResetView: () => void;
  }

  let { zoom, onZoomIn, onZoomOut, onFitView, onResetView }: Props = $props();
</script>

<div class="toolbar flex items-center gap-2 px-4 py-2 bg-surface1 border-b border-surface2 h-10">
  <!-- Zoom controls -->
  <button 
    class="px-2 py-1 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
    onclick={onZoomOut}
    title="Zoom out"
  >−</button>
  
  <span class="text-sm text-text min-w-12 text-center">{Math.round(zoom * 100)}%</span>
  
  <button 
    class="px-2 py-1 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
    onclick={onZoomIn}
    title="Zoom in"
  >+</button>
  
  <div class="w-px h-6 bg-surface2 mx-2"></div>
  
  <button 
    class="px-3 py-1 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
    onclick={onFitView}
  >
    Fit View
  </button>
  
  <button 
    class="px-3 py-1 bg-surface2 rounded text-sm text-text hover:bg-surface0 transition-colors"
    onclick={onResetView}
  >
    Reset
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/blocks/BlockBuilder.svelte src/lib/components/blocks/Toolbar.svelte
git commit -m "feat(blocks): rebuild BlockBuilder with full-screen layout and collapsible preview"
```

---

## Plan Summary

**Phase 3 Tasks (8 total):**

| Task | Component | Action |
|------|-----------|--------|
| 1 | viewport.ts | REBUILD - offset+scale approach |
| 2 | tokenizer.ts | CREATE - token counting |
| 3 | BlockCanvas.svelte | REBUILD - viewport transform |
| 4 | Minimap.svelte | CREATE - navigation overview |
| 5 | ContextMenu.svelte | CREATE - right-click actions |
| 6 | BlockNode.svelte | MODIFY - add collapse |
| 7 | BlockPreview.svelte | MODIFY - token count |
| 8 | BlockBuilder.svelte | REBUILD - full-screen layout |

**Deliverable after Phase 3:**
- Full-screen canvas filling viewport
- Zoom (0.25x-2x) centered on cursor
- Pan by dragging empty space
- Minimap for navigation
- Collapsible nodes
- Context menu for actions
- Preview panel with token count, collapsible to 40px bar

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-block-builder-phase3.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
