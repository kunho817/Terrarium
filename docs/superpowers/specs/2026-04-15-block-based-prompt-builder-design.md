# Block-Based Prompt Builder Design Specification

**Date:** 2026-04-15  
**Status:** Approved  
**Scope:** Visual prompt building system replacing CBS syntax with Scratch-like blocks  

---

## 1. Executive Summary

The Block-Based Prompt Builder transforms Terrarium's prompt creation from text-based CBS syntax to an intuitive visual canvas. Users drag and connect blocks to create dynamic prompts with conditional logic, eliminating the need to learn syntax while enabling more complex prompt structures than RisuAI's CBS system.

### Key Differentiators from RisuAI
- **Visual**: No `{{if}}` syntax to memorize - logic is represented as connected nodes
- **Composable**: Save and reuse block fragments (`.tfrag`), clusters (`.tchunk`), or complete prompts (`.tprompt`)
- **Live Preview**: Real-time output generation as blocks are arranged
- **Migration Path**: Existing presets can be converted to blocks; blocks can be flattened to presets

---

## 2. Architecture

### 2.1 Three-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer: Visual Canvas (Svelte 5 + SVG)                   │
│  - Node rendering with drag-drop                            │
│  - Bezier connection lines                                  │
│  - Pan/zoom canvas controls                                 │
│  - Block palette sidebar                                    │
├─────────────────────────────────────────────────────────────┤
│  Logic Layer: Block Runtime Engine                          │
│  - Block registry (plugin-based extensibility)              │
│  - Port type system (text, boolean, number, list)         │
│  - Execution graph traversal (topological sort)           │
│  - Variable scope management                                │
├─────────────────────────────────────────────────────────────┤
│  Output Layer: Prompt Compiler                              │
│  - Graph → PromptFragment[] transformation                  │
│  - Toggle state resolution                                  │
│  - Variable substitution (existing template engine)         │
│  - Final prompt string assembly                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **User arranges blocks** on canvas → `BlockGraph` state
2. **Connections** define data flow between block ports
3. **Execution engine** traverses graph from output nodes backward
4. **Each block** produces a `PromptFragment` (text + metadata)
5. **Fragments merge** into final prompt based on toggle states
6. **Live preview** updates in real-time

### 2.3 File Format System

**`.tfrag`** - Single Block Export
```typescript
{
  "type": "fragment",
  "version": "1.0",
  "block": {
    "id": "text-uuid",
    "type": "TextBlock",
    "position": { "x": 100, "y": 100 },
    "config": {
      "content": "You are {{char}}...",
      "variables": ["char"]
    }
  }
}
```

**`.tchunk`** - Block Cluster Export
```typescript
{
  "type": "chunk",
  "version": "1.0",
  "name": "Creative Mode Enhancement",
  "description": "Adds creative flair when toggle is on",
  "blocks": [
    { "id": "toggle-1", "type": "ToggleBlock", ... },
    { "id": "if-1", "type": "IfBlock", ... },
    { "id": "text-1", "type": "TextBlock", ... }
  ],
  "connections": [
    { "from": "toggle-1.output", "to": "if-1.condition" },
    { "from": "if-1.true", "to": "text-1.input" }
  ],
  "toggles": [
    { "id": "creative-mode", "name": "Creative Mode", "defaultValue": false }
  ]
}
```

**`.tprompt`** - Complete Prompt Export
```typescript
{
  "type": "prompt",
  "version": "1.0",
  "name": "My Character Prompt",
  "description": "Full prompt with logic and memory integration",
  "blocks": [...],
  "connections": [...],
  "toggles": [...],
  "variables": [...],
  "metadata": {
    "author": "User",
    "createdAt": "2026-04-15T09:00:00Z",
    "tags": ["creative", "memory"]
  }
}
```

---

## 3. Block Types

### 3.1 Foundation Blocks

#### Text Block
- **Purpose**: Static or template-based text
- **Input Ports**: None (source node)
- **Output Ports**: `text` (string)
- **Config**: 
  - `content`: Text with `{{variables}}` support
  - `enabled`: Boolean (can be disabled without deleting)

#### Field Block
- **Purpose**: Link to preset fields (Jailbreak, Description, etc.)
- **Input Ports**: None
- **Output Ports**: `text` (string)
- **Config**:
  - `fieldType`: 'jailbreak' | 'description' | 'personality' | 'scenario' | ...
  - `fallback`: Text if field is empty

#### Memory Block
- **Purpose**: Inject retrieved memories
- **Input Ports**: `context` (optional, affects retrieval)
- **Output Ports**: `memories` (string[])
- **Config**:
  - `count`: Number of memories to retrieve (1-10)
  - `threshold`: Similarity threshold (0.0-1.0)
  - `format`: 'bullet' | 'paragraph' | 'numbered'

#### Lorebook Block
- **Purpose**: Inject lorebook entries
- **Input Ports**: None
- **Output Ports**: `entries` (string[])
- **Config**:
  - `activationMode`: 'keyword' | 'always'
  - `maxEntries`: Number (1-20)

### 3.2 Logic Blocks (CBS Replacement)

#### If Block
- **Purpose**: Conditional text inclusion
- **Input Ports**: 
  - `condition` (boolean, required)
  - `trueBranch` (text, optional - content if TRUE)
  - `falseBranch` (text, optional - content if FALSE)
- **Output Ports**: `result` (string)
- **Visual**: Two output branches (green=TRUE, red=FALSE)

#### Toggle Block
- **Purpose**: Reference named toggle state
- **Input Ports**: None
- **Output Ports**: `value` (boolean)
- **Config**:
  - `toggleId`: Reference to global or local toggle
  - `scope`: 'global' | 'local' | 'inherited'

#### Switch Block
- **Purpose**: Multiple conditional branches
- **Input Ports**:
  - `variable` (string/number to match)
  - Cases: `case1`, `case2`, ... (text)
- **Output Ports**: `result` (string)
- **Config**:
  - `cases`: Array of { value, label, default }
  - `defaultCase`: Text for no-match

#### Merge Block
- **Purpose**: Combine multiple text inputs
- **Input Ports**: `input1`, `input2`, `input3`, ... (text, variadic)
- **Output Ports**: `combined` (string)
- **Config**:
  - `separator`: String between merged texts ('\n\n', ' ', etc.)
  - `filterEmpty`: Boolean (skip empty inputs)

### 3.3 Data Blocks

#### Variable Block
- **Purpose**: Define or reference custom variables
- **Input Ports**: `value` (optional, sets variable)
- **Output Ports**: `reference` (variable value)
- **Config**:
  - `name`: Variable name
  - `defaultValue`: Default if not set
  - `scope`: 'block' | 'prompt' | 'global'

#### Loop Block
- **Purpose**: Iterate over lists (memories, lore entries)
- **Input Ports**: `list` (array)
- **Output Ports**: `result` (string)
- **Config**:
  - `template`: Text template using `{{item}}` and `{{index}}`
  - `separator`: Between iterations
  - `maxIterations`: Safety limit

#### Agent Block
- **Purpose**: Call agent and inject result
- **Input Ports**: `context` (string, optional)
- **Output Ports**: `result` (string)
- **Config**:
  - `agentId`: Which agent to call
  - `timeout`: Milliseconds
  - `fallback`: Text if agent fails

### 3.4 Structure Blocks

#### Group Block
- **Purpose**: Visual grouping of related blocks
- **Input/Output**: Pass-through (children connect directly)
- **Visual**: Container with title and color
- **Config**:
  - `title`: Group name
  - `color`: Hex color for header
  - `collapsed`: Boolean (minimize group)

#### Comment Block
- **Purpose**: Documentation/notes on canvas
- **No inputs/outputs** (decorative only)
- **Config**:
  - `text`: Comment content
  - `color`: Background color

---

## 4. UI/UX Design

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🧩 Block Builder                    [💾 Save] [📤 Export]      │
├─────────────────┬───────────────────────────────┬───────────────┤
│                 │                               │               │
│  BLOCK PALETTE  │        CANVAS AREA            │  LIVE PREVIEW │
│                 │      (Draggable Nodes)        │               │
│  Foundation     │                               │  Current     │
│  📄 Text        │   ┌─────────┐     ┌────────┐   │  Output:     │
│  🏷️ Field       │   │ Block 1 │────▶│ Block 2│   │              │
│  💾 Memory      │   └─────────┘     └────────┘   │  Generated   │
│                 │                               │  Prompt      │
│  Logic (CBS)    │   ┌───────────────────────┐    │  Here        │
│  🔀 If          │   │   Group Container     │    │              │
│  ⚙️ Toggle      │   │  ┌─────┐  ┌─────┐    │    │              │
│  📦 Switch      │   │  │Child│  │Child│    │    │              │
│  🔗 Merge       │   │  └─────┘  └─────┘    │    │              │
│                 │   └───────────────────────┘    │              │
│  Advanced       │                               │  ─────────── │
│  🤖 Agent       │   [Pan mode active]           │  Active      │
│  🔁 Loop        │   Scroll/Pinch to zoom        │  Toggles     │
│                 │                               │  🔘 Toggle 1 │
│  ─────────────  │                               │  🔘 Toggle 2 │
│                 │                               │              │
│  [Search...]    │                               │  [+ Add]     │
│                 │                               │               │
├─────────────────┴───────────────────────────────┴───────────────┤
│  [↩️ Undo] [↪️ Redo]        🔍 100%    [🖱️ Pan]  [🗑️ Clear]     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Block Visual Design

**Color Coding by Category:**
- 🔵 **Blue gradient** (#89b4fa → #74c7ec): Foundation blocks
- 🟣 **Purple gradient** (#cba6f7 → #f5c2e7): Logic/Toggle blocks
- 🔴 **Red gradient** (#f38ba8 → #eba0ac): If/Switch blocks
- 🟢 **Green gradient** (#a6e3a1 → #94e2d5): Merge/Data flow
- 🟡 **Yellow gradient** (#f9e2af → #fab387): Memory/Lorebook
- 🩵 **Cyan gradient** (#74c7ec → #b4befe): Advanced/Agent blocks

**Block Structure:**
```
┌──────────────────────────────────┐
│ 🎨 Header (icon + block type)    │  ← Gradient background, category color
├──────────────────────────────────┤
│                                  │
│   Configurable Content Area      │  ← User-editable content
│   (varies by block type)          │
│                                  │
├──────────────────────────────────┤
│ [input]                    [out]│  ← Ports (colored circles)
└──────────────────────────────────┘
```

**Port Types & Colors:**
- 🟢 Green: Text/String
- 🟣 Purple: Boolean
- 🔵 Blue: Number
- 🟡 Yellow: List/Array

### 4.3 Interactions

**Block Creation:**
1. User drags from palette → canvas
2. Block appears at drop position with default config
3. Block is immediately editable

**Connection Creation:**
1. Hover over output port → cursor changes
2. Click and drag → bezier line follows cursor
3. Drop on compatible input port → connection established
4. Incompatible ports highlight in red during drag

**Block Editing:**
- Double-click block → inline editor opens
- Click config icon → modal with full options
- Changes reflected in live preview immediately

**Canvas Navigation:**
- Mouse wheel: Zoom in/out (centered on cursor)
- Middle-drag / Space+drag: Pan canvas
- Minimap in corner for large graphs

### 4.4 Live Preview Panel

**Three View Modes:**
1. **Render View**: Formatted text with toggle state indicators
2. **Raw View**: Plain text output (copyable)
3. **Debug View**: Shows fragment breakdown with execution trace

**Toggle Testing:**
- All active toggles listed with switches
- Changing toggle updates preview instantly
- Shows which blocks are active/inactive visually

---

## 5. Integration with Existing Systems

### 5.1 Preset Migration Path

**Existing Preset → Block Graph:**
```typescript
function presetToBlocks(preset: PromptPreset): BlockGraph {
  // Convert each preset item to corresponding block
  // Jailbreak → Text Block with jailbreak content
  // Description → Field Block (type: 'description')
  // Memories → Memory Block
  // etc.
}
```

**Block Graph → Preset (Flatten):**
```typescript
function blocksToPreset(graph: BlockGraph, toggles: ToggleState): PromptPreset {
  // Execute graph with given toggle states
  // Collect text fragments in order
  // Assign to preset fields based on source blocks
}
```

### 5.2 Toggle System

**Global Toggles:**
- Stored in character/world metadata
- Available across all prompts for that entity
- Example: "Creative Mode", "SFW Mode", "Debug Output"

**Local Toggles:**
- Stored within `.tprompt` file
- Only affect that specific prompt
- Override global toggles with same name

**Toggle Block Behavior:**
```typescript
// Resolution order:
1. Check local scope (prompt-specific)
2. If not found, check global scope (character/world)
3. If not found, use default value from block config
```

### 5.3 Memory Integration

**Memory Block → Memory Agent:**
- Block retrieves memories via existing memory agent
- Uses current session context for embedding similarity
- Respects memory settings (top-k, threshold)

**Format Options:**
- **Bullet**: `- Memory content here`
- **Paragraph**: `Memory content here. Another memory.`
- **Numbered**: `1. Memory content` (useful for citations)

### 5.4 Agent System Integration

**Agent Block → Agent Runner:**
- Calls registered agents via agent-runner.ts
- Passes context from connected blocks
- Handles async execution with timeout
- Returns agent output as text

---

## 6. State Management

### 6.1 Block Graph State

```typescript
interface BlockGraph {
  version: '1.0';
  blocks: Block[];
  connections: Connection[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

interface Block {
  id: string;
  type: BlockType;
  position: { x: number; y: number };
  config: BlockConfig;
  collapsed?: boolean;
}

interface Connection {
  id: string;
  from: { blockId: string; portId: string };
  to: { blockId: string; portId: string };
}
```

### 6.2 Store Integration

**New Store: `blockBuilderStore`**
```typescript
interface BlockBuilderState {
  // Current graph being edited
  currentGraph: BlockGraph | null;
  
  // History for undo/redo
  history: BlockGraph[];
  historyIndex: number;
  
  // UI state
  selectedBlockId: string | null;
  paletteFilter: string;
  previewToggles: Record<string, boolean>;
  
  // Clipboard
  clipboard: Block[] | null;
}
```

### 6.3 Persistence

**Auto-save:**
- Save graph state every 30 seconds
- Save on significant actions (block add, connection, delete)
- Recovery mode for unsaved changes

**Storage:**
- `.tprompt` files in character/world folders
- Import/export to/from storage API

---

## 7. Error Handling

### 7.1 Validation Errors

**Real-time Validation:**
- Missing required connections highlighted in red
- Circular dependency detection
- Type mismatch on connection attempt

**Error Display:**
- Inline on block: red border + tooltip
- Error panel: list of all validation issues
- Prevent export/save until resolved

### 7.2 Runtime Errors

**Block Execution Failures:**
- Agent timeout → Use fallback text
- Memory retrieval error → Show error message in output
- Toggle reference not found → Use default value

**Error Boundaries:**
- Canvas errors caught and displayed
- Individual block errors don't crash entire graph

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Block Tests:**
- Each block type produces correct output
- Configuration changes reflected in output
- Edge cases (empty input, invalid config)

**Connection Tests:**
- Type compatibility validation
- Circular dependency detection
- Graph traversal order

### 8.2 Integration Tests

**Preset Migration:**
- Round-trip: Preset → Blocks → Preset (content preserved)
- Toggle behavior matches CBS logic

**End-to-End:**
- Build complex prompt with all block types
- Verify live preview accuracy
- Export/import preserves graph structure

### 8.3 User Testing

**Scenarios:**
1. Create simple prompt with one toggle
2. Recreate complex RisuAI CBS prompt in blocks
3. Export and share prompt with another user
4. Migrate existing preset to blocks and back

---

## 9. Implementation Phases

### Phase 1: Foundation (Core System)
- Block registry and base types
- Canvas UI with drag-drop
- Connection system
- Text, Field, Memory blocks

### Phase 2: Logic (CBS Replacement)
- If, Toggle, Switch, Merge blocks
- Toggle management UI
- Live preview panel
- Preset migration utilities

### Phase 3: Advanced (Power Features)
- Variable, Loop, Agent blocks
- Group and Comment blocks
- Import/export (.tfrag, .tchunk, .tprompt)
- Template library

### Phase 4: Polish
- Undo/redo system
- Canvas minimap
- Performance optimization
- User onboarding/tutorial

---

## 10. Open Questions (Post-MVP)

1. **Multi-output blocks**: Should If block have multiple true outputs?
2. **Custom blocks**: Allow users to create custom block types via JS?
3. **Collaboration**: Real-time collaborative editing of prompts?
4. **AI-assisted**: AI suggest block arrangements based on character description?

---

## 11. Related Documents

- [Plugin System Architecture](../../architecture/PLUGIN_SYSTEM.md)
- [Error Handling Architecture](../../architecture/ERROR_HANDLING.md)
- RisuAI Agent Reference: `docs/RisuAI.Agent.v5.3.1.js`
- Libra World Manager Reference: `docs/LIBRA_World_manager V3.6.0 re-DLBG커스텀.js`

---

**Next Step:** Implementation plan creation via `writing-plans` skill
