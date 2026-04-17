# Agent-Based Architecture Design

## Overview

A multi-agent system that observes conversation, extracts structured information, maintains scene and character state, guides plot direction, and injects relevant context into the main chat prompt. Built on a sequential pipeline architecture with shared storage and dynamic token budgets.

## Architecture

### Core Agent Types

```ts
interface Agent {
  readonly id: string;
  readonly name: string;
  readonly priority: number;  // Execution order (lower = earlier)
  
  init(ctx: AgentContext): Promise<void>;
  onBeforeSend(ctx: AgentContext): Promise<AgentResult>;
  onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult>;
  shutdown(): Promise<void>;
}

interface AgentResult {
  injectPrompt?: string;           // Text to inject into main prompt
  updatedState?: StateUpdate;      // State changes to persist
  lorebookWrites?: LorebookEntry[]; // Data to write to lorebook
}

interface AgentContext {
  sessionId: string;
  cardId: string;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
  config: UserConfig;
}
```

### Agent Execution Order

Agents run in sequence by priority (lower = earlier in pipeline):

| Agent | Priority | Purpose |
|-------|----------|---------|
| MemoryAgent | 10 | Retrieves relevant memories from past |
| DirectorAgent | 20 | Plans scene direction and guidance |
| SceneStateAgent | 30 | Tracks location, atmosphere, environment |
| CharacterStateAgent | 40 | Tracks character states, inventory, emotions |

## Agents

### Memory Agent (Enhanced)

**Existing functionality**:
- Retrieves relevant memories via vector search
- Extracts facts from conversation every N turns
- Stores memories with embeddings

**Enhancements**:
- Uses dynamic token budget based on model context window
- Outputs structured `[Memory]` section for prompt injection

**Output format**:
```
[Memory]
- Elara is afraid of fire (trait)
- The party visited the Crystal Caves on day 3 (event)
- Kai trusts the innkeeper but suspects the merchant (relationship)
```

### Director Agent (New)

**Purpose**: Guides plot direction, enforces story beats, manages pacing

**Triggers**: Every turn (configurable)

**Model Slot**: `director` (falls back to `memory` → `chat`)

**Output JSON schema**:
```json
{
  "sceneMandate": "string - what must happen this turn",
  "requiredOutcomes": ["string - mandatory story beats"],
  "forbiddenMoves": ["string - what the AI must not do"],
  "emphasis": ["string - what to highlight"],
  "targetPacing": "slow|normal|fast",
  "pressureLevel": "low|medium|high"
}
```

**Output format**:
```
[Director]
Scene Mandate: Escalate tension with the innkeeper's suspicion.
Required Outcomes: Party must acquire information about the amulet.
Forbidden Moves: Do not resolve the theft subplot yet.
Emphasis: Focus on Kai's nervous behavior.
Target Pacing: slow
Pressure Level: high
```

**Director modes**:
- **Light**: Gentle guidance, allows natural flow
- **Strong**: Firm direction, enforces beats
- **Absolute**: Maximum control, hard constraints

### Scene State Agent (New)

**Purpose**: Tracks location, present characters, atmosphere, environmental conditions

**Triggers**: Every turn

**State structure**:
```ts
interface SceneState {
  location: string;
  characters: string[];      // Names of present characters
  atmosphere: string;        // Mood/tone of scene
  timeOfDay: string;
  environmentalNotes: string;
  lastUpdated: number;
}
```

**Output format**:
```
[Scene]
Location: The Rusty Tankard Inn, common room
Characters: Elara, Kai, Innkeeper Marcus
Atmosphere: Tense, suspicious glances
Time: Late evening
Environment: Fire crackling in the hearth, smell of ale
```

**State extraction**:
- Analyzes response for location changes
- Detects character arrivals/departures
- Updates atmosphere based on narrative tone
- Tracks time progression

### Character State Agent (New)

**Purpose**: Tracks per-character states including emotions, inventory, location, health

**Triggers**: Every turn

**State structure**:
```ts
interface CharacterState {
  characterName: string;
  emotion: string;
  location: string;
  inventory: string[];
  health: string;
  notes: string;
  lastUpdated: number;
}
```

**Output format**:
```
[Character States]
Elara: alert, at the bar, carrying stolen amulet, healthy
Kai: nervous, by the door, carrying travel pack, healthy
Marcus: suspicious, behind the counter, has a crossbow, healthy
```

**State extraction**:
- Parses response for character mentions
- Detects emotion changes
- Tracks inventory additions/removals
- Notes location changes per character

## Pipeline Flow

### Before Send (Per Turn)

```
1. AgentRunner.initAll(ctx)
   - Initialize all agents for the session

2. Sequential Pipeline (by priority):
   MemoryAgent.onBeforeSend(ctx)
     → returns injectPrompt + updatedState
   
   DirectorAgent.onBeforeSend(ctx)
     → returns injectPrompt + updatedState
   
   SceneStateAgent.onBeforeSend(ctx)
     → returns injectPrompt + updatedState
   
   CharacterStateAgent.onBeforeSend(ctx)
     → returns injectPrompt + updatedState

3. Assemble Prompt:
   [System Prompt]
   [Card Description]
   [Persona]
   [Memory]          ← MemoryAgent
   [Director]        ← DirectorAgent
   [Scene]           ← SceneStateAgent
   [Character States] ← CharacterStateAgent
   [Lorebook entries]
   [Message history]
   [Post-history instructions]

4. Main chat model generates response
```

### After Receive (Per Turn)

```
1. Sequential Pipeline (by priority):
   MemoryAgent.onAfterReceive(ctx, response)
     → Extract facts, store with embeddings
   
   DirectorAgent.onAfterReceive(ctx, response)
     → Analyze plot progress, update guidance
   
   SceneStateAgent.onAfterReceive(ctx, response)
     → Detect location/character/atmosphere changes
   
   CharacterStateAgent.onAfterReceive(ctx, response)
     → Detect character state changes

2. Persist all state updates to SQLite
```

## Storage

### SQLite Schema

Extends existing `terrarium.db`:

```sql
-- Scene state (1 row per session)
CREATE TABLE scene_states (
  session_id TEXT PRIMARY KEY,
  location TEXT,
  characters TEXT,         -- JSON array of character names
  atmosphere TEXT,
  time_of_day TEXT,
  environmental_notes TEXT,
  last_updated INTEGER
);

-- Character states (multiple rows per session)
CREATE TABLE character_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  emotion TEXT,
  location TEXT,
  inventory TEXT,          -- JSON array
  health TEXT,
  notes TEXT,
  last_updated INTEGER
);

CREATE INDEX idx_char_states_session ON character_states(session_id);
CREATE INDEX idx_char_states_name ON character_states(session_id, character_name);
```

### Storage Operations

```ts
// src/lib/storage/agent-states.ts

export async function getSceneState(sessionId: string): Promise<SceneState | null>;
export async function updateSceneState(sessionId: string, state: Partial<SceneState>): Promise<void>;

export async function getCharacterStates(sessionId: string): Promise<CharacterState[]>;
export async function getCharacterState(sessionId: string, name: string): Promise<CharacterState | null>;
export async function updateCharacterState(sessionId: string, name: string, state: Partial<CharacterState>): Promise<void>;
export async function deleteCharacterState(sessionId: string, name: string): Promise<void>;
```

## Token Budget

### Dynamic Token Budget System

Token budgets are dynamically calculated based on the model's actual context window:

```ts
interface AgentTokenBudget {
  maxTokens: number;        // Dynamically fetched from model's context window
  userBudget: number;       // User-configurable within 0-maxTokens
  warningThreshold: number; // When to show warning (e.g., 80% of maxTokens)
}

interface AgentBudgetConfig {
  memory: number;      // Percentage of context window (default: 20%)
  director: number;    // Percentage of context window (default: 5%)
  scene: number;       // Percentage of context window (default: 2%)
  character: number;   // Percentage of context window (default: 5%)
}
```

### Budget Calculation

1. Fetch model's context window size from provider config or API
2. User sets desired budget per agent as a percentage or absolute value
3. System validates: `userBudget <= modelMaxTokens - chatReserve`
4. UI shows slider: `min ──────────── [user choice] ──────────── max`

### Example Budgets (128k context model)

| Agent | Percentage | Tokens |
|-------|------------|--------|
| Memory | 20% | 25,600 |
| Director | 5% | 6,400 |
| Scene | 2% | 2,560 |
| Character | 5% | 6,400 |

### Budget Enforcement

Each agent's output is truncated if it exceeds its allocated budget:
- Character-level truncation for memory (drop least relevant)
- Sentence truncation for other agents (preserve structure)

## Model Configuration

### Model Slots

```ts
interface ModelSlots {
  chat?: ModelSlot;      // Main chat model (required)
  memory?: ModelSlot;    // Memory extraction/retrieval
  director?: ModelSlot;  // Director agent
}
```

### Slot Fallback Chain

```
director → memory → chat
```

If `director` slot is not configured, falls back to `memory`. If `memory` is not configured, falls back to `chat`.

### Per-Slot Configuration

```ts
interface ModelSlot {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature: number;
  maxTokens?: number;       // Override context window detection
  customPrompt?: string;    // Agent-specific system prompt
}
```

## Settings UI

### Agent Configuration Section

1. **Agent toggles**: Enable/disable each agent
2. **Agent-specific settings**:
   - Memory: extraction frequency, token budget
   - Director: mode (Light/Strong/Absolute), token budget
   - Scene: token budget
   - Character: token budget, auto-track new characters toggle
3. **Model slots**: Director model configuration

### Token Budget UI

Per-agent slider with:
- Current value display
- Max value (from model context window)
- Percentage indicator
- Warning when approaching limit

### State Debug (Developer Mode)

- View current scene state
- View all character states
- Manual state editing
- Export/import state as JSON

## Error Handling

### Failure Modes

| Failure | Behavior |
|---------|----------|
| Agent LLM call fails | Skip agent, continue pipeline, inject `[Reliability Guard]` header |
| No scene state exists | Director injects initial scene setup prompt |
| Character not tracked | Auto-add to tracking on first mention |
| Storage error | Log error, agents return empty results, chat continues |
| Token budget exceeded | Truncate output, preserve most important content |
| Model context window unknown | Use default 4096 budget, show warning |

### Reliability Guard

When one or more agents fail:

```
[Reliability Guard]
One or more support subsystems failed this turn.
Respond conservatively: prioritize established continuity, avoid inventing new facts,
and prefer currently visible scene evidence.
```

## Testing

### Unit Tests

- Agent output parsing (JSON validation)
- State extraction from responses
- Token budget calculation
- SQLite CRUD operations for agent states
- Agent priority ordering

### Integration Tests

- Full pipeline execution (all agents)
- State persistence across turns
- Fallback chain for model slots
- Error recovery (agent failure → reliability guard)

### Test Fixtures

- Sample responses for state extraction
- Mock LLM outputs for agent prompts
- Sample scene/character states
