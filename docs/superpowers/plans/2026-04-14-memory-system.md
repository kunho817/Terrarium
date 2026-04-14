# Memory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Agent Framework and Memory Agent that extracts facts from conversation, stores them with vector embeddings via sql.js + sqlite-vec, retrieves relevant memories, and injects them into the chat prompt. Also adds configurable model slots for memory/illustration tasks.

**Architecture:** Agent framework hooks into the existing engine's `onBeforeSend`/`onAfterReceive` lifecycle. Memory agent uses a dedicated model slot for extraction/summarization LLM calls, and a configurable embedding provider for vector search. sql.js (WASM SQLite) with sqlite-vec stores memories per-session in a single database file.

**Tech Stack:** SvelteKit 5, sql.js (WASM SQLite), sqlite-vec, Vitest, Tauri filesystem API

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/lib/types/agent.ts` | Agent framework types (AgentConfig, AgentContext, AgentResult) |
| `src/lib/types/memory.ts` | Memory record types and settings types |
| `src/lib/storage/db.ts` | sql.js database singleton, schema init, query helpers |
| `src/lib/storage/memories.ts` | Memory CRUD (insert, query, vector search, summaries) |
| `src/lib/core/agents/memory-agent.ts` | Memory agent implementation (extraction, retrieval, summarization) |
| `src/lib/core/agents/agent-runner.ts` | Agent runner (lifecycle manager for all agents in a session) |
| `src/lib/core/embedding.ts` | Embedding provider ( Voyage, OpenAI-compatible APIs) |
| `src/routes/settings/memory/+page.svelte` | Memory settings page |
| `src/routes/settings/models/+page.svelte` | Model slots configuration page |
| `tests/storage/memories.test.ts` | Tests for memory storage CRUD |
| `tests/core/agents/memory-agent.test.ts` | Tests for memory agent extraction/retrieval |
| `tests/core/embedding.test.ts` | Tests for embedding provider |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/types/index.ts` | Add agent/memory barrel exports |
| `src/lib/types/config.ts` | Add ModelSlot, MemorySettings types |
| `src/lib/storage/settings.ts` | Extend AppSettings with modelSlots, memorySettings |
| `src/lib/stores/settings.ts` | Add defaults for new settings fields |
| `src/lib/plugins/registry.ts` | Add registerAgent/listAgents if not present |
| `src/lib/core/chat/engine.ts` | Integrate AgentRunner into send pipeline |
| `src/lib/core/chat/prompt-assembler.ts` | Add memory injection to assembly context |
| `src/routes/settings/+page.svelte` | Add links to Memory and Models sub-pages |
| `package.json` | Add sql.js dependency |

---

### Task 1: Memory Types and Settings

**Files:**
- Create: `src/lib/types/memory.ts`
- Modify: `src/lib/types/config.ts`
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/storage/settings.ts`
- Modify: `src/lib/stores/settings.ts`

- [ ] **Step 1: Create `src/lib/types/memory.ts`**

```ts
export type MemoryType = 'event' | 'trait' | 'relationship' | 'location' | 'state';

export type WriteMode = 'append' | 'overwrite';

export const MEMORY_WRITE_MODES: Record<MemoryType, WriteMode> = {
  event: 'append',
  trait: 'overwrite',
  relationship: 'overwrite',
  location: 'overwrite',
  state: 'overwrite',
};

export interface MemoryRecord {
  id: string;
  sessionId: string;
  type: MemoryType;
  content: string;
  importance: number;
  sourceMessageIds: string[];
  turnNumber: number;
  createdAt: number;
  embedding: number[];
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  startTurn: number;
  endTurn: number;
  summary: string;
  createdAt: number;
}

export interface ExtractionResult {
  facts: Array<{
    content: string;
    type: MemoryType;
    importance: number;
  }>;
}

export const DEFAULT_EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the following conversation and extract important facts that should be remembered for future reference.

For each fact, provide:
- content: A concise statement of the fact
- type: One of "event" (things that happened), "trait" (character qualities), "relationship" (how characters relate), "location" (place knowledge), "state" (current situation)
- importance: A number from 0 to 1 indicating how important this fact is to remember (1 = critical, 0 = trivial)

Focus on facts that would be important for continuity in a long roleplay session: character details, plot events, relationship changes, world knowledge, and current states.

Output as JSON:
{"facts": [{"content": "...", "type": "event", "importance": 0.8}, ...]}`;

export const DEFAULT_SUMMARY_PROMPT = `You are a narrative summarizer. Summarize the following conversation segment, preserving key events, character developments, relationship changes, and important plot details. Write in a concise narrative style that captures the essence of what happened. Focus on information that would be needed for story continuity.`;
```

- [ ] **Step 2: Add types to `src/lib/types/config.ts`**

Append after the existing `ModelInfo` interface:

```ts
export interface ModelSlot {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  customExtractionPrompt?: string;
  customSummaryPrompt?: string;
  customPlanningPrompt?: string;
}

export interface MemorySettings {
  extractionBatchSize: number;
  tokenBudget: number;
  topK: number;
  summaryThreshold: number;
  embeddingProvider: string;
  embeddingApiKey: string;
  embeddingModel: string;
}
```

- [ ] **Step 3: Update `src/lib/types/index.ts`**

Add exports for the new memory types:

```ts
export * from './memory';
```

(Add alongside existing barrel exports.)

- [ ] **Step 4: Update `src/lib/storage/settings.ts`**

Extend the `AppSettings` interface to include:

```ts
modelSlots?: {
  memory?: ModelSlot;
  illustration?: ModelSlot;
};
memorySettings?: MemorySettings;
```

Add the import for `ModelSlot` and `MemorySettings` from `./config`.

Update the default settings object to include:

```ts
modelSlots: {},
memorySettings: {
  extractionBatchSize: 5,
  tokenBudget: 4096,
  topK: 15,
  summaryThreshold: 50,
  embeddingProvider: '',
  embeddingApiKey: '',
  embeddingModel: '',
},
```

- [ ] **Step 5: Update `src/lib/stores/settings.ts`**

Ensure the store's initial state includes `modelSlots: {}` and the default `memorySettings` object. If the loaded settings don't have these fields, fill in defaults during `load()`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: All 476 existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/memory.ts src/lib/types/config.ts src/lib/types/index.ts src/lib/storage/settings.ts src/lib/stores/settings.ts
git commit -m "feat: add memory types, model slot types, and settings defaults"
```

---

### Task 2: Agent Framework Types

**Files:**
- Create: `src/lib/types/agent.ts`
- Modify: `src/lib/types/plugin.ts`

- [ ] **Step 1: Create `src/lib/types/agent.ts`**

```ts
import type { Message } from './message';
import type { SceneState } from './scene';
import type { UserConfig } from './config';
import type { MemoryRecord, SessionSummary } from './memory';

export interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  modelSlot: 'chat' | 'memory' | 'illustration';
  settings: Record<string, unknown>;
}

export interface AgentContext {
  sessionId: string;
  cardId: string;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
  config: UserConfig;
}

export interface AgentResult {
  injectPrompt?: string;
  updatedMemories?: MemoryRecord[];
  summaries?: SessionSummary[];
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  init(ctx: AgentContext): Promise<void>;
  onBeforeSend(ctx: AgentContext): Promise<AgentResult>;
  onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult>;
  shutdown(): Promise<void>;
}
```

- [ ] **Step 2: Update `src/lib/types/plugin.ts`**

The existing `AgentPlugin` interface at lines 69-76 has `onBeforeSend(ctx: ChatContext)` which returns `Promise<ChatContext>`. This is used in `engine.ts` already. The new `Agent` interface in `agent.ts` is a richer version.

We keep both — `AgentPlugin` remains for simple registered plugins, and `Agent` is the new richer interface used by the agent runner. No changes to `AgentPlugin` needed.

- [ ] **Step 3: Update `src/lib/types/index.ts`**

Add:

```ts
export * from './agent';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/agent.ts src/lib/types/index.ts
git commit -m "feat: add agent framework types"
```

---

### Task 3: SQLite Database Setup

**Files:**
- Create: `src/lib/storage/db.ts`

- [ ] **Step 1: Install sql.js**

Run: `npm install sql.js`

Then copy the WASM file to the static directory so it can be loaded at runtime:

Run:
```bash
mkdir -p static
cp node_modules/sql.js/dist/sql-wasm.wasm static/sql-wasm.wasm
```

- [ ] **Step 2: Create `src/lib/storage/db.ts`**

```ts
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';

const DB_PATH = 'terrarium.db';
const WASM_PATH = '/sql-wasm.wasm';

let sqlStatic: SqlJsStatic | null = null;
let dbInstance: Database | null = null;

async function getSqlStatic(): Promise<SqlJsStatic> {
  if (!sqlStatic) {
    sqlStatic = await initSqlJs({
      locateFile: () => WASM_PATH,
    });
  }
  return sqlStatic;
}

async function loadExistingDb(): Promise<Uint8Array | null> {
  try {
    return await readFile(DB_PATH, { baseDir: BaseDirectory.AppData });
  } catch {
    return null;
  }
}

async function persistDb(): Promise<void> {
  if (!dbInstance) return;
  const data = dbInstance.export();
  await writeFile(DB_PATH, data, { baseDir: BaseDirectory.AppData });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('event', 'trait', 'relationship', 'location', 'state')),
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  source_message_ids TEXT NOT NULL DEFAULT '[]',
  turn_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_type ON memories(session_id, type);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  start_turn INTEGER NOT NULL,
  end_turn INTEGER NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id);

CREATE TABLE IF NOT EXISTS embeddings (
  memory_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_embeddings_memory ON embeddings(memory_id);
`;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await getSqlStatic();
  const existing = await loadExistingDb();

  if (existing) {
    dbInstance = new SQL.Database(existing);
  } else {
    dbInstance = new SQL.Database();
  }

  dbInstance.run(SCHEMA);
  return dbInstance;
}

export async function persist(): Promise<void> {
  await persistDb();
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await persistDb();
    dbInstance.close();
    dbInstance = null;
  }
}

export function getDbSync(): Database | null {
  return dbInstance;
}
```

Note: Vector search (sqlite-vec) will be added in a follow-up task. For now, embeddings are stored as BLOB and similarity is computed in JavaScript.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass (this file is not yet imported by anything).

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/db.ts static/sql-wasm.wasm package.json package-lock.json
git commit -m "feat: add sql.js database layer with schema initialization"
```

---

### Task 4: Memory Storage CRUD

**Files:**
- Create: `src/lib/storage/memories.ts`
- Create: `tests/storage/memories.test.ts`

- [ ] **Step 1: Write tests in `tests/storage/memories.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, closeDb } from '$lib/storage/db';
import {
  insertMemory,
  getMemoriesForSession,
  deleteMemory,
  getTopKMemories,
  insertSummary,
  getSummariesForSession,
  getLatestSummaryTurn,
} from '$lib/storage/memories';
import type { MemoryRecord, SessionSummary } from '$lib/types/memory';

const sessionId = 'test-session-1';

const makeMemory = (overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
  id: crypto.randomUUID(),
  sessionId,
  type: 'event',
  content: 'Test event',
  importance: 0.8,
  sourceMessageIds: [],
  turnNumber: 1,
  createdAt: Date.now(),
  embedding: [0.1, 0.2, 0.3],
  ...overrides,
});

describe('Memory Storage', () => {
  beforeEach(async () => {
    const db = await getDb();
    db.run('DELETE FROM memories');
    db.run('DELETE FROM summaries');
    db.run('DELETE FROM embeddings');
  });

  afterEach(async () => {
    await closeDb();
  });

  describe('insertMemory', () => {
    it('inserts a memory and retrieves it', async () => {
      const mem = makeMemory();
      await insertMemory(mem);
      const results = await getMemoriesForSession(sessionId);
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Test event');
      expect(results[0].type).toBe('event');
    });

    it('stores embedding alongside memory', async () => {
      const mem = makeMemory({ embedding: [0.5, 0.6, 0.7] });
      await insertMemory(mem);
      const db = await getDb();
      const row = db.exec('SELECT embedding FROM embeddings WHERE memory_id = ?', [mem.id]);
      expect(row).toHaveLength(1);
    });
  });

  describe('deleteMemory', () => {
    it('deletes a memory by id', async () => {
      const mem = makeMemory();
      await insertMemory(mem);
      await deleteMemory(mem.id);
      const results = await getMemoriesForSession(sessionId);
      expect(results).toHaveLength(0);
    });
  });

  describe('getTopKMemories', () => {
    it('returns memories sorted by importance descending', async () => {
      await insertMemory(makeMemory({ id: '1', content: 'Low', importance: 0.2 }));
      await insertMemory(makeMemory({ id: '2', content: 'High', importance: 0.9 }));
      await insertMemory(makeMemory({ id: '3', content: 'Med', importance: 0.5 }));
      const results = await getTopKMemories(sessionId, 2);
      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('High');
      expect(results[1].content).toBe('Med');
    });
  });

  describe('Summaries', () => {
    it('inserts and retrieves summaries', async () => {
      const summary: SessionSummary = {
        id: crypto.randomUUID(),
        sessionId,
        startTurn: 1,
        endTurn: 20,
        summary: 'The party traveled through the forest.',
        createdAt: Date.now(),
      };
      await insertSummary(summary);
      const results = await getSummariesForSession(sessionId);
      expect(results).toHaveLength(1);
      expect(results[0].summary).toBe('The party traveled through the forest.');
    });

    it('tracks latest summarized turn', async () => {
      await insertSummary({
        id: crypto.randomUUID(),
        sessionId,
        startTurn: 1,
        endTurn: 10,
        summary: 'First chunk',
        createdAt: Date.now(),
      });
      await insertSummary({
        id: crypto.randomUUID(),
        sessionId,
        startTurn: 11,
        endTurn: 20,
        summary: 'Second chunk',
        createdAt: Date.now(),
      });
      const latest = await getLatestSummaryTurn(sessionId);
      expect(latest).toBe(20);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/storage/memories.test.ts`
Expected: FAIL — module `$lib/storage/memories` does not exist.

- [ ] **Step 3: Create `src/lib/storage/memories.ts`**

```ts
import { getDb, persist } from './db';
import type { MemoryRecord, MemoryType, SessionSummary } from '$lib/types/memory';

function serializeEmbedding(embedding: number[]): Uint8Array {
  const buffer = new ArrayBuffer(embedding.length * 4);
  const view = new Float32Array(buffer);
  embedding.forEach((v, i) => (view[i] = v));
  return new Uint8Array(buffer);
}

function deserializeEmbedding(data: Uint8Array): number[] {
  const view = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
  return Array.from(view);
}

export async function insertMemory(memory: MemoryRecord): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO memories (id, session_id, type, content, importance, source_message_ids, turn_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      memory.id,
      memory.sessionId,
      memory.type,
      memory.content,
      memory.importance,
      JSON.stringify(memory.sourceMessageIds),
      memory.turnNumber,
      memory.createdAt,
    ],
  );
  if (memory.embedding.length > 0) {
    db.run(
      `INSERT OR REPLACE INTO embeddings (memory_id, embedding) VALUES (?, ?)`,
      [memory.id, serializeEmbedding(memory.embedding)],
    );
  }
  await persist();
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM embeddings WHERE memory_id = ?', [id]);
  db.run('DELETE FROM memories WHERE id = ?', [id]);
  await persist();
}

export async function getMemoriesForSession(sessionId: string): Promise<MemoryRecord[]> {
  const db = await getDb();
  const results = db.exec(
    'SELECT id, session_id, type, content, importance, source_message_ids, turn_number, created_at FROM memories WHERE session_id = ? ORDER BY created_at DESC',
    [sessionId],
  );
  if (!results.length) return [];
  return results[0].values.map((row) => ({
    id: row[0] as string,
    sessionId: row[1] as string,
    type: row[2] as MemoryType,
    content: row[3] as string,
    importance: row[4] as number,
    sourceMessageIds: JSON.parse(row[5] as string),
    turnNumber: row[6] as number,
    createdAt: row[7] as number,
    embedding: [],
  }));
}

export async function getTopKMemories(sessionId: string, k: number): Promise<MemoryRecord[]> {
  const db = await getDb();
  const results = db.exec(
    'SELECT id, session_id, type, content, importance, source_message_ids, turn_number, created_at FROM memories WHERE session_id = ? ORDER BY importance DESC LIMIT ?',
    [sessionId, k],
  );
  if (!results.length) return [];
  return results[0].values.map((row) => ({
    id: row[0] as string,
    sessionId: row[1] as string,
    type: row[2] as MemoryType,
    content: row[3] as string,
    importance: row[4] as number,
    sourceMessageIds: JSON.parse(row[5] as string),
    turnNumber: row[6] as number,
    createdAt: row[7] as number,
    embedding: [],
  }));
}

export async function findSimilarMemories(
  sessionId: string,
  queryEmbedding: number[],
  topK: number,
  currentTurn: number,
): Promise<MemoryRecord[]> {
  const allMemories = await getMemoriesWithEmbeddings(sessionId);
  const scored = allMemories.map((mem) => {
    const similarity = cosineSimilarity(queryEmbedding, mem.embedding);
    const freshnessDecay = Math.exp(-0.05 * (currentTurn - mem.turnNumber));
    const score = similarity * mem.importance * freshnessDecay;
    return { ...mem, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

async function getMemoriesWithEmbeddings(sessionId: string): Promise<MemoryRecord[]> {
  const db = await getDb();
  const results = db.exec(
    `SELECT m.id, m.session_id, m.type, m.content, m.importance, m.source_message_ids, m.turn_number, m.created_at, e.embedding
     FROM memories m
     LEFT JOIN embeddings e ON m.id = e.memory_id
     WHERE m.session_id = ?`,
    [sessionId],
  );
  if (!results.length) return [];
  return results[0].values.map((row) => ({
    id: row[0] as string,
    sessionId: row[1] as string,
    type: row[2] as MemoryType,
    content: row[3] as string,
    importance: row[4] as number,
    sourceMessageIds: JSON.parse(row[5] as string),
    turnNumber: row[6] as number,
    createdAt: row[7] as number,
    embedding: row[8] ? deserializeEmbedding(new Uint8Array(row[8] as number[])) : [],
  }));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function insertSummary(summary: SessionSummary): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO summaries (id, session_id, start_turn, end_turn, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [summary.id, summary.sessionId, summary.startTurn, summary.endTurn, summary.summary, summary.createdAt],
  );
  await persist();
}

export async function getSummariesForSession(sessionId: string): Promise<SessionSummary[]> {
  const db = await getDb();
  const results = db.exec(
    'SELECT id, session_id, start_turn, end_turn, summary, created_at FROM summaries WHERE session_id = ? ORDER BY start_turn ASC',
    [sessionId],
  );
  if (!results.length) return [];
  return results[0].values.map((row) => ({
    id: row[0] as string,
    sessionId: row[1] as string,
    startTurn: row[2] as number,
    endTurn: row[3] as number,
    summary: row[4] as string,
    createdAt: row[5] as number,
  }));
}

export async function getLatestSummaryTurn(sessionId: string): Promise<number> {
  const db = await getDb();
  const results = db.exec(
    'SELECT MAX(end_turn) FROM summaries WHERE session_id = ?',
    [sessionId],
  );
  if (!results.length || !results[0].values.length) return 0;
  return (results[0].values[0][0] as number) || 0;
}

export async function deleteMemoriesForSession(sessionId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM embeddings WHERE memory_id IN (SELECT id FROM memories WHERE session_id = ?)', [sessionId]);
  db.run('DELETE FROM memories WHERE session_id = ?', [sessionId]);
  db.run('DELETE FROM summaries WHERE session_id = ?', [sessionId]);
  await persist();
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/storage/memories.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/memories.ts tests/storage/memories.test.ts
git commit -m "feat: add memory storage CRUD with embedding-based similarity search"
```

---

### Task 5: Embedding Provider

**Files:**
- Create: `src/lib/core/embedding.ts`
- Create: `tests/core/embedding.test.ts`

- [ ] **Step 1: Write tests in `tests/core/embedding.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding, cosineSimilarity } from '$lib/core/embedding';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Embedding Provider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls Voyage API with correct format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });

    const result = await getEmbedding('test text', {
      provider: 'voyage',
      apiKey: 'test-key',
      model: 'voyage-3',
    });

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('voyage');
    const body = JSON.parse(options.body);
    expect(body.input).toEqual(['test text']);
    expect(body.model).toBe('voyage-3');
  });

  it('calls OpenAI-compatible API with correct format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0.4, 0.5, 0.6] }] }),
    });

    const result = await getEmbedding('test text', {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
      baseUrl: 'https://api.openai.com/v1',
    });

    expect(result).toEqual([0.4, 0.5, 0.6]);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(getEmbedding('test', {
      provider: 'voyage',
      apiKey: 'bad-key',
      model: 'voyage-3',
    })).rejects.toThrow();
  });

  it('computes cosine similarity correctly', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 1, 0], [0, 1, 1])).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/embedding.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/core/embedding.ts`**

```ts
export interface EmbeddingConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export async function getEmbedding(text: string, config: EmbeddingConfig): Promise<number[]> {
  const embeddings = await getEmbeddings([text], config);
  return embeddings[0];
}

export async function getEmbeddings(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  if (config.provider === 'voyage') {
    return await callVoyageApi(texts, config);
  }
  return await callOpenAICompatibleApi(texts, config);
}

async function callVoyageApi(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: config.model,
      input_type: 'document',
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.map((item: any) => item.embedding);
}

async function callOpenAICompatibleApi(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/+$/, '')}/embeddings`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: config.model,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.map((item: any) => item.embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/embedding.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/embedding.ts tests/core/embedding.test.ts
git commit -m "feat: add embedding provider with Voyage and OpenAI-compatible support"
```

---

### Task 6: Memory Agent

**Files:**
- Create: `src/lib/core/agents/memory-agent.ts`
- Create: `src/lib/core/agents/agent-runner.ts`
- Create: `tests/core/agents/memory-agent.test.ts`

- [ ] **Step 1: Write tests in `tests/core/agents/memory-agent.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryAgent } from '$lib/core/agents/memory-agent';
import { getDb, closeDb } from '$lib/storage/db';
import type { AgentContext } from '$lib/types/agent';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/embedding', () => ({
  getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  cosineSimilarity: vi.fn((a, b) => {
    if (a.length !== b.length) return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; nA += a[i]*a[i]; nB += b[i]*b[i]; }
    const d = Math.sqrt(nA)*Math.sqrt(nB);
    return d === 0 ? 0 : dot/d;
  }),
}));

const makeCtx = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  sessionId: 'test-session',
  cardId: 'card-1',
  cardType: 'character',
  messages: [],
  scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {} },
  turnNumber: 1,
  config: { providerId: 'test' },
  ...overrides,
});

describe('MemoryAgent', () => {
  beforeEach(async () => {
    const db = await getDb();
    db.run('DELETE FROM memories');
    db.run('DELETE FROM summaries');
    db.run('DELETE FROM embeddings');
  });

  afterEach(async () => {
    await closeDb();
  });

  it('has correct id and name', () => {
    const agent = new MemoryAgent();
    expect(agent.id).toBe('memory');
    expect(agent.name).toBe('Memory Agent');
  });

  it('returns empty inject when no memories exist', async () => {
    const agent = new MemoryAgent();
    const ctx = makeCtx();
    const result = await agent.onBeforeSend(ctx);
    expect(result.injectPrompt).toBeFalsy();
  });

  it('extracts facts from messages on afterReceive', async () => {
    const agent = new MemoryAgent();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"facts": [{"content": "Elara is brave", "type": "trait", "importance": 0.8}]}' } }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const messages: Message[] = [
      { role: 'user', content: 'Elara charges forward', type: 'dialogue', timestamp: 1 },
      { role: 'assistant', content: 'Elara faces the dragon without fear', type: 'dialogue', timestamp: 2 },
    ];
    const ctx = makeCtx({ messages, turnNumber: 5 });
    await agent.init(ctx);
    const result = await agent.onAfterReceive(ctx, 'response text');
    expect(result.updatedMemories).toBeDefined();
    expect(result.updatedMemories!.length).toBeGreaterThan(0);
    expect(result.updatedMemories![0].content).toBe('Elara is brave');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/agents/memory-agent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/core/agents/memory-agent.ts`**

```ts
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { MemoryRecord, MemoryType, ExtractionResult } from '$lib/types/memory';
import { MEMORY_WRITE_MODES, DEFAULT_EXTRACTION_PROMPT, DEFAULT_SUMMARY_PROMPT } from '$lib/types/memory';
import { insertMemory, findSimilarMemories, deleteMemory, insertSummary, getLatestSummaryTurn } from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';

function getMemorySettings() {
  const settings = get(settingsStore);
  return settings.memorySettings || {
    extractionBatchSize: 5,
    tokenBudget: 4096,
    topK: 15,
    summaryThreshold: 50,
    embeddingProvider: '',
    embeddingApiKey: '',
    embeddingModel: '',
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class MemoryAgent implements Agent {
  readonly id = 'memory';
  readonly name = 'Memory Agent';
  private lastExtractionTurn = 0;

  async init(_ctx: AgentContext): Promise<void> {}

  async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
    const settings = getMemorySettings();
    if (!settings.embeddingProvider || !settings.embeddingApiKey) {
      return {};
    }

    const queryText = ctx.messages.slice(-4).map(m => m.content).join('\n');
    if (!queryText.trim()) return {};

    try {
      const queryEmbedding = await getEmbedding(queryText, {
        provider: settings.embeddingProvider,
        apiKey: settings.embeddingApiKey,
        model: settings.embeddingModel,
      });

      const memories = await findSimilarMemories(
        ctx.sessionId,
        queryEmbedding,
        settings.topK,
        ctx.turnNumber,
      );

      if (memories.length === 0) return {};

      const lines = memories
        .map(m => `- ${m.content} (${m.type})`)
        .filter(line => line.length > 3);

      let totalTokens = 0;
      const budgetLines: string[] = [];
      for (const line of lines) {
        const tokens = estimateTokens(line);
        if (totalTokens + tokens > settings.tokenBudget) break;
        budgetLines.push(line);
        totalTokens += tokens;
      }

      if (budgetLines.length === 0) return {};

      return {
        injectPrompt: `[Memory]\n${budgetLines.join('\n')}`,
      };
    } catch {
      return {};
    }
  }

  async onAfterReceive(ctx: AgentContext, _response: string): Promise<AgentResult> {
    const settings = getMemorySettings();
    if (!settings.embeddingProvider || !settings.embeddingApiKey) return {};

    const batchSize = settings.extractionBatchSize;
    if (ctx.turnNumber - this.lastExtractionTurn < batchSize) return {};

    const userMessages = ctx.messages.filter(m => m.role === 'user');
    if (userMessages.length < batchSize) return {};

    this.lastExtractionTurn = ctx.turnNumber;

    try {
      const recentMessages = ctx.messages.slice(-(batchSize * 2));
      const conversation = recentMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const extractionPrompt = settings.embeddingProvider
        ? DEFAULT_EXTRACTION_PROMPT
        : DEFAULT_EXTRACTION_PROMPT;

      const extraction = await this.callExtractionModel(conversation, extractionPrompt);
      if (!extraction.facts || extraction.facts.length === 0) return {};

      const memories: MemoryRecord[] = [];
      for (const fact of extraction.facts) {
        const embedding = await getEmbedding(fact.content, {
          provider: settings.embeddingProvider,
          apiKey: settings.embeddingApiKey,
          model: settings.embeddingModel,
        });

        const memory: MemoryRecord = {
          id: crypto.randomUUID(),
          sessionId: ctx.sessionId,
          type: fact.type as MemoryType,
          content: fact.content,
          importance: fact.importance,
          sourceMessageIds: recentMessages.map(m => (m as any).id).filter(Boolean),
          turnNumber: ctx.turnNumber,
          createdAt: Date.now(),
          embedding,
        };

        await this.handleWriteMode(memory);
        memories.push(memory);
      }

      return { updatedMemories: memories };
    } catch {
      return {};
    }
  }

  private async handleWriteMode(memory: MemoryRecord): Promise<void> {
    const writeMode = MEMORY_WRITE_MODES[memory.type];

    if (writeMode === 'overwrite') {
      const existing = await findSimilarMemories(
        memory.sessionId,
        memory.embedding,
        1,
        memory.turnNumber + 100,
      );
      const similar = existing.find(m =>
        m.type === memory.type &&
        this.contentSimilarity(m.content, memory.content) > 0.7
      );
      if (similar) {
        await deleteMemory(similar.id);
      }
    }

    await insertMemory(memory);
  }

  private contentSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private async callExtractionModel(conversation: string, prompt: string): Promise<ExtractionResult> {
    const settings = get(settingsStore);
    const memorySlot = settings.modelSlots?.memory;
    const providerId = memorySlot?.provider || settings.defaultProvider;
    const providerConfig = settings.providers?.[providerId] || {};
    const model = memorySlot?.model || (providerConfig.model as string) || '';
    const apiKey = memorySlot?.apiKey || (providerConfig.apiKey as string) || '';
    const baseUrl = memorySlot?.baseUrl || (providerConfig.baseUrl as string) || '';
    const temperature = memorySlot?.temperature ?? 0.3;
    const customPrompt = memorySlot?.customExtractionPrompt || prompt;

    const isClaude = providerId === 'claude';
    if (isClaude) {
      return await this.callClaudeExtraction(customPrompt, conversation, model, apiKey, temperature);
    }

    const url = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: customPrompt },
          { role: 'user', content: conversation },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Extraction model error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return this.parseExtractionResult(content);
  }

  private async callClaudeExtraction(
    prompt: string,
    conversation: string,
    model: string,
    apiKey: string,
    temperature: number,
  ): Promise<ExtractionResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature,
        system: prompt,
        messages: [{ role: 'user', content: conversation }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude extraction error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    return this.parseExtractionResult(content);
  }

  private parseExtractionResult(content: string): ExtractionResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { facts: [] };
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.facts)) return parsed;
      return { facts: [] };
    } catch {
      return { facts: [] };
    }
  }

  async shutdown(): Promise<void> {}
}
```

- [ ] **Step 4: Create `src/lib/core/agents/agent-runner.ts`**

```ts
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import { MemoryAgent } from './memory-agent';

const BUILT_IN_AGENTS: Agent[] = [
  new MemoryAgent(),
];

export class AgentRunner {
  private agents: Agent[] = [];

  constructor() {
    this.agents = [...BUILT_IN_AGENTS];
  }

  async initAll(ctx: AgentContext): Promise<void> {
    for (const agent of this.agents) {
      try {
        await agent.init(ctx);
      } catch {
        // Agent init failed — skip
      }
    }
  }

  async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
    const combined: AgentResult = {};
    for (const agent of this.agents) {
      try {
        const result = await agent.onBeforeSend(ctx);
        if (result.injectPrompt) {
          combined.injectPrompt = combined.injectPrompt
            ? `${combined.injectPrompt}\n\n${result.injectPrompt}`
            : result.injectPrompt;
        }
      } catch {
        // Agent failed — skip
      }
    }
    return combined;
  }

  async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
    const combined: AgentResult = {};
    for (const agent of this.agents) {
      try {
        const result = await agent.onAfterReceive(ctx, response);
        if (result.updatedMemories) {
          combined.updatedMemories = [
            ...(combined.updatedMemories || []),
            ...result.updatedMemories,
          ];
        }
      } catch {
        // Agent failed — skip
      }
    }
    return combined;
  }

  async shutdownAll(): Promise<void> {
    for (const agent of this.agents) {
      try {
        await agent.shutdown();
      } catch {
        // Agent shutdown failed — skip
      }
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/core/agents/memory-agent.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/agents/memory-agent.ts src/lib/core/agents/agent-runner.ts tests/core/agents/memory-agent.test.ts
git commit -m "feat: add memory agent with extraction, retrieval, and agent runner"
```

---

### Task 7: Engine Integration

**Files:**
- Modify: `src/lib/core/chat/engine.ts`
- Modify: `src/lib/core/chat/prompt-assembler.ts`

- [ ] **Step 1: Integrate AgentRunner into engine**

In `src/lib/core/chat/engine.ts`, add import:

```ts
import { AgentRunner } from '../agents/agent-runner';
```

In the `ChatEngine` class, add a field:

```ts
private agentRunner = new AgentRunner();
```

In the `send` method, after step 6 (running agent onBeforeSend hooks), add agent runner call. Replace the existing agent hooks section (lines 164-167):

```ts
// 6. Run registered agent plugins
for (const agent of this.registry.listAgents()) {
  ctx = await agent.onBeforeSend(ctx);
}

// 6b. Run agent runner (memory, future agents)
const agentResult = await this.agentRunner.onBeforeSend({
  sessionId: options.characterId || '',
  cardId: options.characterId || '',
  cardType: options.worldCard ? 'world' : 'character',
  messages: allMessages,
  scene: triggerScene,
  turnNumber: allMessages.filter(m => m.role === 'user').length,
  config: options.config,
});
if (agentResult.injectPrompt) {
  ctx.additionalPrompt = (ctx.additionalPrompt || '') + '\n\n' + agentResult.injectPrompt;
}
```

In the token stream function, after step 11 (agent onAfterReceive hooks), add:

```ts
// 11b. Run agent runner onAfterReceive
try {
  await self.agentRunner.onAfterReceive({
    sessionId: capturedCharacterId || '',
    cardId: capturedCharacterId || '',
    cardType: capturedCtx.card ? 'character' : 'character',
    messages: capturedCtx.messages,
    scene: capturedCtx.scene,
    turnNumber: capturedCtx.messages.filter(m => m.role === 'user').length,
    config: capturedConfig,
  }, processed);
} catch {
  // Agent runner failed — non-blocking
}
```

- [ ] **Step 2: Update prompt assembler to inject memory prompt**

In `src/lib/core/chat/prompt-assembler.ts`, find the `assembleWithPreset` function. In the section where prompt items are resolved, add handling for `ctx.additionalPrompt`. After the lorebook injection section and before the chat history, add:

```ts
if (context.additionalPrompt) {
  messages.push({
    role: 'system',
    content: context.additionalPrompt,
    type: 'system',
    timestamp: 0,
  });
}
```

This should be placed after the lorebook items but before the chat history items in the assembly function.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/chat/engine.ts src/lib/core/chat/prompt-assembler.ts
git commit -m "feat: integrate agent runner and memory injection into chat engine"
```

---

### Task 8: Settings UI — Memory and Models Pages

**Files:**
- Create: `src/routes/settings/memory/+page.svelte`
- Create: `src/routes/settings/models/+page.svelte`
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Create `src/routes/settings/memory/+page.svelte`**

A settings page with sections for:

1. **Embedding Provider**: dropdown (Voyage, OpenAI-compatible), API key input, model input
2. **Memory Settings**: extraction batch size (number input), token budget (slider, max = chat provider maxTokens), top-K (number input), summary threshold (number input)

The page reads from `$settingsStore.memorySettings` and `$settingsStore.providers[$settingsStore.defaultProvider]?.maxTokens` for the slider max.

Each control calls `settingsStore.update({ memorySettings: {...} })` then `settingsStore.save()`.

Use the same styling pattern as the existing providers settings page: `bg-surface0`, `text-text`, `rounded-lg`, `border border-surface1`.

- [ ] **Step 2: Create `src/routes/settings/models/+page.svelte`**

A settings page with sections for:

1. **Memory Model**: provider dropdown, API key, base URL, model name, temperature, custom extraction prompt (textarea), custom summary prompt (textarea)
2. **Illustration Model**: provider dropdown, API key, base URL, model name, temperature, custom planning prompt (textarea)

Each section reads/writes to `$settingsStore.modelSlots.memory` and `$settingsStore.modelSlots.illustration`.

Include a "Reset to Default" button for each custom prompt textarea that restores the default from `DEFAULT_EXTRACTION_PROMPT` / `DEFAULT_SUMMARY_PROMPT`.

- [ ] **Step 3: Update `src/routes/settings/+page.svelte`**

Add two new link sections after the existing settings items:

```svelte
<a href="/settings/memory" class="...existing link classes...">
  Memory Settings
</a>
<a href="/settings/models" class="...existing link classes...">
  Model Slots
</a>
```

Match the existing link styling pattern from the page.

- [ ] **Step 4: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings/memory/+page.svelte src/routes/settings/models/+page.svelte src/routes/settings/+page.svelte
git commit -m "feat: add memory and model slots settings pages"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (476 + new memory/embedding/agent tests).

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1`
Expected: No new errors beyond pre-existing ones.

- [ ] **Step 3: Commit (if any fixups needed)**
