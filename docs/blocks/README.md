# Block-Based Prompt Builder

## Overview

The Block-Based Prompt Builder provides a visual, Scratch-like interface for creating dynamic prompts with conditional logic. It replaces RisuAI's CBS syntax with intuitive drag-and-drop blocks.

## Features

- **Visual Canvas**: Drag and drop blocks to build prompts
- **Live Preview**: Real-time output generation as you build
- **Logic Blocks**: If/Else conditions, toggles, switches - no syntax to learn
- **Export/Import**: Save as .tfrag (single block), .tchunk (cluster), or .tprompt (complete prompt)
- **Preset Migration**: Convert existing presets to blocks and back

## Quick Start

1. Open **Settings → Prompt Builder → Block Builder (Beta)** tab
2. Drag blocks from the palette onto the canvas
3. Connect blocks by dragging from output ports to input ports
4. See live preview update as you build
5. Save as .tprompt file or export to preset

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

## File Formats

- **.tprompt**: Complete prompt with all blocks and connections
- **.tchunk**: Reusable block cluster
- **.tfrag**: Single block for sharing

## Migration from Presets

Existing presets can be converted to blocks:
1. Open preset in **Classic Presets** view
2. Click **Block Builder (Beta)** tab
3. Preset items become connected blocks
4. Add logic blocks to create conditional content
5. Export as .tprompt or switch back to Classic view

## Architecture

The block system consists of:

1. **Block Registry**: Manages block type definitions
2. **Execution Engine**: Traverses graph and executes blocks
3. **Canvas UI**: Visual workspace with drag-drop
4. **Live Preview**: Real-time output generation
5. **Serialization**: Export/import in multiple formats

## API Usage

```typescript
import { 
  registerAllBlocks,
  ExecutionEngine, 
  executeBlock,
  exportToTPrompt,
  presetToBlocks 
} from '$lib/blocks';

// Initialize block registry
registerAllBlocks();

// Create engine and execute graph
const engine = new ExecutionEngine({ execute: executeBlock });
const result = await engine.execute(graph, context);

// Export to .tprompt format
const file = exportToTPrompt('My Prompt', graph);

// Convert preset to blocks
const graph = presetToBlocks(preset);
```

## Development

### Adding New Block Types

1. Define block in `src/lib/blocks/definitions.ts`
2. Add executor in `src/lib/blocks/executors.ts`
3. Register in `registerAllBlocks()`

### Testing

```bash
npm test -- tests/blocks/
```
