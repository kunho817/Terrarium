# Agent-Pipeline Integration Design

## Overview

Connect the existing agent system (MemoryAgent, DirectorAgent, SceneStateAgent, CharacterStateAgent) to the chat engine's prompt assembly pipeline. Agents run before prompt assembly, outputs are stored, and new PromptItem types read from stored outputs to inject agent context at user-configurable positions in the prompt.

## Goals

1. Enable agents to inject their outputs at configurable positions in the prompt preset
2. Persist scene/character state updates back to sceneStore after each turn
3. Minimal UI changes - just add new PromptItem types to preset system

## Non-Goals

- Dynamic token budget UI (deferred)
- Model context window fetching (deferred)
- Agent dashboard/debug UI (deferred)

## Architecture

### Data Flow

```
User sends message
    ↓
ChatEngine.send()
    ↓
AgentRunner.onBeforeSend(ctx) → AgentOutputs { memory, director, scene, character }
    ↓
assembleWithPreset(preset, { ...ctx, agentOutputs }) → Message[]
    ↓
resolveItem('memory') → reads agentOutputs.memory
resolveItem('director') → reads agentOutputs.director
resolveItem('sceneState') → reads agentOutputs.sceneState
resolveItem('characterState') → reads agentOutputs.characterState
    ↓
Provider.chat(messages)
    ↓
AgentRunner.onAfterReceive(ctx, response) → updates states, syncs to sceneStore
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent execution timing | Before prompt assembly | Clean separation, predictable order |
| Output positioning | Preset-integrated | Users control positions via PromptItem ordering |
| State persistence | Auto-persist to sceneStore | Seamless state management |
| UI scope | Minimal (item types only) | Low overhead, high flexibility |

## Type Changes

### PromptItem Type Additions

File: `src/lib/types/prompt-preset.ts`

```ts
type PromptItemType = 
  | 'memory'         // MemoryAgent output
  | 'director'       // DirectorAgent output  
  | 'sceneState'     // SceneStateAgent output
  | 'characterState' // CharacterStateAgent output
  | ...existing types
```

### AgentOutputs Interface

File: `src/lib/types/agent.ts`

```ts
interface AgentOutputs {
  memory?: string;
  director?: string;
  sceneState?: string;
  characterState?: string;
}
```

### AgentResult Extension

File: `src/lib/types/agent.ts`

```ts
interface AgentResult {
  injectPrompt?: string;
  updatedState?: StateUpdate;
  updatedMemories?: MemoryRecord[];
  lorebookWrites?: LorebookEntry[];
  // NEW: Individual agent outputs for preset integration
  memoryOutput?: string;
  directorOutput?: string;
  sceneOutput?: string;
  characterOutput?: string;
}
```

### AssemblyContext Extension

File: `src/lib/core/chat/prompt-assembler.ts`

```ts
interface AssemblyContext {
  card: CharacterCard;
  scene: SceneState;
  messages: Message[];
  lorebookMatches: LorebookEntry[];
  persona?: UserPersona;
  worldCard?: WorldCard;
  additionalPrompt?: string;
  outputLanguage?: string;
  // NEW: Pre-computed agent outputs
  agentOutputs?: AgentOutputs;
}
```

## Implementation Changes

### ChatEngine

File: `src/lib/core/chat/engine.ts`

**Current** (lines ~157-163):
```ts
const agentResult = await this.agentRunner.onBeforeSend({...});
if (agentResult.injectPrompt) {
  ctx.additionalPrompt = (ctx.additionalPrompt || '') + '\n\n' + agentResult.injectPrompt;
}
```

**New**:
```ts
const agentResult = await this.agentRunner.onBeforeSend({...});

// Store individual agent outputs for preset integration
const agentOutputs: AgentOutputs = {
  memory: agentResult.memoryOutput,
  director: agentResult.directorOutput,
  sceneState: agentResult.sceneOutput,
  characterState: agentResult.characterOutput,
};

// Pass to assembler via context (not additionalPrompt)
ctx.agentOutputs = agentOutputs;
```

**Remove**: The `additionalPrompt` concatenation is replaced by preset integration.

### AgentRunner

File: `src/lib/core/agents/agent-runner.ts`

**onBeforeSend change**: Collect individual agent outputs instead of combining into single string.

```ts
async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
  const combined: AgentResult = {};
  
  for (const agent of this.getAgentsByPriority()) {
    const result = await agent.onBeforeSend(ctx);
    
    // Collect individual outputs
    if (result.memoryOutput) combined.memoryOutput = result.memoryOutput;
    if (result.directorOutput) combined.directorOutput = result.directorOutput;
    if (result.sceneOutput) combined.sceneOutput = result.sceneOutput;
    if (result.characterOutput) combined.characterOutput = result.characterOutput;
    
    // Existing: state updates
    if (result.updatedState) {
      combined.updatedState = { ...combined.updatedState, ...result.updatedState };
    }
  }
  
  return combined;
}
```

**onAfterReceive change**: Auto-persist state updates to sceneStore.

```ts
async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
  const combined: AgentResult = {};
  
  for (const agent of this.getAgentsByPriority()) {
    const result = await agent.onAfterReceive(ctx, response);
    if (result.updatedState) {
      combined.updatedState = { ...combined.updatedState, ...result.updatedState };
    }
  }
  
  // NEW: Auto-persist scene state to sceneStore
  if (combined.updatedState?.scene) {
    const { sceneStore } = await import('$lib/stores/scene');
    sceneStore.update(state => ({ ...state, ...combined.updatedState.scene }));
  }
  
  return combined;
}
```

### PromptAssembler

File: `src/lib/core/chat/prompt-assembler.ts`

**New resolveItem cases**:

```ts
case 'memory': {
  const output = ctx.agentOutputs?.memory;
  if (!output) return null;
  return sysMsg(`[Memory]\n${output}`);
}

case 'director': {
  const output = ctx.agentOutputs?.director;
  if (!output) return null;
  return sysMsg(`[Director]\n${output}`);
}

case 'sceneState': {
  const output = ctx.agentOutputs?.sceneState;
  if (!output) return null;
  return sysMsg(`[Scene]\n${output}`);
}

case 'characterState': {
  const output = ctx.agentOutputs?.characterState;
  if (!output) return null;
  return sysMsg(`[Character States]\n${output}`);
}
```

### Agent Output Formatting

Each agent should format its output for prompt injection:

**MemoryAgent**: 
```
- Elara is afraid of fire (trait)
- The party visited the Crystal Caves (event)
- Kai trusts the innkeeper (relationship)
```

**DirectorAgent**:
```
Scene Mandate: Escalate tension with the innkeeper.
Required Outcomes: Party must acquire information.
Emphasis: Focus on Kai's nervous behavior.
```

**SceneStateAgent**:
```
Location: The Rusty Tankard Inn
Characters: Elara, Kai, Marcus
Atmosphere: Tense, suspicious
Time: Late evening
```

**CharacterStateAgent**:
```
Elara: alert, at the bar, carrying amulet, healthy
Kai: nervous, by the door, carrying pack, healthy
```

### Default Preset

File: `src/lib/stores/settings.ts` (or preset defaults)

Add agent items to default preset at positions 25-29 (after persona, before lorebook):

```ts
{ type: 'memory', enabled: true, position: 25 },
{ type: 'director', enabled: true, position: 27 },
{ type: 'sceneState', enabled: true, position: 28 },
{ type: 'characterState', enabled: true, position: 29 },
```

## Testing

### Unit Tests

| Test | File | Description |
|------|------|-------------|
| Agent output formatting | `tests/agents/*.test.ts` | Each agent produces correct output string |
| resolveItem agent types | `tests/prompt-assembler.test.ts` | New PromptItem types resolve correctly |
| Null output handling | `tests/prompt-assembler.test.ts` | Returns null when agent has no output |

### Integration Tests

| Test | File | Description |
|------|------|-------------|
| Full pipeline | `tests/integration/agent-pipeline.test.ts` | AgentRunner → ChatEngine → PromptAssembler |
| Output positioning | `tests/integration/agent-pipeline.test.ts` | Agent outputs appear at correct positions |
| State persistence | `tests/integration/agent-pipeline.test.ts` | State updates sync to sceneStore |

## Migration

### Backward Compatibility

- Existing presets without agent items: work unchanged (no agent outputs injected)
- `additionalPrompt` still works: can be used alongside agent items
- Agent toggle settings: respected (disabled agents produce no output)

### Migration Steps

1. Add new PromptItem types to type definition
2. Update PromptAssembler to handle new types
3. Update AgentRunner to collect individual outputs
4. Update ChatEngine to pass agentOutputs to assembler
5. Update default preset to include agent items
6. Add onAfterReceive state persistence

## Files Changed

| File | Change |
|------|--------|
| `src/lib/types/prompt-preset.ts` | Add memory, director, sceneState, characterState types |
| `src/lib/types/agent.ts` | Add AgentOutputs, extend AgentResult |
| `src/lib/core/chat/engine.ts` | Pass agentOutputs to assembler |
| `src/lib/core/agents/agent-runner.ts` | Collect individual outputs, persist states |
| `src/lib/core/chat/prompt-assembler.ts` | Handle new PromptItem types |
| `src/lib/stores/settings.ts` | Update default preset |
| `tests/agents/agent-prompt-integration.test.ts` | New integration tests |

## Open Questions

None - all decisions finalized through brainstorming.
