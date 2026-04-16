# Scratch-Style Block Prompt Builder Design

## Overview

Replace the existing graph-based Block Builder with a Scratch-style visual programming interface. Blocks snap together vertically and can nest within slots, eliminating the complexity of port-based connections.

## Data Model

### Core Types

```typescript
interface ScratchBlock {
  id: string;
  type: BlockType;
  config: BlockConfig;
  slots: Record<string, ScratchBlock | null>;  // Named input slots (nested blocks)
  next: ScratchBlock | null;                   // Vertical stack chain
}

interface ScratchScript {
  id: string;
  name: string;
  root: ScratchBlock;  // First block in the chain
}

type BlockType = 
  | 'TextBlock' 
  | 'FieldBlock' 
  | 'MemoryBlock' 
  | 'LorebookBlock'
  | 'IfBlock' 
  | 'ToggleBlock' 
  | 'SwitchBlock'
  | 'MergeBlock';
```

### Key Differences from Previous Model

- No separate `Connection` entities - connections are structural (parent-child, next)
- No `position` coordinates - layout is automatic based on tree structure
- `slots` replace input ports - each slot has a name and accepts one nested block

## Block Shapes & Connectors

### Shape Categories

| Type | Connector Shape | Visual |
|------|-----------------|--------|
| `text` | Rounded bubble | `(text)` |
| `boolean` | Pointed hexagon | `<bool>` |
| `number` | Rounded with # | `(#) ` |
| `list` | Rounded list icon | `[list]` |

### Block Categories

| Category | Block Shape | Color |
|----------|-------------|-------|
| Foundation | Rectangular with bottom notch | Blue `#89b4fa` |
| Logic | C-shaped (wrap around blocks) | Pink `#f38ba8` |
| Data | Rectangular with rounded slots | Green `#a6e3a1` |
| Structure | C-shaped with multiple slots | Teal `#94e2d5` |

### If Block Example

```
┌─────────────────────────┐
│ if <condition> then     │  ← boolean slot (pointed)
│ ┌─────────────────────┐ │
│ │ (nested blocks)     │ │  ← C-shape body
│ └─────────────────────┘ │
│ else                    │
│ ┌─────────────────────┐ │
│ │ (nested blocks)     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

## Block Definitions

### Foundation Blocks (output only - no slots)

| Block | Output Type | Config |
|-------|-------------|--------|
| Text | text | `content: string` |
| Field | text | `fieldType: string, fallback: string` |
| Memory | list | `count: number, threshold: number, format: 'bullet' | 'paragraph'` |
| Lorebook | list | `activationMode: string, maxEntries: number, format: 'bullet' | 'paragraph'` |

**Note:** List outputs are automatically converted to text using the configured format when used in text slots.

### Logic Blocks (C-shaped wrappers or multi-slot)

| Block | Slots | Output |
|-------|-------|--------|
| If | `condition: boolean`, `then: ScratchBlock`, `else: ScratchBlock` | text |
| Toggle | none (config-based) | boolean |
| Switch | `variable: text`, `cases: config[]` | text |
| Merge | `input1: text`, `input2: text`, `input3: text` | text |

**Note:** The `then` and `else` slots in If block accept a single block that serves as the root of a chain. The entire chain is executed when that branch is taken.

## Workspace UI

### Layout

Full-screen canvas with collapsible preview panel on the right side.

```
┌─────────────────────────────────────────────────────────────────┐
│  [≡] Prompt Builder                              [Preview ▶] [Save]│
├─────────────────────────────────────────────────────────────────┤
│ ┌──────┐                                                        │
│ │ 📄   │                                                        │
│ │ Text │    ┌─────────────────────────────────┐                │
│ ├──────┤    │ 📄 Text Block                    │                │
│ │ 🏷️   │    │   "You are {{char.name}}..."     │                │
│ │ Field│    └─────────────────────────────────┘                │
│ ├──────┤                    ↓ notch                             │
│ │ 💾   │    ┌─────────────────────────────────┐                │
│ │Memory│    │ 🔀 If <toggle> then             │   ┌──────────┐ │
│ ├──────┤    │   ┌───────────────────────┐    │   │ Preview  │ │
│ │ 📚   │    │   │ (nested blocks)       │    │   │──────────│ │
│ │Lore  │    │   └───────────────────────┘    │   │You are   │ │
│ ├──────┤    │   else                        │   │Alice...  │ │
│ │ 🔀   │    │   ┌───────────────────────┐    │   │          │ │
│ │ If   │    │   │ (else blocks)         │    │   │Tokens:   │ │
│ └──────┘    │   └───────────────────────┘    │   │127       │ │
│  Palette    └─────────────────────────────────┘   └──────────┘ │
│                                                      [ ◀ Close] │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **BlockPalette** - Left sidebar with categorized blocks to drag
2. **ScratchCanvas** - Main workspace where blocks are assembled
3. **ScratchBlock** - Individual block component with shaped connectors
4. **PreviewPanel** - Right panel showing assembled prompt + token count (collapsible)

### Interactions

- **Drag from palette** → drop on canvas creates new root block
- **Drag onto slot** → nests block as input
- **Drag onto notch** → appends block to chain
- **Right-click block** → context menu (duplicate, delete)
- **Double-click text blocks** → inline edit
- **Preview toggle** → button in top bar opens/closes right panel

## Execution Engine

### Tree Traversal

```typescript
function execute(block: ScratchBlock): string {
  switch (block.type) {
    case 'TextBlock':
      return block.config.content;
    
    case 'FieldBlock':
      return getCharacterField(block.config.fieldType) ?? block.config.fallback;
    
    case 'IfBlock':
      const condition = execute(block.slots.condition);
      if (isTruthy(condition)) {
        return executeChain(block.slots.then);
      }
      return executeChain(block.slots.else);
    
    case 'MergeBlock':
      const inputs = ['input1', 'input2', 'input3']
        .map(slot => block.slots[slot])
        .filter(Boolean)
        .map(execute)
        .filter(Boolean);
      return inputs.join(block.config.separator);
    
    case 'MemoryBlock':
      const memories = fetchMemories(block.config.count, block.config.threshold);
      return formatList(memories, block.config.format);
    
    case 'LorebookBlock':
      const entries = fetchLorebook(block.config.maxEntries);
      return formatList(entries, block.config.format);
    
    case 'ToggleBlock':
      return getToggleValue(block.config.toggleId, block.config.defaultValue);
    
    case 'SwitchBlock':
      const variable = execute(block.slots.variable);
      return matchCase(variable, block.config.cases, block.config.defaultCase);
  }
}

function executeChain(block: ScratchBlock | null): string {
  if (!block) return '';
  const current = execute(block);
  const next = executeChain(block.next);
  return current + (next ? '\n' + next : '');
}
```

### Execution Order

1. Start from script root
2. Execute each block in the chain (via `next`)
3. For blocks with slots, recursively execute nested blocks
4. Concatenate text outputs with appropriate separators

## Migration Path

1. Create new types in `src/lib/types/scratch-blocks.ts`
2. Create new components in `src/lib/components/scratch/`
3. Create new execution engine in `src/lib/blocks/scratch-executor.ts`
4. Keep existing block system for backward compatibility
5. Add migration utility to convert old graph format to new tree format
6. Replace BlockBuilder page to use new Scratch system

## Files to Create/Modify

### New Files

- `src/lib/types/scratch-blocks.ts` - Type definitions
- `src/lib/stores/scratch-script.ts` - Store for managing scripts
- `src/lib/blocks/scratch-executor.ts` - Execution engine
- `src/lib/blocks/scratch-definitions.ts` - Block definitions with slot info
- `src/lib/components/scratch/ScratchBuilder.svelte` - Main builder component
- `src/lib/components/scratch/ScratchCanvas.svelte` - Canvas workspace
- `src/lib/components/scratch/ScratchBlock.svelte` - Block component
- `src/lib/components/scratch/BlockPalette.svelte` - Left palette
- `src/lib/components/scratch/SlotRenderer.svelte` - Renders shaped slots
- `src/lib/components/scratch/PreviewPanel.svelte` - Right preview panel

### Modified Files

- `src/lib/types/index.ts` - Export new types
- `src/routes/settings/prompt-builder/+page.svelte` - Use new ScratchBuilder
