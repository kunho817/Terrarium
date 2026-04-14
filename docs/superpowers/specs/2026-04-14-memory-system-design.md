# Memory System Design

## Overview

A Memory Agent that observes conversation, extracts structured facts, stores them with vector embeddings in SQLite, and retrieves relevant memories for injection into the chat prompt. Includes chunked summarization for context compression. Built on a general Agent Framework designed for reuse by future agents (Director, auxiliary agents, Records Manager).

## Agent Framework

### Core Types

```ts
interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  modelSlot: 'chat' | 'memory' | 'illustration';
  settings: Record<string, unknown>;
}

interface AgentContext {
  sessionId: string;
  cardId: string;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
}

interface AgentResult {
  injectPrompt?: string;
  updatedMemories?: MemoryRecord[];
  summaries?: SessionSummary[];
}
```

### Agent Lifecycle

Each agent follows: **Init → Observe → Think → Act → Shutdown**

1. **Init** — when a session starts, initialize agent state
2. **Observe** — receive events (new messages, scene changes)
3. **Think** — make LLM calls with the agent's configured model and prompts to decide actions
4. **Act** — store memories, inject prompt content, update summaries
5. **Shutdown** — flush pending work when session ends

### Integration Points

- `onBeforeSend(ctx)` — agents provide content for prompt injection (memory retrieval)
- `onAfterReceive(ctx)` — agents observe new messages and trigger processing (memory extraction)
- Agent runner is instantiated per-session and manages all active agents

## Model Configuration

### Model Slots

Multiple named model configurations, each independently configurable:

| Slot | Purpose | Fallback |
|------|---------|----------|
| `chat` | Main chat model | Required, no fallback |
| `memory` | Memory extraction + summarization | Falls back to `chat` |
| `illustration` | Image generation planning | Falls back to `chat` |

Each slot has:

```ts
interface ModelSlot {
  provider: string;
  apiKey: string;
  model: string;
  temperature: number;
  customPrompt?: string;
}
```

The `memory` slot has two user-editable prompts:
- **Extraction prompt** — used when extracting facts from conversation
- **Summarization prompt** — used when generating chunk summaries

The `illustration` slot has one user-editable prompt:
- **Planning prompt** — used for post-generation illustration placement

### Settings Storage

Model slots are stored in global settings (`src/lib/types/config.ts`):

```ts
interface AppSettings {
  // ... existing fields ...
  modelSlots: {
    memory?: ModelSlot;
    illustration?: ModelSlot;
  };
  memorySettings: MemorySettings;
}

interface MemorySettings {
  extractionBatchSize: number;   // extract every N turns (default: 5)
  tokenBudget: number;           // memory injection budget (default: 4096)
  topK: number;                  // retrieval count (default: 15)
  summaryThreshold: number;      // summarize after N messages (default: 50)
  embeddingProvider: string;     // voyage, openai, etc.
  embeddingApiKey: string;
  embeddingModel: string;        // e.g. "voyage-3"
}
```

### Token Budget

The memory token budget slider:
- Default: **4096 tokens**
- Min: 512
- Max: **dynamically capped to the chat provider's configured maxTokens**
- If the user changes their chat provider/model and the new maxTokens is lower than the current budget, the budget is auto-clamped and a warning is shown
- The budget applies to the total memory section injected into the prompt (retrieved memories + active summaries)

## Memory Agent

### Memory Record Types

5 types, each with a write mode determining how updates are handled:

| Type | Write Mode | Description |
|------|-----------|-------------|
| `event` | Append | Things that happened in the story |
| `trait` | Overwrite | Character qualities discovered |
| `relationship` | Overwrite | How characters relate to each other |
| `location` | Overwrite | Place knowledge |
| `state` | Overwrite | Current situation facts |

Write mode behavior:
- **Append**: New facts accumulate as separate records
- **Overwrite**: Newer fact replaces older fact of the same type about the same subject (matched by content similarity)

### Memory Record

```ts
interface MemoryRecord {
  id: string;
  sessionId: string;
  type: 'event' | 'trait' | 'relationship' | 'location' | 'state';
  content: string;
  importance: number;           // 0-1
  sourceMessageIds: string[];
  turnNumber: number;
  createdAt: number;
  embedding: number[];          // vector for semantic search
}
```

### Agent Pipeline

**Per turn (onBeforeSend — retrieval):**

1. Embed the user's latest message + last few exchanges
2. Query SQLite for top-K memories by cosine similarity
3. Sort by `relevance × importance × freshness_decay`
4. Truncate to fit within token budget
5. Return as injectPrompt string: `[Memory] Elara is afraid of fire. The party visited the Crystal Caves on day 3. ...`

**Per batch (onAfterReceive — extraction):**

Every N turns (configurable, default 5):

1. Gather the last N message pairs
2. Send to the memory model with the extraction prompt (user-editable)
3. LLM returns structured JSON: `{ facts: [{ content, type, importance }] }`
4. For each fact, generate an embedding via the configured embedding provider
5. Store in SQLite with the session ID
6. For `overwrite` types, check for similar existing records and replace them

**Per threshold (summarization):**

When unsummarized messages exceed the threshold (default 50):

1. Take the oldest unsummarized chunk (e.g. messages 1-20)
2. Send to the memory model with the summarization prompt (user-editable)
3. Store the summary in SQLite
4. Original messages remain in storage but are replaced by the summary in prompt assembly

### Retrieval Scoring

Memory relevance score = `cosine_similarity × importance × freshness_decay`

Where `freshness_decay = exp(-0.05 × (current_turn - memory_turn))`

This balances semantic relevance, importance, and recency.

## SQLite Storage

### Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('event', 'trait', 'relationship', 'location', 'state')),
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  source_message_ids TEXT NOT NULL DEFAULT '[]',
  turn_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  embedding BLOB
);

CREATE INDEX idx_memories_session ON memories(session_id);
CREATE INDEX idx_memories_session_type ON memories(session_id, type);

CREATE TABLE summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  start_turn INTEGER NOT NULL,
  end_turn INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_summaries_session ON summaries(session_id);

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Vector Search

SQLite with `sqlite-vec` extension for vector similarity search:

```sql
-- Create a virtual table for vector search
CREATE VIRTUAL TABLE memory_vectors USING vec0(
  id TEXT PRIMARY KEY,
  embedding float[embedding_dimensions]
);
```

Cosine similarity queries:

```sql
SELECT m.*, v.distance
FROM memory_vectors v
JOIN memories m ON m.id = v.id
WHERE v.embedding MATCH ?
  AND m.session_id = ?
ORDER BY v.distance ASC
LIMIT ?;
```

### Storage Location

Database file: `{appData}/terrarium.db`

This single database serves all sessions — queries are scoped by `session_id`.

## Prompt Integration

### Injection Point

Memories are injected as a system message in the prompt assembly pipeline:

1. System prompt
2. Card description
3. Persona
4. **Memory section** ← new
5. Lorebook entries
6. Summaries (replacing old messages)
7. Recent message history
8. Post-history instructions

### Memory Section Format

```
[Memory]
- Elara is afraid of fire (trait)
- The party visited the Crystal Caves on day 3 (event)
- Kai trusts the innkeeper but suspects the merchant (relationship)
- The Blackwood Forest is home to venomous spiders (location)
- The party is carrying the stolen amulet (state)
```

Each line is tagged with its type for clarity. The total section is truncated to fit within the token budget.

## UI

### Settings Page Additions

New sections in the settings page:

1. **Model Slots** — configure memory model and illustration model (provider, API key, model, temperature)
2. **Memory Settings** — extraction batch size, token budget slider, top-K, summary threshold
3. **Embedding Provider** — provider selection, API key, model name
4. **Custom Prompts** — edit extraction prompt and summarization prompt (with reset-to-default button)

### Token Budget Slider

- Range: 512 to `{chat provider maxTokens}`
- Default: 4096
- Shows current value and max
- Auto-clamps when chat provider changes and maxTokens decreases
- Warning toast when auto-clamped

## Error Handling

- Embedding API failures: fall back to keyword-based retrieval (search `content` column with LIKE)
- Extraction LLM failures: skip this batch, retry on next trigger
- Summarization failures: keep original messages, retry on next threshold check
- SQLite errors: log and degrade gracefully — chat works without memory

## Testing

- Unit tests for extraction prompt parsing (structured JSON output)
- Unit tests for retrieval scoring formula
- Unit tests for SQLite CRUD operations
- Unit tests for overwrite vs append logic
- Integration test: extraction → embedding → retrieval roundtrip
- Mock embedding provider for tests
