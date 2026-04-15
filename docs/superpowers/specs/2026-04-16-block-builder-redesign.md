# Block-Based Prompt Builder - Complete Design Specification

**Date:** 2026-04-16  
**Status:** Approved for Implementation  
**Priority:** Functional parity first, visual polish second  

---

## 1. Executive Summary

This specification defines the complete redesign of the Block-Based Prompt Builder to achieve functional parity with the visual mockup. The focus is on enabling core visual programming features: port-based connections, block editing, and canvas navigation, before adding visual polish.

### Key Principles
1. **Functional First**: Ports, connections, and editing must work before styling
2. **Scratch-Style Interaction**: Drag from output port to input port to connect
3. **Immediate Feedback**: Live preview line during drag, real-time execution
4. **Dual-Purpose UI**: Right panel shows Live Preview or Block Editor
5. **Infinite Canvas**: Mouse wheel zoom, Space+drag pan, fit-to-screen

---

## 2. Architecture

### 2.1 System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER (Svelte Components)                                │
├─────────────────────────────────────────────────────────────┤
│  BlockCanvas          - Infinite canvas with pan/zoom       │
│  ├── GridBackground    - Dot grid with transform support    │
│  ├── ConnectionLayer   - SVG connections + live preview     │
│  ├── BlockNode         - Individual block with ports        │
│  │   ├── BlockHeader   - Icon + name (colored by category) │
│  │   ├── Port          - Input/output connection points     │
│  │   └── ContentArea   - Preview of block content          │
│  └── DragOverlay       - Handles all drag operations        │
│  BlockPalette          - Left sidebar with block types       │
│  RightPanel            - Live Preview or Block Editor        │
│  Toolbar               - Zoom, fit-to-screen, reset         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  INTERACTION LAYER (State Machines)                          │
├─────────────────────────────────────────────────────────────┤
│  DragManager           - Handles 3 drag modes:            │
│                         1. Block drag (move position)       │
│                         2. Port drag (create connection)    │
│                         3. Canvas pan (Space+drag)          │
│  ConnectionManager     - Creates/validates/deletes         │
│  SelectionManager      - Selected block state              │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  STATE LAYER (Svelte Stores)                                 │
├─────────────────────────────────────────────────────────────┤
│  BlockBuilderStore     - Graph state (blocks, connections) │
│  ViewportStore         - Camera state (x, y, zoom)          │
│  SelectionStore        - Selected block ID                 │
│  ExecutionEngine       - Traverses graph, generates output │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **User drags from Port A to Port B**:
   - `DragManager` detects port drag start
   - Creates `LivePreviewLine` following cursor
   - On drop over valid port: `ConnectionManager.createConnection()`
   - Updates `BlockBuilderStore.connections`

2. **User double-clicks block**:
   - `SelectionManager.setSelected(blockId)`
   - `RightPanel` switches to Editor Mode
   - Form fields bind to `block.config`

3. **Graph changes**:
   - `BlockBuilderStore` notifies `ExecutionEngine`
   - `ExecutionEngine.execute()` generates new output
   - `RightPanel` updates Live Preview

---

## 3. Component Specifications

### 3.1 BlockNode Component

**Props Interface:**
```typescript
interface BlockNodeProps {
  block: BlockInstance;
  isSelected: boolean;
  viewport: ViewportState;
  
  // Event handlers
  onSelect: () => void;
  onDoubleClick: () => void;
  onDragStart: (e: MouseEvent) => void;
  onPortDragStart: (port: Port, e: MouseEvent) => void;
}
```

**Visual Structure:**
```
┌────────────────────────────────────────┐  ← width: 200px (fixed)
│┌──────────────────────────────────────┐│  ← header height: 32px
││ 🎨 Text Block              [×]        ││  ← icon (20px) + name + delete
│└──────────────────────────────────────┘│     background: category color
├────────────────────────────────────────┤
│ The quick brown fox jumps over...      │  ← content preview (truncate)
│                                        │     font: 12px, max 3 lines
├────────────────────────────────────────┤
│ ●                            ○ [out]  │  ← ports row height: 24px
└────────────────────────────────────────┘     ● = input, ○ = output
                                               input count: 0-3
                                               output count: 1-2
```

**Port Layout:**
- Input ports: Left edge, vertically centered
- Output ports: Right edge, vertically centered
- Port size: 12px diameter
- Port spacing: 20px between ports
- Port colors: Green (text), Purple (boolean), Yellow (list)

**Category Colors:**
- Foundation: #89b4fa (blue)
- Logic: #f38ba8 (red/pink)
- Data: #a6e3a1 (green)
- Structure: #94e2d5 (cyan)

### 3.2 Port Component

**Props Interface:**
```typescript
interface PortProps {
  port: PortDefinition;
  isInput: boolean;
  isConnected: boolean;
  onDragStart?: (e: MouseEvent) => void;
  onDragEnd?: (e: MouseEvent) => void;
}
```

**Visual:**
- Shape: Circle, 12px diameter
- Border: 2px solid surface2
- Fill: Port type color (or surface1 if disconnected)
- Glow: 4px box-shadow when hover/drag target

**Interaction:**
- Mouse down: Initiates connection drag (output ports only)
- Mouse enter while dragging: Highlight as drop target
- Mouse up while dragging: Create connection (if valid)

### 3.3 ConnectionLayer Component

**Responsibilities:**
- Renders all existing connections as SVG bezier curves
- Renders live preview line during port drag
- Calculates path coordinates from port positions

**Connection Path:**
```
Start: Output port position (absolute canvas coordinates)
End: Input port position (absolute canvas coordinates)
Control Points:
  cp1x = startX + 50 (curve outward from output)
  cp1y = startY
  cp2x = endX - 50 (curve inward to input)
  cp2y = endY

Path: M startX startY C cp1x cp1y, cp2x cp2y, endX endY
```

**Live Preview Line:**
- Appears on port drag start
- End point follows mouse cursor
- Stroke: Dashed, 2px, port color
- Arrow head: None during preview

### 3.4 BlockCanvas Component

**Viewport System:**
```typescript
interface ViewportState {
  x: number;      // Camera X position (center of view)
  y: number;      // Camera Y position (center of view)
  zoom: number;   // Scale factor (0.1 = 10%, 1.0 = 100%, 3.0 = 300%)
}
```

**Coordinate Systems:**
- **World Space**: Infinite canvas coordinates (where blocks exist)
- **Screen Space**: Pixels relative to canvas container
- Transform: `screen = (world - viewport) * zoom`

**Interaction Modes:**
1. **Default Mode**: 
   - Click: Select block
   - Double-click: Open editor
   - Drag block: Move block position
   
2. **Port Drag Mode** (activated on port mousedown):
   - Show live preview line
   - Highlight valid drop targets
   - Create connection on valid drop

3. **Pan Mode** (Space held or middle-click):
   - Drag moves viewport
   - Cursor: grab/grabbing

**Zoom Behavior:**
- Wheel up: Zoom in (×1.1 per tick, max 300%)
- Wheel down: Zoom out (÷1.1 per tick, min 10%)
- Zoom center: Mouse cursor position (not viewport center)

### 3.5 RightPanel Component

**Two Modes:**

**Mode A: Live Preview** (default, no selection)
```
┌─────────────────────────────┐
│ Live Preview           [?] │
├─────────────────────────────┤
│ Generated Output:          │
│ ┌─────────────────────────┐ │
│ │ You are {{char}}...     │ │  ← monospace, scrollable
│ │ Always be helpful.      │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ Fragment Breakdown:        │
│ 1. TextBlock (150 chars)   │
│ 2. IfBlock ✓ (included)     │
└─────────────────────────────┘
```

**Mode B: Block Editor** (block selected via double-click)
```
┌─────────────────────────────┐
│ Edit Text Block      [← Back│
├─────────────────────────────┤
│ Content:                   │
│ ┌─────────────────────────┐ │
│ │                         │ │  ← textarea
│ │ You are {{char}}...     │ │
│ │                         │ │
│ └─────────────────────────┘ │
│ [ ] Enabled                │  ← checkbox
├─────────────────────────────┤
│ Variables: {{char}}, {{user│
└─────────────────────────────┘
```

**Block Type Editors:**

**TextBlock Editor:**
- Content: Textarea (auto-expand, min 3 rows)
- Enabled: Toggle switch
- Variables detected: Show list below

**FieldBlock Editor:**
- Field Type: Dropdown (description, personality, scenario, jailbreak, etc.)
- Fallback: Textarea (content if field empty)

**IfBlock Editor:**
- No direct config (logic determined by connections)
- Shows: "Condition determined by input connection"

**ToggleBlock Editor:**
- Toggle ID: Text input
- Scope: Radio buttons (global/local)
- Default Value: Toggle switch

**MemoryBlock Editor:**
- Count: Number input (1-10)
- Threshold: Slider (0.0-1.0)
- Format: Dropdown (bullet/numbered/paragraph)

**LorebookBlock Editor:**
- Activation Mode: Dropdown (keyword/always)
- Max Entries: Number input (1-20)

### 3.6 Toolbar Component

**Buttons (left to right):**
1. **Undo** (←) - Disabled if no history
2. **Redo** (→) - Disabled if no future history
3. **Separator** (|)
4. **Zoom Out** (-)
5. **Zoom Level** (100%) - Click to reset
6. **Zoom In** (+)
7. **Separator** (|)
8. **Fit to Screen** (⌘) - Centers all blocks
9. **Reset View** (⌂) - Reset zoom to 100%, center origin

---

## 4. Interaction Specifications

### 4.1 Block Drag

**Trigger:** Mouse down on block body (not port)

**Behavior:**
1. Set `dragMode = 'block'`
2. Store `dragStartMouse = {x, y}`
3. Store `dragStartBlock = block.position`
4. On mouse move: Update `block.position`
   - `newX = dragStartBlock.x + (mouse.x - dragStartMouse.x) / zoom`
   - `newY = dragStartBlock.y + (mouse.y - dragStartMouse.y) / zoom`
5. On mouse up: Finalize position, save to store

### 4.2 Port Drag (Connection Creation)

**Trigger:** Mouse down on output port

**Behavior:**
1. Set `dragMode = 'port'`
2. Create `LivePreviewLine` from port position to mouse
3. On mouse move: Update line end point
4. Highlight valid input ports under mouse (same type, not same block)
5. On mouse up over valid port:
   - Create `Connection` object
   - Add to store
   - Remove live preview
6. On mouse up over invalid target: Cancel, remove live preview

### 4.3 Canvas Pan

**Trigger:** Space + mouse down, OR middle-click

**Behavior:**
1. Set `dragMode = 'pan'`
2. Store `dragStartMouse = {x, y}`
3. Store `dragStartViewport = {x, y}`
4. On mouse move: Update viewport
   - `viewport.x = dragStartViewport.x - (mouse.x - dragStartMouse.x) / zoom`
   - `viewport.y = dragStartViewport.y - (mouse.y - dragStartMouse.y) / zoom`
5. On mouse up: Finalize viewport

### 4.4 Zoom

**Trigger:** Mouse wheel

**Behavior:**
- Calculate zoom factor: `newZoom = currentZoom * (delta > 0 ? 1.1 : 0.9)`
- Clamp: `newZoom = clamp(newZoom, 0.1, 3.0)`
- Adjust viewport to zoom toward mouse cursor:
  ```
  viewport.x = mouseWorld.x - (mouseScreen.x / newZoom)
  viewport.y = mouseWorld.y - (mouseScreen.y / newZoom)
  ```

### 4.5 Selection

**Single Click on Block:**
- Set `selectedBlockId = block.id`
- Visual: Add border highlight (2px mauve)

**Double Click on Block:**
- Set `selectedBlockId = block.id`
- Set `rightPanelMode = 'editor'`

**Click on Canvas (empty area):**
- Clear `selectedBlockId = null`
- Set `rightPanelMode = 'preview'`

**Delete Key (when block selected):**
- Remove block from store
- Remove all connections to/from block
- Clear selection

---

## 5. State Management

### 5.1 BlockBuilderStore Updates

**Current Issues to Fix:**
1. Remove eager store subscriptions in components
2. Use direct subscriptions only when needed
3. Batch rapid updates (dragging)

**Optimized Pattern:**
```typescript
// Canvas subscribes directly for graph state
const graph = $derived($blockBuilderStore.currentGraph);

// BlockNode reads position from graph, not separate store
// Updates via callbacks to parent, not direct store mutation
```

### 5.2 Execution Throttling

**Current Issue:** LivePreview re-executes on every state change

**Fix:**
- Debounce execution by 100ms
- Use JSON.stringify comparison to detect meaningful changes
- Skip execution if graph structure unchanged

---

## 6. Implementation Phases

### Phase 1: Core Components (Functional Priority)

1. **BlockNode with Ports**
   - Create BlockNode.svelte with header, content preview, ports
   - Port component with visual states
   - Port layout calculation (input left, output right)

2. **Connection Creation**
   - Port drag detection
   - LivePreviewLine component
   - Drop target validation
   - Connection creation on valid drop

3. **Block Editing**
   - Side panel mode switching
   - TextBlock editor form
   - Config update binding

4. **Canvas Navigation**
   - Viewport store implementation
   - Zoom with mouse wheel
   - Pan with Space+drag
   - Coordinate transformation

### Phase 2: Polish (Visual Priority - Nice-to-Have)

5. **Visual Styling**
   - Colored block headers by category
   - Port hover effects
   - Connection animation
   - Grid background enhancement

6. **Advanced Features**
   - Undo/redo history
   - Minimap
   - Keyboard shortcuts
   - Context menus

---

## 7. Testing Strategy

### 7.1 Unit Tests

**BlockNode:**
- Renders with correct position
- Shows ports based on definition
- Calls onSelect on click
- Calls onDoubleClick on double-click

**Port:**
- Renders with correct color
- Calls onDragStart on mousedown
- Shows hover state

**ConnectionLayer:**
- Renders connections from store
- Calculates bezier paths correctly
- Shows live preview during drag

### 7.2 Integration Tests

**Connection Creation:**
- Drag from output to input creates connection
- Drag to invalid target cancels
- Connection appears in store

**Block Editing:**
- Double-click opens editor
- Form updates config
- Config reflects in execution

**Canvas Navigation:**
- Zoom changes viewport scale
- Pan moves viewport position
- Blocks render at correct screen positions

---

## 8. Open Questions / Decisions Needed

None at this time. All major design decisions have been approved:
- ✅ Functional parity priority
- ✅ Scratch-style drag-to-connect
- ✅ Live preview line
- ✅ Side panel editor on double-click
- ✅ Infinite canvas with zoom/pan

---

## 9. Success Criteria

The redesign is complete when:

1. **Users can create connections**: Drag from output port to input port
2. **Users can edit blocks**: Double-click opens editor, changes persist
3. **Canvas is navigable**: Zoom, pan, fit-to-screen all work
4. **Live preview updates**: Real-time output generation
5. **All 8 block types work**: Text, Field, Memory, Lorebook, If, Toggle, Switch, Merge
6. **Visual design matches mockup structure**: (polish can come later)

---

**Next Step:** Writing implementation plan via `writing-plans` skill
