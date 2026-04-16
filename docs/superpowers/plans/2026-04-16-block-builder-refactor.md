# Block Builder Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Block Builder to display visible, draggable blocks with basic live preview, matching the mockup layout.

**Architecture:** Simplified 3-column grid layout (Palette 200px / Canvas 1fr / Preview 250px). Blocks use direct absolute positioning without viewport transforms. Canvas has fixed height with proper overflow. Connections deferred to Phase 2.

**Tech Stack:** Svelte 5, Tailwind CSS, existing block definitions and execution engine

---

## File Structure

```
src/lib/components/blocks/
├── BlockBuilder.svelte      # NEW: Main container with 3-column grid
├── BlockPalette.svelte      # MODIFY: Simplify to match mockup
├── BlockCanvas.svelte       # REBUILD: Remove viewport, direct positioning
├── BlockNode.svelte         # MODIFY: Simplify positioning
├── BlockPreview.svelte      # NEW: Basic text preview panel
├── Toolbar.svelte           # MODIFY: Move below canvas
├── Port.svelte              # KEEP: Works correctly
├── ConnectionLayer.svelte   # KEEP: Deferred to Phase 2
├── editors/
│   └── TextBlockEditor.svelte  # KEEP: Works correctly

src/routes/settings/prompt-builder/
└── +page.svelte             # MODIFY: Use new BlockBuilder component
```

---

## Phase 1: Foundation

### Task 1: Create BlockBuilder Container

**Files:**
- Create: `src/lib/components/blocks/BlockBuilder.svelte`
- Create: `tests/components/blocks/BlockBuilder.test.ts`

**Decision:** REBUILD - New container with correct layout structure

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockBuilder from '$lib/components/blocks/BlockBuilder.svelte';

describe('BlockBuilder', () => {
  it('renders 3-column layout', () => {
    const { container } = render(BlockBuilder, {
      props: {
        graph: { version: '1.0', blocks: [], connections: [] }
      }
    });
    expect(container.querySelector('.block-builder')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/blocks/BlockBuilder.test.ts`
Expected: FAIL - Cannot find module

- [ ] **Step 3: Create BlockBuilder component**

```svelte
<script lang="ts">
  import type { BlockGraph } from '$lib/types';
  import BlockPalette from './BlockPalette.svelte';
  import BlockCanvas from './BlockCanvas.svelte';
  import BlockPreview from './BlockPreview.svelte';

  interface Props {
    graph: BlockGraph;
    onBlockAdd?: (blockType: string) => void;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
    selectedBlockId?: string | null;
  }

  let { 
    graph, 
    onBlockAdd, 
    onBlockSelect,
    onBlockMove,
    selectedBlockId 
  }: Props = $props();
</script>

<div class="block-builder grid gap-4" style="grid-template-columns: 200px 1fr 250px; height: 500px;">
  <!-- Left: Palette -->
  <BlockPalette onBlockClick={onBlockAdd} />
  
  <!-- Center: Canvas -->
  <BlockCanvas 
    {graph} 
    {selectedBlockId}
    onBlockSelect={onBlockSelect}
    onBlockMove={onBlockMove}
  />
  
  <!-- Right: Preview -->
  <BlockPreview {graph} />
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/BlockBuilder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/blocks/BlockBuilder.svelte tests/components/blocks/BlockBuilder.test.ts
git commit -m "feat(blocks): add BlockBuilder container with 3-column grid layout"
```

---

### Task 2: Create BlockPreview Component

**Files:**
- Create: `src/lib/components/blocks/BlockPreview.svelte`
- Create: `tests/components/blocks/BlockPreview.test.ts`

**Decision:** REBUILD - Simpler than RightPanel, focused on text output only

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockPreview from '$lib/components/blocks/BlockPreview.svelte';

describe('BlockPreview', () => {
  it('renders preview panel', () => {
    const { container } = render(BlockPreview, {
      props: {
        graph: { version: '1.0', blocks: [], connections: [] }
      }
    });
    expect(container.querySelector('.preview-panel')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/blocks/BlockPreview.test.ts`
Expected: FAIL - Cannot find module

- [ ] **Step 3: Create BlockPreview component**

```svelte
<script lang="ts">
  import type { BlockGraph } from '$lib/types';

  interface Props {
    graph: BlockGraph;
  }

  let { graph }: Props = $props();

  // Simple preview: concatenate all TextBlock contents
  const previewText = $derived(() => {
    const texts: string[] = [];
    for (const block of graph.blocks) {
      if (block.type === 'TextBlock' && block.config.content) {
        const enabled = block.config.enabled ?? true;
        if (enabled) {
          texts.push(block.config.content as string);
        }
      }
    }
    return texts.join('\n\n');
  });
</script>

<div class="preview-panel flex flex-col h-full bg-surface1 rounded-lg overflow-hidden">
  <div class="px-4 py-3 border-b border-surface2">
    <h3 class="text-sm font-semibold text-text">Live Preview</h3>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/BlockPreview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/blocks/BlockPreview.svelte tests/components/blocks/BlockPreview.test.ts
git commit -m "feat(blocks): add BlockPreview component for basic text output"
```

---

### Task 3: Rebuild BlockCanvas - Remove Viewport

**Files:**
- Modify: `src/lib/components/blocks/BlockCanvas.svelte`
- Modify: `tests/components/blocks/BlockCanvas.test.ts`

**Decision:** REBUILD - Current implementation has broken viewport transform and coordinate system

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockCanvas from '$lib/components/blocks/BlockCanvas.svelte';
import type { BlockGraph } from '$lib/types';

describe('BlockCanvas (simplified)', () => {
  it('renders blocks at their positions', () => {
    const graph: BlockGraph = {
      version: '1.0',
      blocks: [{
        id: 'test-1',
        type: 'TextBlock',
        position: { x: 50, y: 50 },
        config: { content: 'Test', enabled: true }
      }],
      connections: []
    };
    
    const { container } = render(BlockCanvas, {
      props: { graph, selectedBlockId: null }
    });
    
    const block = container.querySelector('[data-block-id="test-1"]');
    expect(block).toBeTruthy();
    expect(block?.getAttribute('style')).toContain('left: 50px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/blocks/BlockCanvas.test.ts`
Expected: FAIL - Blocks not rendering or wrong positioning

- [ ] **Step 3: Rebuild BlockCanvas with direct positioning**

```svelte
<script lang="ts">
  import type { BlockGraph, BlockInstance } from '$lib/types';
  import BlockNode from './BlockNode.svelte';

  interface Props {
    graph: BlockGraph;
    selectedBlockId: string | null;
    onBlockSelect?: (blockId: string | null) => void;
    onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
  }

  let { graph, selectedBlockId, onBlockSelect, onBlockMove }: Props = $props();

  // Drag state
  let isDragging = $state(false);
  let dragBlockId: string | null = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });

  function handleBlockMouseDown(block: BlockInstance, e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    dragBlockId = block.id;
    dragOffset = {
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y
    };
    onBlockSelect?.(block.id);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !dragBlockId) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Clamp to canvas bounds (positive values)
    onBlockMove?.(dragBlockId, {
      x: Math.max(0, newX),
      y: Math.max(0, newY)
    });
  }

  function handleMouseUp() {
    isDragging = false;
    dragBlockId = null;
  }

  function handleCanvasClick(e: MouseEvent) {
    // Deselect if clicking on empty canvas
    if ((e.target as HTMLElement).classList.contains('canvas-area')) {
      onBlockSelect?.(null);
    }
  }
</script>

<svelte:window 
  onmousemove={handleMouseMove} 
  onmouseup={handleMouseUp} 
/>

<div 
  class="canvas-area relative w-full h-full bg-mantle rounded-lg overflow-hidden border-2 border-surface2"
  onclick={handleCanvasClick}
  role="application"
  aria-label="Block canvas"
>
  <!-- Grid background (fixed) -->
  <div 
    class="absolute inset-0 pointer-events-none opacity-20"
    style="background-image: radial-gradient(circle, #cdd6f4 1px, transparent 1px); background-size: 20px 20px;"
  ></div>

  <!-- Blocks -->
  {#each graph.blocks as block (block.id)}
    <div
      data-block-id={block.id}
      class="absolute"
      style="left: {block.position.x}px; top: {block.position.y}px;"
      onmousedown={(e) => handleBlockMouseDown(block, e)}
      role="button"
      tabindex="0"
    >
      <BlockNode
        {block}
        isSelected={block.id === selectedBlockId}
      />
    </div>
  {/each}

  <!-- Empty state -->
  {#if graph.blocks.length === 0}
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="text-center">
        <p class="text-text text-lg font-medium">Drag blocks from palette</p>
        <p class="text-subtext0 text-sm">or click to add them here</p>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/BlockCanvas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/blocks/BlockCanvas.svelte tests/components/blocks/BlockCanvas.test.ts
git commit -m "refactor(blocks): rebuild BlockCanvas with direct positioning, remove viewport"
```

---

### Task 4: Simplify BlockNode

**Files:**
- Modify: `src/lib/components/blocks/BlockNode.svelte`
- Modify: `tests/components/blocks/BlockNode.test.ts`

**Decision:** MODIFY - Core structure works, needs simplified props

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BlockNode from '$lib/components/blocks/BlockNode.svelte';
import type { BlockInstance } from '$lib/types';

describe('BlockNode (simplified)', () => {
  it('renders block with header and content', () => {
    const block: BlockInstance = {
      id: 'test-1',
      type: 'TextBlock',
      position: { x: 0, y: 0 },
      config: { content: 'Hello World', enabled: true }
    };
    
    const { container } = render(BlockNode, {
      props: { block, isSelected: false }
    });
    
    expect(container.textContent).toContain('Text');
    expect(container.textContent).toContain('Hello World');
  });
});
```

- [ ] **Step 2: Run test to verify current state**

Run: `npm test -- tests/components/blocks/BlockNode.test.ts`
Expected: May pass or fail depending on current state

- [ ] **Step 3: Simplify BlockNode props**

```svelte
<script lang="ts">
  import type { BlockInstance } from '$lib/types';
  import { blockRegistry } from '$lib/blocks/registry';

  interface Props {
    block: BlockInstance;
    isSelected: boolean;
  }

  let { block, isSelected }: Props = $props();

  const definition = $derived(blockRegistry.get(block.type));
  
  const categoryColors: Record<string, string> = {
    foundation: '#89b4fa',
    logic: '#f38ba8',
    data: '#a6e3a1',
    structure: '#94e2d5',
  };
  
  const headerColor = $derived(
    definition ? categoryColors[definition.category] : '#6c7086'
  );
</script>

<div
  class="block-node w-52 rounded-lg overflow-hidden shadow-lg transition-shadow"
  class:selected={isSelected}
  style="user-select: none;"
>
  <!-- Header -->
  <div 
    class="px-3 py-2 flex items-center gap-2"
    style="background: linear-gradient(135deg, {headerColor} 0%, {headerColor}dd 100%);"
  >
    <span class="text-lg">{definition?.icon || '🔷'}</span>
    <span class="text-sm font-semibold text-crust truncate flex-1">
      {definition?.displayName || block.type}
    </span>
  </div>
  
  <!-- Body -->
  <div class="bg-surface1 p-3 border-x border-b border-surface2">
    <div class="text-xs text-subtext0 line-clamp-3">
      {#if block.config.content}
        {block.config.content}
      {:else}
        <span class="italic opacity-50">Click to edit...</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .block-node:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .block-node.selected {
    box-shadow: 0 0 0 2px #cba6f7, 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/blocks/BlockNode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/blocks/BlockNode.svelte tests/components/blocks/BlockNode.test.ts
git commit -m "refactor(blocks): simplify BlockNode props, remove port handling for MVP"
```

---

### Task 5: Update Page Integration

**Files:**
- Modify: `src/routes/settings/prompt-builder/+page.svelte`

**Decision:** MODIFY - Use new BlockBuilder component

- [ ] **Step 1: Update imports and state**

```typescript
// In script section, replace block builder imports:
import BlockBuilder from '$lib/components/blocks/BlockBuilder.svelte';
import { blockBuilderStore } from '$lib/stores/block-builder';
import { registerAllBlocks, blockRegistry } from '$lib/blocks/registry';
import type { BlockType } from '$lib/types';

// Initialize blocks once
if (!blockRegistry.has('TextBlock')) {
  registerAllBlocks();
}

// State - simplified
let activeView: 'presets' | 'blocks' = $state('presets');
let selectedBlockId: string | null = $state(null);

// Reactive graph from store
const currentGraph = $derived($blockBuilderStore.currentGraph);
```

- [ ] **Step 2: Add block handlers**

```typescript
function handleBlockAdd(blockType: string) {
  const definition = blockRegistry.get(blockType as BlockType);
  if (!definition) return;

  const existingBlocks = currentGraph.blocks;
  const x = existingBlocks.length > 0
    ? Math.max(...existingBlocks.map(b => b.position.x)) + 250
    : 50;
  const y = existingBlocks.length > 0
    ? existingBlocks[existingBlocks.length - 1]?.position.y ?? 50
    : 50;

  blockBuilderStore.addBlock({
    id: crypto.randomUUID(),
    type: blockType as BlockType,
    position: { x, y },
    config: { ...definition.defaultConfig },
  });
}

function handleBlockSelect(blockId: string | null) {
  selectedBlockId = blockId;
}

function handleBlockMove(blockId: string, position: { x: number; y: number }) {
  blockBuilderStore.updateBlockPosition(blockId, position);
}
```

- [ ] **Step 3: Replace Block Builder View template**

```svelte
{:else}
  <!-- Block Builder View -->
  <div class="block-builder-container">
    <BlockBuilder
      graph={currentGraph}
      onBlockAdd={handleBlockAdd}
      onBlockSelect={handleBlockSelect}
      onBlockMove={handleBlockMove}
      {selectedBlockId}
    />
    
    <!-- Toolbar below -->
    <div class="flex gap-2 mt-4">
      <button
        class="px-3 py-2 bg-surface1 rounded-md text-sm text-text hover:bg-surface2 transition-colors"
        onclick={() => activeView = 'presets'}
      >
        ← Back to Presets
      </button>
      <div class="flex-1"></div>
      <button
        class="px-3 py-2 bg-mauve text-crust rounded-md text-sm font-medium hover:bg-lavender transition-colors"
        onclick={handleExportTPrompt}
      >
        💾 Save .tprompt
      </button>
    </div>
  </div>
{/if}
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/prompt-builder/+page.svelte
git commit -m "refactor(blocks): integrate new BlockBuilder component into settings page"
```

---

### Task 6: Update BlockPalette

**Files:**
- Modify: `src/lib/components/blocks/BlockPalette.svelte`

**Decision:** MODIFY - Already functional, minor styling updates

- [ ] **Step 1: Simplify palette styling to match mockup**

```svelte
<script lang="ts">
  import { blockRegistry } from '$lib/blocks/registry';
  import type { BlockDefinition } from '$lib/types';

  interface Props {
    onBlockClick?: (blockType: string) => void;
  }

  let { onBlockClick }: Props = $props();

  const categories = [
    { id: 'foundation', label: 'Foundation' },
    { id: 'logic', label: 'Logic' },
    { id: 'data', label: 'Data' },
  ] as const;

  const categoryColors: Record<string, string> = {
    foundation: '#89b4fa',
    logic: '#f38ba8',
    data: '#a6e3a1',
  };

  function getBlocksByCategory(category: string): BlockDefinition[] {
    return blockRegistry.getAllByCategory(category as BlockDefinition['category']);
  }
</script>

<div class="palette-panel h-full bg-surface1 rounded-lg p-3 overflow-y-auto">
  <h3 class="text-sm font-semibold text-text mb-3">Block Palette</h3>

  {#each categories as category}
    {@const blocks = getBlocksByCategory(category.id)}
    {#if blocks.length > 0}
      <div class="mb-4">
        <div 
          class="text-xs uppercase font-medium mb-2 px-2 py-1 rounded"
          style="color: {categoryColors[category.id]}; background: {categoryColors[category.id]}20;"
        >
          {category.label}
        </div>

        <div class="space-y-1">
          {#each blocks as block}
            <button
              class="flex items-center gap-2 p-2 bg-surface0 rounded cursor-pointer hover:bg-surface2 transition-colors w-full text-left"
              onclick={() => onBlockClick?.(block.type)}
            >
              <span class="text-base">{block.icon}</span>
              <span class="text-sm text-text truncate">{block.displayName}</span>
            </button>
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
git commit -m "refactor(blocks): simplify BlockPalette styling to match mockup"
```

---

## Plan Summary

**Phase 1 Tasks (6 total):**
1. Create BlockBuilder container (3-column grid)
2. Create BlockPreview component (basic text output)
3. Rebuild BlockCanvas (remove viewport, direct positioning)
4. Simplify BlockNode (remove port handling for MVP)
5. Update page integration (use new components)
6. Update BlockPalette (simplified styling)

**Deliverable after Phase 1:**
- Visible blocks on canvas
- Drag to reposition blocks
- Click palette to add blocks
- Basic live preview showing text content

**Deferred to Phase 2:**
- Port-based connections
- Block editing (double-click)
- Zoom/pan canvas navigation
- Toggle panel
- Export functionality

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-block-builder-refactor.md`**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach would you prefer?**
