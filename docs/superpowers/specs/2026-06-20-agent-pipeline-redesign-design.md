# Agent Pipeline Redesign — LIBRA-Inspired Architecture

## Overview

Replace the current 5-agent sequential pipeline with a LIBRA-inspired 3-phase system: **Extraction → Turn Maintenance → Injection**. The redesign reduces LLM calls from 5-10 per turn to 2, introduces delta detection for varied output, and makes memory recording reliable.

Inspired by LIBRA World Manager v3.6.0's combined turn maintenance approach and RisuAI Agent v5.3.1's resilience patterns.

## Problem Statement

The current agent system has fundamental issues:

1. **Memories not recorded** — MemoryAgent silently skips when embedding config is missing; extraction is batch-gated every 5 turns; all failures return empty with no logging
2. **Repetitive output** — DirectorAgent receives static prompts with no awareness of previous guidance; SceneStateAgent/CharacterStateAgent re-extract identical state every turn with no delta detection
3. **Too many LLM calls** — 5 agents × 2 phases = up to 10 calls per turn, most producing near-identical results
4. **No error visibility** — Every failure is silently swallowed
5. **Scattered state** — Scene states, character states, and memories stored in separate tables with no unified view

## Architecture

### Design Philosophy

LIBRA's key insight: combine multiple agent functions into fewer, smarter LLM calls. Instead of separate memory/director/scene/character agents, use two combined calls:

1. **Extraction** (after AI response) — single call extracts scene state, character states, events, facts, and changes
2. **Turn Maintenance** (before next generation) — single call produces narrative briefing, story author guidance, director guidance, and extraction correction

This produces varied output because each call receives the previous turn's results as context, creating a continuity chain.

### Unified Pipeline for Character and World Chat

Single pipeline handles both modes. World mode (`cardType === 'world'`) activates additional extraction dimensions (entities, relations, world rules) and additional injection sections, but uses the same 2-call structure.

### Pipeline Flow

```
User sends message
  → 1. Regex/triggers (unchanged)
  → 2. Lorebook matching (unchanged)
  → 3. Memory retrieval (vector search — feeds [Memory] section)
  → 4. Turn Maintenance call (single LLM call → produces guidance)
  → 5. Prompt assembly (preset with agent outputs + memory)
  → 6. Main model generation (streaming)
  → 7. Regex post-processing (unchanged)
  → 8. Extraction call (single LLM call → extracts state, stores memories)
  → 9. Triggers (unchanged)
  → 10. Final message
```

Progress indicator shows 4 steps: `memory-retrieval`, `turn-maintenance`, `generation`, `extraction`.

## Data Model

### SessionAgentState (unified per-session state)

```typescript
interface SessionAgentState {
  sessionId: string;
  lastExtraction: ExtractionSnapshot | null;
  lastTurnMaintenance: TurnMaintenanceOutput | null;
  entities: Record<string, EntityRecord>;
  relations: RelationRecord[];
  worldFacts: WorldFactRecord[];
  turnHistory: TurnSnapshot[];
  narrativeState: NarrativeState;
}
```

### ExtractionSnapshot

```typescript
interface ExtractionSnapshot {
  turnNumber: number;
  timestamp: number;
  scene: {
    location: string;
    characters: string[];
    atmosphere: string;
    timeOfDay: string;
    environmentalNotes: string;
  };
  characters: Record<string, CharacterSnapshot>;
  events: string[];
  newFacts: string[];
  changed: string[];
}

interface CharacterSnapshot {
  name: string;
  emotion: string;
  location: string;
  inventory: string[];
  health: string;
  notes: string;
}
```

### NarrativeState

```typescript
interface NarrativeState {
  currentArc: string;
  activeTensions: string[];
  recentDecisions: string[];
  nextBeats: string[];
  turnNumber: number;
}
```

### TurnMaintenanceOutput

```typescript
interface TurnMaintenanceOutput {
  narrativeBrief: string;
  correction: {
    shouldCorrect: boolean;
    reasons: string[];
    correctedEntities?: Partial<EntityRecord>[];
    correctedRelations?: Partial<RelationRecord>[];
  };
  storyAuthor: {
    currentArc: string;
    narrativeGoal: string;
    activeTensions: string[];
    nextBeats: string[];
    guardrails: string[];
    focusCharacters: string[];
    recentDecisions: string[];
  };
  director: {
    sceneMandate: string;
    requiredOutcomes: string[];
    forbiddenMoves: string[];
    emphasis: string[];
    targetPacing: 'slow' | 'normal' | 'fast';
    pressureLevel: 'low' | 'medium' | 'high';
    focusCharacters: string[];
  };
}
```

### Supporting Types

```typescript
interface EntityRecord {
  id: string;
  name: string;
  type: 'character' | 'location' | 'faction' | 'item' | 'other';
  description: string;
  attributes: Record<string, string>;
  lastUpdated: number;
}

interface RelationRecord {
  subjectId: string;
  objectId: string;
  relationType: string;
  description: string;
  lastUpdated: number;
}

interface WorldFactRecord {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  createdAt: number;
}

interface TurnSnapshot {
  turnNumber: number;
  extractionSummary: string;
  events: string[];
  timestamp: number;
}
```

## Phase 1: Extraction (after AI response)

### Extraction System Prompt

```
You are a memory extraction engine. Analyze the conversation and extract structured information.

You receive:
- The current conversation segment
- The previous extraction snapshot (for delta detection)

Extract:
1. Scene: location, characters present, atmosphere, time, environmental details
2. Characters: for each character mentioned — emotion, location, inventory, health, notes
3. Events: what happened this turn (plot points, actions, decisions)
4. New facts: new information about the world, characters, or relationships
5. Changes: what changed compared to the previous extraction

Output JSON only:
{
  "scene": { "location": "", "characters": [], "atmosphere": "", "timeOfDay": "", "environmentalNotes": "" },
  "characters": [{ "name": "", "emotion": "", "location": "", "inventory": [], "health": "", "notes": "" }],
  "events": ["what happened"],
  "newFacts": ["new information"],
  "changed": ["what changed vs previous extraction"]
}
```

### World Mode Expansion

When `cardType === 'world'`, additional extraction fields:
- `worldRules`: active world rules for current scene location
- `entities`: named entities beyond characters (factions, items, locations)
- `relations`: relationships between entities

### Failure Handling

1. Extraction LLM call fails → retry with simpler fallback prompt
2. JSON parse fails → attempt repair with dedicated repair prompt
3. Both fail → keep previous extraction snapshot, log error, inject reliability guard
4. Memory storage fails after successful extraction → log error, extraction snapshot still updates

### Memory Storage

Extracted events and facts are stored as memory records. If embeddings are configured, generate embeddings. If not, store without embeddings (memories retrievable by importance/recency, not vector similarity).

### Why This Fixes "Memories Not Recorded"

- No embedding config → extraction still runs, memories stored without embeddings
- No batch gating → extraction runs every turn
- Parse failures → repair prompt attempts recovery
- All failures logged, not silently swallowed

## Phase 2: Turn Maintenance (before next generation)

### Turn Maintenance System Prompt

```
You are LIBRA Turn Maintenance Optimizer.
Combine narrative briefing, story planning, director guidance, and extraction correction in one pass.

You receive:
- Current conversation context (recent messages)
- Current extraction snapshot (scene, characters, events)
- Current narrative state (arc, tensions, recent decisions)
- Character/World card data (personality, scenario, relevant lore)
- World mode: active world rules, entity relations

Do not invent canon. Only fix clear extraction mistakes.
If correction is unnecessary, return null for correction.

Output JSON:
{
  "narrativeBrief": "compact summary of current story situation",
  "correction": {
    "shouldCorrect": false,
    "reasons": [],
    "correctedEntities": [],
    "correctedRelations": []
  },
  "storyAuthor": {
    "currentArc": "",
    "narrativeGoal": "",
    "activeTensions": [""],
    "nextBeats": [""],
    "guardrails": [""],
    "focusCharacters": [""],
    "recentDecisions": [""]
  },
  "director": {
    "sceneMandate": "",
    "requiredOutcomes": [""],
    "forbiddenMoves": [""],
    "emphasis": [""],
    "targetPacing": "",
    "pressureLevel": "",
    "focusCharacters": [""]
  }
}
```

### Why This Produces Varied Output

1. **NarrativeBrief** forces the model to describe the specific current situation — no room for generic guidance
2. **CurrentArc + ActiveTensions** create turn-to-turn continuity — the model must evolve established tensions
3. **RecentDecisions** prevent repetition — the model sees what it previously suggested and must propose new beats
4. **Extraction snapshot** provides concrete current state — characters, locations, events are specific
5. **Card data** keeps guidance personality-aware — different characters produce different directorial choices

### Input Context

- Last N messages (configurable, default 6)
- Current extraction snapshot from Phase 1
- Previous turn maintenance output (for narrative continuity)
- Relevant character card fields (personality, scenario)
- World mode: active world rules, relevant lorebook entries

### Output Feeds Into

- **Injection**: formatted and injected into the prompt
- **NarrativeState**: persisted for next turn's continuity

## Phase 3: Injection

### Labeled Priority Sections

```
[Narrative Brief]
<current story situation summary>

[Story Author Guidance]
Current Arc: <arc>
Narrative Goal: <goal>
Active Tensions: <tension1>, <tension2>
Next Beats: <beat1>, <beat2>
Guardrails: <guardrail1>, <guardrail2>
Focus Characters: <char1>, <char2>

[Director Supervision]
Scene Mandate: <mandate>
Required Outcomes: <outcome1>, <outcome2>
Forbidden Moves: <forbidden1>
Emphasis: <emphasis1>
Target Pacing: <pacing>
Pressure Level: <pressure>

[Memory]
<retrieved memories from vector search>
```

### Reliability Guard

When turn maintenance fails:
```
[Reliability Guard]
One or more support subsystems failed this turn.
Respond conservatively: prioritize established continuity, avoid inventing new facts,
and prefer the currently visible scene evidence.
```

### Preset Integration

Current `PromptItemType` values remapped:
- `memory` → vector-retrieved memories
- `director` → Director section from turn maintenance
- `sceneState` → Scene portion of extraction snapshot
- `characterState` → Character states from extraction snapshot
- **NEW** `narrativeGuidance` → Story Author + Narrative Brief sections
- **NEW** `sectionWorld` → Active world rules for current scene (world mode)
- **NEW** `worldRelations` → Relevant entity relationships (world mode)

### Memory Injection

Separate from turn maintenance. Uses existing vector search via `findSimilarMemories()`. Now reliable because extraction actually stores memories.

## World Mode Extensions

### Extraction Phase (World Mode)

Additional extraction fields:
- `worldRules`: active rules for current location
- `entities`: named entities beyond characters
- `relations`: relationships between entities

### Turn Maintenance Phase (World Mode)

Additional context:
- World card data, active world rules, entity relations
- `storyAuthor.currentArc` spans world narrative
- `director.focusCharacters` may include world-controlled NPCs
- Additional output: `sectionWorld` — compact description of active world "slice"

### Injection (World Mode)

Additional sections:
- `[Section World]` — active world rules for current scene
- `[World Relations]` — relevant entity relationships

Character vs World is one pipeline with conditional expansion, not two separate code paths.

## Storage Changes

### Migration

- Drop `scene_states` and `character_states` tables
- Create `session_agent_state` table (sessionId TEXT PK, state TEXT JSON, updatedAt INTEGER)
- Keep existing `memories` + `embeddings` + `summaries` tables

### New Storage Module

Replaces `src/lib/storage/agent-states.ts`:

```typescript
// Key operations
loadSessionState(sessionId: string): Promise<SessionAgentState | null>
saveSessionState(sessionId: string, state: SessionAgentState): Promise<void>
deleteSessionState(sessionId: string): Promise<void>
```

## Error Handling

| Failure | Response |
|---------|----------|
| Vector search fails | Skip memory injection, continue without `[Memory]` section |
| Turn maintenance LLM call fails | Inject reliability guard, continue |
| Turn maintenance JSON parse fails | Attempt repair call, then reliability guard |
| Extraction LLM call fails | Keep previous extraction snapshot, retry next turn |
| Extraction JSON parse fails | Attempt repair call, then keep previous snapshot |
| Extraction succeeds but memory storage fails | Log error, extraction snapshot still updates |
| All embedding config missing | Store memories without embeddings, disable vector retrieval |

No silent failures. Every error logged with clear message. UI progress indicator shows which step failed.

## Model Configuration

Uses existing `modelSlots` system:
- Turn maintenance call → `director` slot (fallback: memory → chat → default)
- Extraction call → `memory` slot (fallback: chat → default)

## Files Changed

### Delete

- `src/lib/core/agents/agent-runner.ts`
- `src/lib/core/agents/memory-agent.ts`
- `src/lib/core/agents/director-agent.ts`
- `src/lib/core/agents/scene-state-agent.ts`
- `src/lib/core/agents/character-state-agent.ts`
- `src/lib/core/agents/narrative-consistency-agent.ts`
- `src/lib/core/agents/index.ts`
- `src/lib/types/agent.ts`
- `src/lib/types/agent-state.ts`
- `src/lib/storage/agent-states.ts`

### Create

- `src/lib/core/agents/agent-pipeline.ts` — new pipeline orchestrator
- `src/lib/core/agents/extraction.ts` — extraction phase logic
- `src/lib/core/agents/turn-maintenance.ts` — turn maintenance phase logic
- `src/lib/core/agents/injection.ts` — injection formatting
- `src/lib/core/agents/prompts.ts` — centralized prompt registry (LIBRA-style)
- `src/lib/core/agents/types.ts` — new type definitions
- `src/lib/storage/session-agent-state.ts` — unified state storage

### Rewrite

- `src/lib/core/chat/engine.ts` — new pipeline integration
- `src/lib/core/chat/prompt-assembler.ts` — new preset item types + injection
- `src/lib/types/prompt-preset.ts` — add `narrativeGuidance`, `sectionWorld`, `worldRelations`
- `src/lib/types/config.ts` — update `AgentSettings`
- `src/lib/types/index.ts` — update exports
- `src/lib/types/plugin.ts` — remove `AgentPlugin` interface
- `src/lib/plugins/registry.ts` — remove agent registration methods
- `src/lib/stores/agent-progress.ts` — 4-step pipeline
- `src/lib/components/AgentPipelineIndicator.svelte` — updated steps

### Preserve (minor updates)

- `src/lib/core/agents/agent-llm.ts` — `callAgentLLM` still used
- `src/lib/storage/memories.ts` — still used for vector memory storage
- `src/lib/core/embedding.ts` — still used for embeddings

### Tests

All agent tests rewritten:
- `tests/agents/` — new pipeline, extraction, turn maintenance, injection tests
- `tests/types/agent*.ts` — new type validation
- `tests/core/chat/prompt-assembler-agent.test.ts` — updated
- `tests/integration/agent-pipeline.test.ts` — updated
- `tests/integration/agent-prompt-integration.test.ts` — updated
- `tests/storage/agent-states.test.ts` — replaced with session state tests
- `tests/stores/agent-progress.test.ts` — updated
- `tests/core/presets/agent-preset-items.test.ts` — updated

## AgentSettings Configuration

```typescript
interface AgentSettings {
  enabled: boolean;
  turnMaintenance: {
    enabled: boolean;
    contextMessages: number;   // how many recent messages to include (default 6)
    tokenBudget: number;       // max tokens for turn maintenance output (default 2048)
  };
  extraction: {
    enabled: boolean;
    tokenBudget: number;       // max tokens for extraction output (default 1024)
    repairAttempts: number;    // how many times to retry parsing (default 1)
  };
  director: {
    mode: 'light' | 'strong' | 'absolute';
  };
  worldMode?: {
    extractEntities: boolean;
    extractRelations: boolean;
    sectionWorldInjection: boolean;
  };
}
```
