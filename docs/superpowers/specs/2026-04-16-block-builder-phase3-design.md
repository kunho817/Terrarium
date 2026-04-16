# Block Builder Phase 3: ComfyUI-Style Evolution Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan after user approves this spec.

**Goal:** Transform the Block Builder from a fixed 3-column layout to a full-screen canvas with zoom/pan navigation, minimap, collapsible nodes, context menu, and enhanced preview panel with token count.

**Architecture:** Full-screen canvas with floating/dockable panels, viewport-based coordinate system, minimap for navigation overview.

**Tech Stack:** Svelte 5, Tailwind CSS, SVG for minimap and connections

---

## Overview

### Current State (Post Phase 2)
- 3-column grid layout: Palette (200px) | Canvas (1fr, 500px fixed height) | Preview (250px)
- Visible blocks with drag repositioning
- Port-based connections with live drag preview
- Double-click editing with modal overlay
- Toggle panel for managing toggle states

### Target State (Phase 3)
- Full-screen canvas filling viewport
- Zoom (0.25x to 2x) with mouse wheel, centered on cursor
- Pan by dragging empty canvas space
- Minimap in corner for navigation overview
- Collapsible nodes (click header to collapse)
- Context menu on right-click
- Preview panel: docked right, collapsible, with token count

---

## File Structure

```
src/lib/components/blocks/
├── BlockBuilder.svelte      # REBUILD: Full-screen layout with floating panels
├── BlockCanvas.svelte       # REBUILD: Add viewport with zoom/pan
├── BlockNode.svelte         # MODIFY: Add collapse state and button
├── BlockPreview.svelte      # MODIFY: Add token count, collapsible wrapper
├── ConnectionLayer.svelte   # MODIFY: Work with viewport transform
├── Minimap.svelte           # NEW: Scaled graph overview
├── ContextMenu.svelte       # NEW: Right-click actions
├── Toolbar.svelte           # MODIFY: Add zoom controls, fit-to-view
├── BlockPalette.svelte      # KEEP: Optional sidebar, can be hidden
├── TogglePanel.svelte       # MODIFY: Make collapsible/floating
├── Port.svelte              # KEEP: Works correctly
├── editors/
│   └── TextBlockEditor.svelte  # KEEP: Works correctly

src/lib/stores/
├── block-builder.ts         # MODIFY: Add collapse state to BlockInstance
├── connection-drag.ts       # KEEP: Works correctly
└── viewport.ts              # REBUILD: Viewport state with zoom/pan

src/lib/types/
└── blocks.ts                # MODIFY: Add collapsed field to BlockInstance

src/lib/utils/
└── tokenizer.ts             # NEW: Simple token counting utility
```

---

## Component Specifications

### 1. Viewport Store (`viewport.ts`)

**Purpose:** Manage canvas zoom and pan state, provide coordinate conversion utilities.

**State:**
```typescript
interface ViewportState {
  scale: number;      // Zoom level: 0.25 to 2.0
  offsetX: number;    // Pan offset in canvas coordinates
  offsetY: number;
}
```

**Methods:**
```typescript
// Zoom centered on a point (screen coordinates)
zoomAt(screenX: number, screenY: number, delta: number): void

// Pan by delta (screen coordinates, converted to canvas delta)
pan(deltaX: number, deltaY: number): void

// Fit all blocks in view
fitToContent(blocks: BlockInstance[], containerWidth: number, containerHeight: number): void

// Reset to default view
reset(): void

// Coordinate conversion utilities
canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number }
screenToCanvas(screenX: number, screenY: number): { x: number; y: number }
```

**Constraints:**
- `scale` clamped to [0.25, 2.0]
- Zoom centers on mouse cursor position

**Default State:**
- `scale: 1.0`
- `offsetX: 0`
- `offsetY: 0`

---

### 2. BlockCanvas.svelte (REBUILD)

**Purpose:** Infinite canvas area with zoom/pan navigation.

**Props:**
```typescript
interface Props {
  graph: BlockGraph;
  selectedBlockId: string | null;
  onBlockSelect?: (blockId: string | null) => void;
  onBlockMove?: (blockId: string, position: { x: number; y: number }) => void;
  onBlockDoubleClick?: (blockId: string) => void;
  onBlockCollapse?: (blockId: string, collapsed: boolean) => void;
  onBlockDelete?: (blockId: string) => void;
  onBlockDuplicate?: (blockId: string) => void;
  onAddBlock?: (blockType: string, position: { x: number; y: number }) => void;
}
```

**Structure:**
```svelte
<div class="canvas-container" 
     onwheel={handleWheel}
     onmousedown={handleMouseDown}
     onmousemove={handleMouseMove}
     onmouseup={handleMouseUp}
     oncontextmenu={handleContextMenu}
>
  <!-- Grid background (scales with viewport) -->
  <div class="grid-background" style="transform: ...">
    <!-- Grid pattern -->
  </div>
  
  <!-- Transform layer for all content -->
  <div class="transform-layer" style="transform: translate({offsetX}px, {offsetY}px) scale({scale})">
    <!-- Connection Layer -->
    <ConnectionLayer connections={graph.connections} blocks={graph.blocks} />
    
    <!-- Blocks -->
    {#each graph.blocks as block (block.id)}
      <div class="block-wrapper" style="left: {block.position.x}px; top: {block.position.y}px;">
        <BlockNode
          {block}
          isSelected={block.id === selectedBlockId}
          onPortClick={handlePortClick}
          onCollapse={() => onBlockCollapse?.(block.id, !block.collapsed)}
        />
      </div>
    {/each}
  </div>
  
  <!-- Minimap (not transformed, fixed position) -->
  <Minimap {graph} {scale} {offsetX} {offsetY} />
  
  <!-- Context Menu (shown on right-click) -->
  {#if contextMenu}
    <ContextMenu {...contextMenu} onAction={handleContextMenuAction} />
  {/if}
</div>
```

**Event Handlers:**

1. **Zoom (mouse wheel):**
   - Get mouse position relative to canvas container
   - Calculate new scale (delta based on wheel direction)
   - Call `viewportStore.zoomAt(mouseX, mouseY, delta)`

2. **Pan (drag on empty space):**
   - On mousedown: check if target is canvas background (not a block)
   - On mousemove: if panning, update offset via `viewportStore.pan(deltaX, deltaY)`
   - On mouseup: end pan

3. **Block Drag (existing behavior, adapted for viewport):**
   - Convert mouse screen position to canvas coordinates using `screenToCanvas()`
   - Update block position in canvas coordinates

4. **Context Menu:**
   - On contextmenu: prevent default, show ContextMenu at mouse position
   - Menu items depend on what was clicked (canvas vs node vs port)

---

### 3. Minimap.svelte (NEW)

**Purpose:** Bird's eye view of the entire graph for quick navigation.

**Props:**
```typescript
interface Props {
  graph: BlockGraph;
  scale: number;
  offsetX: number;
  offsetY: number;
  containerWidth?: number;  // Canvas container dimensions
  containerHeight?: number;
}
```

**Visual Design:**
- Fixed size: 150px × 100px (or proportional to canvas aspect)
- Position: `absolute; bottom: 16px; right: 16px;`
- Background: Semi-transparent dark (#1e1e2e with 90% opacity)
- Border: 1px solid #45475a, rounded corners

**Content:**
- Blocks shown as colored rectangles (no details)
- Colors match block category (same as node headers)
- Connection lines shown as thin lines

**Viewport Indicator:**
- Rectangle showing current visible area
- Style: 1px solid #89b4fa, semi-transparent fill
- Click inside minimap: center viewport on that location
- Drag viewport indicator: pan the viewport

**Scale Calculation:**
```typescript
// Calculate bounds of all blocks
const bounds = calculateBounds(graph.blocks); // min/max x/y

// Scale minimap to fit all blocks with padding
const minimapScale = Math.min(
  minimapWidth / (bounds.width + padding),
  minimapHeight / (bounds.height + padding)
);
```

---

### 4. BlockNode.svelte (MODIFY)

**Purpose:** Add collapse capability to nodes.

**Changes:**

1. **Add collapse button to header:**
```svelte
<div class="header" onclick={handleHeaderClick}>
  <span class="icon">{definition?.icon}</span>
  <span class="title">{definition?.displayName}</span>
  <button class="collapse-btn" onclick={handleCollapseClick}>
    {block.collapsed ? '▼' : '▲'}
  </button>
</div>
```

2. **Conditional body rendering:**
```svelte
{#if !block.collapsed}
  <div class="body">
    <!-- Content preview -->
  </div>
{/if}
```

3. **Collapse event:**
```typescript
function handleCollapseClick(e: MouseEvent) {
  e.stopPropagation();
  onCollapse?.();
}
```

4. **Ports remain visible when collapsed:**
- Ports should be positioned relative to header
- Collapsed nodes still have ports at same relative positions

**Collapsed Visual:**
- Height reduced to ~40px (header only)
- Collapse button shows "▼" (pointing down, indicating content hidden)
- Expanded shows "▲" (pointing up, indicating content visible)

---

### 5. BlockBuilder.svelte (REBUILD)

**Purpose:** Full-screen container with floating panels.

**Structure:**
```svelte
<script lang="ts">
  import { viewportStore } from '$lib/stores/viewport';
  
  let { graph, onBlockAdd, onBlockSelect, onBlockMove, onBlockConfigChange, selectedBlockId }: Props = $props();
  
  let previewCollapsed = $state(false);
  let editingBlock: BlockInstance | null = $state(null);
</script>

<div class="block-builder h-screen flex flex-col bg-mantle">
  <!-- Toolbar at top -->
  <Toolbar 
    class="h-10 shrink-0"
    zoom={$viewportStore.scale}
    onZoomIn={() => viewportStore.zoomIn()}
    onZoomOut={() => viewportStore.zoomOut()}
    onFitView={() => viewportStore.fitToContent(graph.blocks, canvasWidth, canvasHeight)}
    onResetView={() => viewportStore.reset()}
  />
  
  <!-- Main canvas area -->
  <div class="flex-1 relative overflow-hidden" bind:clientWidth={canvasWidth} bind:clientHeight={canvasHeight}>
    <!-- Canvas fills entire area -->
    <BlockCanvas 
      class="absolute inset-0"
      {graph}
      {selectedBlockId}
      onBlockSelect={handleBlockSelect}
      onBlockMove={handleBlockMove}
      onBlockDoubleClick={handleBlockDoubleClick}
      onBlockCollapse={handleBlockCollapse}
      onAddBlock={handleAddBlockAtPosition}
    />
    
    <!-- Preview panel docks on right, collapsible -->
    <div 
      class="absolute right-0 top-0 bottom-0 transition-all duration-300"
      style="width: {previewCollapsed ? '40px' : '320px'};"
    >
      {#if previewCollapsed}
        <button 
          class="w-full h-full flex items-center justify-center bg-surface1 border-l border-surface2"
          onclick={() => previewCollapsed = false}
        >
          <span class="text-sm writing-mode-vertical">Preview</span>
        </button>
      {:else}
        <div class="h-full flex flex-col bg-surface1 border-l border-surface2">
          <div class="flex items-center justify-between px-4 py-2 border-b border-surface2">
            <h3 class="text-sm font-semibold text-text">Preview</h3>
            <button onclick={() => previewCollapsed = true}>◀</button>
          </div>
          <BlockPreview {graph} class="flex-1 overflow-hidden" />
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Editor Modal (existing, unchanged) -->
{#if editingBlock}
  <!-- ... existing modal code ... -->
{/if}
```

**Layout Notes:**
- Canvas gets `clientWidth`/`clientHeight` bindings for minimap and fit-to-view
- Preview panel slides between 320px and 40px width
- Preview panel has its own collapsible toggle

---

### 6. BlockPreview.svelte (MODIFY)

**Purpose:** Show generated prompt with token count.

**Changes:**

1. **Add token count display:**
```svelte
<div class="preview-header">
  <span>Live Preview</span>
  <span class="token-count">{tokenCount} tokens</span>
</div>
```

2. **Token counting:**
```typescript
import { countTokens } from '$lib/utils/tokenizer';

const previewText = $derived(generatePreviewText(graph));
const tokenCount = $derived(countTokens(previewText));
```

3. **Improved preview formatting:**
- Show which blocks contribute (with visual indicators)
- Highlight active toggles
- Show conditionals that evaluated true/false

---

### 7. Tokenizer Utility (NEW)

**Purpose:** Approximate token counting for preview.

**Implementation:**
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

**Note:** For production, consider integrating `js-tiktoken` or similar library for accurate token counts matching the target LLM's tokenizer.

---

### 8. ContextMenu.svelte (NEW)

**Purpose:** Show contextual actions on right-click.

**Props:**
```typescript
interface Props {
  x: number;
  y: number;
  type: 'canvas' | 'node' | 'port';
  blockId?: string;  // For node/port context
  portId?: string;   // For port context
  onAction: (action: string, data?: any) => void;
  onClose: () => void;
}
```

**Menu Items:**

**Canvas context:**
- Add Block → submenu with categories
- Paste (if clipboard has blocks)
- Select All
- Clear Canvas

**Node context:**
- Edit (same as double-click)
- Duplicate
- Collapse / Expand
- Delete
- Copy

**Port context:**
- Disconnect All (remove all connections from this port)

**Visual Design:**
- Background: `#313244`
- Border: `1px solid #45475a`
- Border-radius: `8px`
- Shadow: `0 4px 16px rgba(0,0,0,0.4)`
- Padding: `4px`
- Item height: `32px`
- Hover: `#45475a`

**Implementation:**
```svelte
<script lang="ts">
  let { x, y, type, blockId, portId, onAction, onClose }: Props = $props();
  
  // Close on click outside or Escape key
  function handleClickOutside(e: MouseEvent) {
    onClose();
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} />

<div 
  class="context-menu fixed bg-surface1 border border-surface2 rounded-lg shadow-lg p-1 z-50"
  style="left: {x}px; top: {y}px;"
  onclick={(e) => e.stopPropagation()}
>
  {#if type === 'canvas'}
    <MenuItem onclick={() => onAction('add-block')}>Add Block...</MenuItem>
    <MenuItem disabled={!hasClipboard}>Paste</MenuItem>
    <Divider />
    <MenuItem onclick={() => onAction('select-all')}>Select All</MenuItem>
    <MenuItem onclick={() => onAction('clear')}>Clear Canvas</MenuItem>
  {:else if type === 'node'}
    <MenuItem onclick={() => onAction('edit', { blockId })}>Edit</MenuItem>
    <MenuItem onclick={() => onAction('duplicate', { blockId })}>Duplicate</MenuItem>
    <MenuItem onclick={() => onAction('collapse', { blockId })}>
      {block?.collapsed ? 'Expand' : 'Collapse'}
    </MenuItem>
    <Divider />
    <MenuItem onclick={() => onAction('copy', { blockId })}>Copy</MenuItem>
    <MenuItem onclick={() => onAction('delete', { blockId })} variant="danger">Delete</MenuItem>
  {:else if type === 'port'}
    <MenuItem onclick={() => onAction('disconnect', { blockId, portId })}>Disconnect All</MenuItem>
  {/if}
</div>
```

---

### 9. Toolbar.svelte (MODIFY)

**Purpose:** Add zoom controls and navigation actions.

**Additions:**

```svelte
<div class="toolbar flex items-center gap-2 px-4 py-2 bg-surface1 border-b border-surface2">
  <!-- Existing controls -->
  <button onclick={onUndo}>↩️ Undo</button>
  <button onclick={onRedo}>↪️ Redo</button>
  
  <div class="flex-1"></div>
  
  <!-- Zoom controls -->
  <button onclick={onZoomOut}>−</button>
  <span class="zoom-level">{Math.round(zoom * 100)}%</span>
  <button onclick={onZoomIn}>+</button>
  
  <!-- View controls -->
  <button onclick={onFitView}>Fit View</button>
  <button onclick={onResetView}>Reset View</button>
  
  <!-- Actions -->
  <button onclick={onSave}>💾 Save</button>
</div>
```

---

### 10. ConnectionLayer.svelte (MODIFY)

**Purpose:** Work correctly with viewport transform.

**Changes:**
- Connections are now rendered inside the transform layer
- No coordinate changes needed - they use canvas coordinates
- SVG positioned at (0, 0) in canvas space, with enough size to cover all connections

```svelte
<svg 
  class="absolute pointer-events-none"
  style="left: -10000px; top: -10000px; width: 20000px; height: 20000px;"
>
  <!-- Connections use canvas coordinates directly -->
</svg>
```

---

## Type Updates

### BlockInstance

```typescript
interface BlockInstance {
  id: string;
  type: BlockType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  collapsed?: boolean;  // NEW: collapse state
}
```

---

## Implementation Tasks

### Phase 3 Tasks (8 total):

1. **Rebuild Viewport Store** - Create proper zoom/pan state with coordinate conversion
2. **Rebuild BlockCanvas** - Add viewport transform, zoom/pan handlers
3. **Create Minimap** - New component with scaled graph view
4. **Rebuild BlockBuilder** - Full-screen layout with floating panels
5. **Add Collapse to Nodes** - Collapse button, collapsed state rendering
6. **Create ContextMenu** - Right-click menu for canvas and nodes
7. **Enhance Preview Panel** - Token count, collapsible, improved formatting
8. **Update Toolbar** - Zoom controls, fit-to-view, reset view

---

## Success Criteria

1. **Navigation:**
   - Mouse wheel zooms centered on cursor
   - Dragging empty space pans the canvas
   - Minimap shows entire graph, click to navigate

2. **Layout:**
   - Canvas fills viewport height (no fixed 500px)
   - Preview panel docks on right, collapsible to 40px bar
   - All panels work correctly at different zoom levels

3. **Node Behavior:**
   - Collapse button in header toggles collapse state
   - Collapsed nodes show header and ports only
   - Collapse state persists in graph state

4. **Context Menu:**
   - Right-click on canvas shows canvas actions
   - Right-click on node shows node actions
   - Actions execute correctly

5. **Preview Panel:**
   - Shows generated prompt text
   - Shows approximate token count
   - Collapses to thin bar, expands smoothly

---

## Technical Notes

### Viewport Transform

The key learning from Phase 1: viewport transforms must be consistent across:
- Block positions (CSS transform on wrapper)
- Connection layer (CSS transform on SVG container)
- Mouse event coordinate conversion (screen to canvas)

**Pattern:**
```svelte
<div class="transform-layer" style="transform: translate({offsetX}px, {offsetY}px) scale({scale})">
  <ConnectionLayer ... />
  {#each blocks as block}
    <div style="position: absolute; left: {block.x}px; top: {block.y}px;">
      <BlockNode ... />
    </div>
  {/each}
</div>
```

All children use canvas coordinates. The parent transform handles the conversion to screen space.

### Minimap Performance

For graphs with 100+ blocks, minimap should:
- Use simplified rendering (rectangles, no text)
- Throttle updates during pan/zoom (update at most every 100ms)
- Use canvas element instead of SVG for better performance

---

**Spec complete. User should review before proceeding to implementation plan.**
