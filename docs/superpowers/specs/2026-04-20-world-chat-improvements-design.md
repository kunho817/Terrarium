# World Chat Improvements

Date: 2026-04-20

## Overview

World Chat is the core feature of Terrarium — an AI narrator that writes a novel based on user input, as opposed to Character Chat which is 1:1 roleplay. This spec covers four sub-projects that transform the current basic World Chat into a full narrative engine.

**Core metaphor:** Character Chat is a novelist describing a 1:1 situation. World Chat is a novelist writing a full novel.

## Scope

Decomposed into four sub-projects, built in order:

1. **World Card Model + Editor** — Expanded data model and full editor overhaul
2. **World Chat Engine** — Narrator-style prompt assembly, per-world settings, multiple greetings
3. **Lua Scripting Engine** — Runtime, trigger system, variable persistence
4. **World-Aware Agents** — Multi-character scene tracking, fact/event memory, narrative consistency

---

## Sub-Project 1: World Card Model + Editor

### 1.1 Data Model Changes

#### WorldCharacter (expanded)

```typescript
interface WorldCharacter {
  id: string;
  name: string;
  description: string;
  personality: string;
  exampleMessages: string;
  avatar: string | null;           // path to image asset

  // Lorebook integration
  lorebookEntryIds: string[];      // link to specific lorebook entries

  // State tracking
  trackState: boolean;             // toggle: explicit state tracking on/off

  // Categorization
  tags: string[];
}
```

**Default values for new fields:**
- `personality`: `''`
- `exampleMessages`: `''`
- `avatar`: `null`
- `lorebookEntryIds`: `[]`
- `trackState`: `false`
- `tags`: `[]`

#### AlternateGreeting (new)

```typescript
interface AlternateGreeting {
  id: string;
  name: string;       // e.g. "Tavern start", "Forest encounter"
  content: string;    // the actual first message text
}
```

#### WorldScenario (new — wired to Lua engine in sub-project 3)

```typescript
interface WorldScenario {
  id: string;
  name: string;
  description: string;
  condition: string;    // Lua expression — evaluated in sub-project 3
  actions: string;      // Lua code block — executed in sub-project 3
  enabled: boolean;
}
```

#### WorldCard (expanded)

```typescript
interface WorldCard {
  // ... existing fields unchanged ...

  // Multiple first messages
  firstMessage: string;                    // backward compat, treated as default
  alternateGreetings: AlternateGreeting[]; // replaces string[]

  // Scenario hooks (wired in sub-project 3)
  scenarios: WorldScenario[];

  // Per-world settings overrides
  worldSettings?: WorldSettings;
}
```

#### WorldSettings (new)

```typescript
interface WorldSettings {
  providerId?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  agents?: {
    memory?: { enabled?: boolean; tokenBudget?: number };
    director?: { enabled?: boolean; tokenBudget?: number };
    sceneState?: { enabled?: boolean; tokenBudget?: number };
    characterState?: { enabled?: boolean; tokenBudget?: number };
    narrativeConsistency?: { enabled?: boolean; tokenBudget?: number };
  };
  loreSettings?: Partial<LorebookSettings>;
}
```

#### CharacterCard.alternateGreetings

Changes from `string[]` to `AlternateGreeting[]` to unify the greeting system across both chat types.

**Migration:** Existing `string[]` values converted to `AlternateGreeting[]` on load — each string becomes `{ id: uuid, name: 'Greeting N', content: originalString }`.

### 1.2 Editor Overhaul

#### Characters Tab

Full editing UI for each WorldCharacter:
- Name (text input)
- Description (multi-line textarea)
- Personality (multi-line textarea)
- Example messages (textarea with dialogue format guidance)
- Avatar picker (file dialog, preview thumbnail, stored in world directory)
- Lorebook linking (multi-select from world's lorebook entries)
- "Track state" toggle switch (controls whether scene agent tracks this character)
- Tags (comma-separated input)
- Reorder via up/down buttons

Add character: name + description (existing), plus personality field.

#### Lorebook Tab

Upgrades to the existing lorebook editor:
- **Folder/group support** — entries with `parentId` render as collapsible groups; "Add Folder" button creates a folder entry
- **Regex matching** — optional regex field per entry (alongside keywords)
- **Selective mode** — requires primary + secondary keywords both match
- **Token limit** — per-entry `tokenLimit` field
- **Activation percentage** — `activationPercent` random roll (0-100)
- **Embedding toggle** — `useEmbedding` checkbox + `embeddingThreshold` slider
- **Scan depth override** — per-entry override of global scan depth
- **Bulk operations** — select multiple entries, toggle enable/disable

#### Overview Tab

Add alternate greetings section:
- List of greetings with name + preview
- Add/edit/delete greeting
- Each greeting has: name (short label) + content (full message text)
- Default greeting indicated by badge

#### Scripts Tab (replaces placeholder)

- **Lua script editor** — textarea with basic syntax highlighting or monospace font + line numbers
- **Variable viewer** — shows current variables for the active session (read from scene variables)
- **Script test runner** — evaluate a Lua expression against current state, show result (requires sub-project 3 runtime)

For sub-project 1, the scripts tab shows the editor UI for regex scripts and triggers but defers Lua execution to sub-project 3. The test runner shows a "Lua engine not yet available" message.

#### System Tab

Add depth prompt editing:
- Depth prompt text area
- Depth position (number input for insertion position in message history)

#### New: Settings Tab

Per-world settings overrides. All fields optional — blank means "use global settings."
- Model override — dropdown of configured providers, plus model name input
- Temperature slider
- Top P slider
- Max tokens input
- Agent toggles — checkbox per agent (memory, director, sceneState, characterState, narrativeConsistency) + optional token budget override
- Lore settings — token budget, scan depth, recursive scanning, full word matching

---

## Sub-Project 2: World Chat Engine

### 2.1 Narrator-Style Prompt Assembly

When `cardType === 'world'`, the prompt assembler uses narrator mode:

**System prompt:** The world's `systemPrompt` field defines the narrator's voice, style, and rules. If empty, a default narrator prompt is used:

> You are a skilled novelist narrating an immersive story set in the world described below. Write in third person, describing events, dialogue, and the environment vividly. Respond to the user's actions by continuing the narrative naturally.

**Character lore injection:** `buildWorldCharacterLore()` converts world characters to lorebook entries. Enhanced to include:
- Personality as dialogue style reference
- Example messages as narrative voice samples
- Avatar description if available

**Scenario injection:** When a scenario is active, its description is injected as a system message before the chat history.

**World description position:** Dedicated prompt item position (after system prompt, before lorebook).

### 2.2 Per-World Settings Resolution

```typescript
function resolveEffectiveSettings(worldCard: WorldCard | undefined): ResolvedSettings {
  const global = get(settingsStore);
  if (!worldCard?.worldSettings) return global;

  return {
    providerId: worldCard.worldSettings.providerId ?? global.defaultProvider,
    model: worldCard.worldSettings.model ?? global.providers[global.defaultProvider]?.model,
    temperature: worldCard.worldSettings.temperature ?? global.temperature,
    topP: worldCard.worldSettings.topP ?? global.topP,
    maxTokens: worldCard.worldSettings.maxTokens ?? global.maxTokens,
    // Agent settings merge per-agent
    agents: mergeAgentSettings(global, worldCard.worldSettings.agents),
    loreSettings: { ...global.loreSettings, ...worldCard.worldSettings.loreSettings },
  };
}
```

Used by engine when `cardType === 'world'`. Called in `SendMessageOptions` resolution.

### 2.3 Multiple First Messages

**Session creation flow:**
1. User clicks "New Session" (or first session auto-creates)
2. If world has `alternateGreetings` with entries:
   - Show greeting picker modal: list of greeting names with content preview
   - User selects one → selected greeting becomes session's first message
   - If only one greeting exists, auto-select without modal
3. If no `alternateGreetings`, fall back to `firstMessage` field
4. Backward compatible: old `firstMessage` treated as default greeting

**Character Chat unification:** Same picker applies to Character Chat when `alternateGreetings` is non-empty. Character cards migrated from `string[]` to `AlternateGreeting[]` on load.

### 2.4 Greeting Picker Component

```svelte
<!-- GreetingPicker.svelte -->
<!-- Modal overlay showing alternate greetings -->
<!-- Each greeting shows: name, truncated content preview -->
<!-- Select button sets the chosen greeting -->
<!-- "Default" badge on first greeting -->
```

---

## Sub-Project 3: Lua Scripting Engine

### 3.1 Runtime

**Library:** `wasmoon` (Lua 5.4 via WASM) — actively maintained, fast, runs in browser/worker.

**Architecture:**

```
LuaRuntime (per-session, lazily initialized)
  ├── Lua VM instance (wasmoon)
  ├── Sandbox (restricted stdlib)
  ├── API bridge (exposed functions)
  └── Variable store (persisted via scene.variables)
```

### 3.2 Sandboxed Environment

Exposed to Lua scripts:

```lua
-- Variable access
get_var(name) -> value
set_var(name, value)
has_var(name) -> boolean

-- Scene queries
get_scene() -> { location, time, mood }
get_character(name) -> { location, status, mood } | nil

-- Message queries
last_message() -> string
message_count() -> number
user_name() -> string

-- Actions
inject_text(content, position)   -- inject into prompt
modify_scene(location, time, mood)
modify_character(name, field, value)
```

**Blocked:** file I/O, network (`io`, `socket`), `os.execute`, `os.getenv`, `require` (custom modules), `debug` library. Only safe stdlib: `math`, `string`, `table`.

### 3.3 Trigger System

```typescript
interface Trigger {
  id: string;
  name: string;
  event: 'on_message' | 'on_user_message' | 'on_ai_message' | 'on_scenario' | 'on_timer';
  condition: string;    // Lua expression returning boolean
  actions: string;      // Lua code block
  enabled: boolean;
  priority: number;     // execution order (lower = first)
}
```

**Event types:**
- `on_message` — any message (user or AI)
- `on_user_message` — user message only
- `on_ai_message` — AI response only
- `on_scenario` — scenario condition met (checked on session load and after variable changes)
- `on_timer` — periodic check (future: turn-based, fires every N turns)

### 3.4 Execution Flow

1. Event fires (e.g., user sends message)
2. Engine collects enabled triggers matching the event type
3. Sort by `priority` ascending
4. For each trigger:
   - Evaluate `condition` in Lua VM → skip if falsy
   - Execute `actions` in Lua VM
   - Collect mutations (scene changes, variable updates, text injections)
5. Apply all mutations atomically
6. Errors caught and logged — never crash the chat

### 3.5 Variable Persistence

Variables stored in `scene.variables` (existing field, already persisted per session).

**Load:** On session start, `LuaRuntime` hydrates variables from `scene.variables` into the Lua VM global state.

**Save:** After trigger execution, `LuaRuntime` extracts changed variables back to `scene.variables`. Persists via existing `sceneRepo.save()`.

### 3.6 Scenarios

A `WorldScenario` is a trigger with `event: 'on_scenario'`:

- Checked on session start and after variable changes
- `condition` is a Lua expression (e.g., `get_var("reputation") > 50 and get_var("chapter") == 3`)
- `actions` is a Lua code block that fires when condition becomes true
- Each scenario fires at most once per session (tracked in scene variables as `__scenario_fired_<id>`)

---

## Sub-Project 4: World-Aware Agents

### 4.1 Scene Agent — Multi-Character Tracking

**New state model for world chats:**

```typescript
interface WorldSceneState {
  location: string;
  time: string;
  mood: string;
  environmentalNotes: string;
  characterStates: Record<string, CharacterSceneState>;  // keyed by character name
}

interface CharacterSceneState {
  location: string;      // "tavern", "forest", "unknown"
  status: string;        // "present", "absent", "sleeping", "injured"
  mood: string;          // current emotional state
}
```

**Behavior:**
- Only populated for characters with `trackState: true`
- Agent prompt receives the character list with names and descriptions
- Agent reads the AI response and updates character states based on narrative changes
- If narrator says "Alice left for the forest", agent updates Alice's location to "forest" and status to "absent"
- Stored in SQLite alongside scene state, keyed by `sessionId + characterName`

**New prompt item:** `characterStates` — injects tracked character states as context for the AI, e.g.:

> Characters present: Alice (tavern, cheerful), Bob (forest, unknown)

### 4.2 Memory Agent — Fact vs Event Split

**New `MemoryType` classification:**

```typescript
type MemoryType = 'world_fact' | 'personal_event' | 'general';

// world_fact: "The capital Valdris is in the northern mountains"
// personal_event: "User helped Alice fix her cart"
// general: everything else (fallback)
```

**Agent prompt changes:** Includes categorization instructions. The agent classifies each extracted memory into one of three types.

**Retrieval strategy:**
- **World facts** — high retention, always retrieved when relevant (long-lived, low decay)
- **Personal events** — medium retention, retrieved by recency + relevance
- **General** — current behavior (standard cosine similarity retrieval)

**Storage:** `memoryType` column added to SQLite memories table. Migration adds `'general'` to existing rows.

**New agent output section:** Memory agent returns categorized memories with their types.

### 4.3 Narrative Consistency Agent (New)

```typescript
const narrativeConsistencyAgent: Agent = {
  id: 'narrative-consistency',
  name: 'Narrative Consistency',
  priority: 15,  // after scene-state (10), before director (20)
};
```

**Input:** Current scene state, recent memories (facts + events), the AI's draft response.

**Output:** Short correction notes injected into the prompt, or empty if consistent.

**Example output:**

> "Note: Alice was established as being in the forest. Do not describe her in the tavern unless travel is narrated."

**Behavior:**
- Only runs when `cardType === 'world'`
- Controlled by `worldSettings.agents.narrativeConsistency.enabled` (default: enabled)
- Runs after scene-state agent (gets updated character locations)
- Runs before director agent (director can override style but not facts)
- Checks: character in wrong location, contradicting established facts, breaking world rules from lorebook
- Output is advisory, not mandatory — the AI may still deviate, but the note reduces hallucination

### 4.4 Agent Priority Order (World Chat)

```
1.  memory-agent            (priority 5)  — extract + classify memories
2.  scene-state-agent       (priority 10) — update scene + character states
3.  narrative-consistency   (priority 15) — check for contradictions
4.  director-agent          (priority 20) — guide narrative direction
5.  character-state-agent   (priority 30) — update individual character state
```

---

## Implementation Order

Sub-projects built sequentially:

1. **World Card Model + Editor** — data model, editor UI, migration
2. **World Chat Engine** — narrator prompts, settings resolution, greeting picker
3. **Lua Scripting Engine** — wasmoon runtime, sandbox, triggers, scenarios
4. **World-Aware Agents** — multi-character scene, fact/event memory, consistency agent

Each sub-project gets its own spec → plan → implementation cycle.

## Dependencies

- Sub-project 2 depends on sub-project 1 (new types needed)
- Sub-project 3 is mostly independent (Lua runtime + trigger system)
- Sub-project 4 depends on sub-project 1 (trackState toggle) and sub-project 2 (world engine integration)

## Affected Files

### Sub-Project 1
- `src/lib/types/world.ts` — WorldCharacter, WorldCard, AlternateGreeting, WorldScenario, WorldSettings
- `src/lib/types/character.ts` — CharacterCard.alternateGreetings type change
- `src/lib/types/index.ts` — barrel exports
- `src/routes/worlds/[id]/edit/+page.svelte` — full editor overhaul
- `src/lib/storage/world-import.ts` — migration for new fields

### Sub-Project 2
- `src/lib/core/chat/prompt-assembler.ts` — narrator mode
- `src/lib/core/chat/engine.ts` — buildWorldCharacterLore enhancement, world settings resolution
- `src/lib/core/chat/use-chat.ts` — greeting picker integration
- `src/lib/core/chat/use-chat-helpers.ts` — resolveEffectiveSettings
- `src/lib/components/GreetingPicker.svelte` — new component

### Sub-Project 3
- `src/lib/core/lua/runtime.ts` — new file, LuaRuntime class
- `src/lib/core/lua/sandbox.ts` — new file, sandboxed environment
- `src/lib/core/lua/api-bridge.ts` — new file, exposed Lua functions
- `src/lib/core/lua/trigger-executor.ts` — new file, trigger evaluation + execution
- `src/lib/core/chat/engine.ts` — trigger integration points
- `src/routes/worlds/[id]/edit/+page.svelte` — scripts tab update

### Sub-Project 4
- `src/lib/core/agents/scene-state-agent.ts` — multi-character tracking
- `src/lib/core/agents/memory-agent.ts` — fact/event classification
- `src/lib/core/agents/narrative-consistency-agent.ts` — new file
- `src/lib/core/agents/agent-runner.ts` — register new agent
- `src/lib/storage/agent-states.ts` — character scene state storage
- `src/lib/storage/memories.ts` — memoryType column + migration
- `src/lib/types/agent-state.ts` — WorldSceneState, CharacterSceneState
- `src/lib/types/memory.ts` — MemoryType update
