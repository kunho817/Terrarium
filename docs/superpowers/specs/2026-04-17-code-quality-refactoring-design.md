# Code Quality Refactoring Design

## Overview

Address 7 code quality issues identified during the overhaul exploration. No new features — purely structural improvements that make the codebase easier to maintain and build on.

## Items

### 1. Extract Shared Agent LLM Caller

**Problem:** 4 agents duplicate ~50 lines each of raw `fetch()` HTTP logic for OpenAI and Claude APIs.

**Solution:** Create `src/lib/core/agents/agent-llm.ts`:

```ts
export async function callAgentLLM(
  messages: Message[],
  config: {
    providerId: string;
    apiKey: string;
    model: string;
    baseUrl?: string;
    temperature?: number;
  }
): Promise<string>
```

Uses `PluginRegistry.getProvider()` to resolve the provider, then calls `provider.chat()`. Agents become thin orchestration — prompt construction + response parsing only.

**Affected files:**
- Create: `src/lib/core/agents/agent-llm.ts`
- Modify: `src/lib/core/agents/memory-agent.ts` — remove raw fetch
- Modify: `src/lib/core/agents/director-agent.ts` — remove raw fetch
- Modify: `src/lib/core/agents/scene-state-agent.ts` — remove raw fetch
- Modify: `src/lib/core/agents/character-state-agent.ts` — remove raw fetch

### 2. Unify SceneState Types

**Problem:** Two `SceneState` types with different fields:
- `types/scene.ts`: `{ location, time, mood, participatingCharacters, variables }`
- `types/agent-state.ts`: `{ sessionId, location, characters, atmosphere, timeOfDay, environmentalNotes, lastUpdated }`

**Solution:** Expand `types/scene.ts` SceneState:

```ts
export interface SceneState {
  location: string;
  time: string;
  mood: string;
  participatingCharacters: string[];
  variables: VariableStore;
  environmentalNotes: string;
  lastUpdated: number;
}
```

Agent-state.ts removes its `SceneState` definition. `StateUpdate.scene` uses the unified type. The manual field mapping in `agent-runner.ts` gets simplified since fields now align.

**Field mapping (old → new):**
- `atmosphere` → `mood`
- `timeOfDay` → `time`
- `characters` → `participatingCharacters`

**Affected files:**
- Modify: `src/lib/types/scene.ts` — add environmentalNotes, lastUpdated
- Modify: `src/lib/types/agent-state.ts` — remove SceneState, use unified import
- Modify: `src/lib/core/agents/scene-state-agent.ts` — use unified type
- Modify: `src/lib/core/agents/agent-runner.ts` — remove manual field mapping
- Modify: `src/lib/storage/agent-states.ts` — adapt to unified type

### 3. Split use-chat.ts

**Problem:** 383 lines handling streaming, illustration, editing, rerolling, persona resolution.

**Solution:**

| Module | Responsibility |
|--------|---------------|
| `use-chat.ts` | `sendMessage`, `editMessage`, `rerollFromMessage`, `initChat`, `injectFirstMessage` |
| `use-chat-streaming.ts` | `streamAndFinalize`, `stripThinking` |
| `use-chat-illustration.ts` | `generateAndInsertIllustrations`, `generateIllustration` |
| `use-chat-helpers.ts` | `resolveActiveCard`, `resolvePersona`, `worldCardToCharacterCard`, `getSessionPersonaId` |

No behavior change. `use-chat.ts` imports from split modules.

**Affected files:**
- Modify: `src/lib/core/chat/use-chat.ts` — thin orchestration only
- Create: `src/lib/core/chat/use-chat-streaming.ts`
- Create: `src/lib/core/chat/use-chat-illustration.ts`
- Create: `src/lib/core/chat/use-chat-helpers.ts`

### 4. Add persist() Calls

**Problem:** SQLite writes never flushed to disk. Data loss risk on crash.

**Solution:** Add `persist()` calls after write operations, wrapped in try/catch:

- `src/lib/storage/memories.ts` — after `insertMemory`, `deleteMemory`, `deleteMemoriesForSession`
- `src/lib/storage/agent-states.ts` — after `updateSceneState`, `updateCharacterState`, `deleteCharacterState`

```ts
try { await persist(); } catch { /* non-critical */ }
```

**Affected files:**
- Modify: `src/lib/storage/memories.ts`
- Modify: `src/lib/storage/agent-states.ts`

### 5. Deduplicate cosineSimilarity

**Problem:** Identical function in `memories.ts` and `embedding.ts`.

**Solution:** Keep in `embedding.ts` (natural home — vectors). `memories.ts` imports from `embedding.ts`.

**Affected files:**
- Modify: `src/lib/storage/memories.ts` — remove local copy, import from embedding
- Modify: `src/lib/core/embedding.ts` — export the function

### 6. Split chats.ts

**Problem:** 242 lines mixing session CRUD, message storage, scene storage, legacy migration.

**Solution:**

| Module | Responsibility |
|--------|---------------|
| `src/lib/storage/sessions.ts` | `listSessions`, `createSession`, `updateSession`, `deleteSession` |
| `src/lib/storage/messages.ts` | `loadMessages`, `saveMessages` |
| `src/lib/storage/scene-storage.ts` | `loadScene`, `saveScene` |
| `src/lib/storage/chats.ts` | Re-exports from split modules for backward compatibility |

**Affected files:**
- Create: `src/lib/storage/sessions.ts`
- Create: `src/lib/storage/messages.ts`
- Create: `src/lib/storage/scene-storage.ts`
- Modify: `src/lib/storage/chats.ts` — re-exports only
- Modify: All importers of `chats.ts` — update import paths

### 7. Apply Branded Types

**Problem:** `branded.ts` defines `SessionId`, `CharacterId`, etc. but unused.

**Solution:** Apply to key interfaces (type-only change, no runtime impact):

- `ChatSession.id: SessionId`, `ChatSession.characterId: CharacterId`
- `ChatState.chatId: CharacterId`, `ChatState.sessionId: SessionId`
- `AgentContext.sessionId: SessionId`, `AgentContext.cardId: CharacterId`
- `MemoryRecord.sessionId: SessionId`
- `SceneState` (agent-state) `sessionId: SessionId`

**Affected files:**
- Modify: `src/lib/types/session.ts`
- Modify: `src/lib/types/agent.ts`
- Modify: `src/lib/types/memory.ts`
- Modify: `src/lib/stores/chat.ts`

## Build Order

Items should be implemented in this order to minimize conflicts:

1. **Deduplicate cosineSimilarity** — smallest, no dependencies
2. **Add persist() calls** — small, independent
3. **Unify SceneState types** — affects multiple files but contained
4. **Extract shared agent LLM caller** — depends on #3 for clean types
5. **Split chats.ts** — affects storage layer
6. **Split use-chat.ts** — affects chat layer
7. **Apply branded types** — type-only, do last to avoid conflicts during other changes

## Testing

- All existing tests must pass after each item
- No new tests needed (refactoring, not new features)
- Existing tests verify behavior is preserved

## Files Changed Summary

| Action | Files |
|--------|-------|
| Create | `agents/agent-llm.ts`, `chat/use-chat-streaming.ts`, `chat/use-chat-illustration.ts`, `chat/use-chat-helpers.ts`, `storage/sessions.ts`, `storage/messages.ts`, `storage/scene-storage.ts` |
| Modify | `agents/memory-agent.ts`, `agents/director-agent.ts`, `agents/scene-state-agent.ts`, `agents/character-state-agent.ts`, `agents/agent-runner.ts`, `chat/use-chat.ts`, `types/scene.ts`, `types/agent-state.ts`, `types/session.ts`, `types/agent.ts`, `types/memory.ts`, `stores/chat.ts`, `storage/memories.ts`, `storage/agent-states.ts`, `storage/chats.ts`, `core/embedding.ts` |
