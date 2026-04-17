# Code Quality Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up 7 code quality issues: duplicated code, missing persist calls, type inconsistencies, and overly large files.

**Architecture:** Sequential refactoring — each task is independent and produces a clean commit. All existing tests must pass after each task.

**Tech Stack:** TypeScript, Vitest, Svelte stores, sql.js

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/core/embedding.ts` | Modify | Keep cosineSimilarity here as canonical source |
| `src/lib/storage/memories.ts` | Modify | Remove local cosineSimilarity, import from embedding |
| `src/lib/storage/agent-states.ts` | Modify | Add persist() calls after writes |
| `src/lib/types/scene.ts` | Modify | Expand SceneState with agent fields |
| `src/lib/types/agent-state.ts` | Modify | Remove SceneState, use unified import |
| `src/lib/core/agents/agent-llm.ts` | Create | Shared agent LLM caller using PluginRegistry |
| `src/lib/core/agents/director-agent.ts` | Modify | Use agent-llm instead of raw fetch |
| `src/lib/core/agents/scene-state-agent.ts` | Modify | Use agent-llm instead of raw fetch |
| `src/lib/core/agents/character-state-agent.ts` | Modify | Use agent-llm instead of raw fetch |
| `src/lib/core/agents/memory-agent.ts` | Modify | Use agent-llm instead of raw fetch |
| `src/lib/storage/sessions.ts` | Create | Session CRUD extracted from chats.ts |
| `src/lib/storage/messages.ts` | Create | Message load/save extracted from chats.ts |
| `src/lib/storage/scene-storage.ts` | Create | Scene load/save extracted from chats.ts |
| `src/lib/storage/chats.ts` | Modify | Re-export from split modules |
| `src/lib/core/chat/use-chat-streaming.ts` | Create | Streaming logic extracted from use-chat.ts |
| `src/lib/core/chat/use-chat-illustration.ts` | Create | Illustration logic extracted from use-chat.ts |
| `src/lib/core/chat/use-chat-helpers.ts` | Create | Helper functions extracted from use-chat.ts |
| `src/lib/core/chat/use-chat.ts` | Modify | Thin orchestration importing from split modules |
| `src/lib/types/session.ts` | Modify | Apply branded types |
| `src/lib/types/agent.ts` | Modify | Apply branded types |
| `src/lib/types/memory.ts` | Modify | Apply branded types |
| `src/lib/stores/chat.ts` | Modify | Apply branded types |

---

### Task 1: Deduplicate cosineSimilarity

**Files:**
- Modify: `src/lib/storage/memories.ts`
- Verify: `src/lib/core/embedding.ts` (already has the function)

- [ ] **Step 1: Verify the function in embedding.ts is exported**

Read `src/lib/core/embedding.ts` and confirm `cosineSimilarity` is exported. Current signature:
```ts
export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

- [ ] **Step 2: Update memories.ts to import from embedding.ts**

In `src/lib/storage/memories.ts`:

Add import at the top:
```ts
import { cosineSimilarity } from '$lib/core/embedding';
```

Delete the local `cosineSimilarity` function (lines 13-23):
```ts
// DELETE THIS ENTIRE FUNCTION:
export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

Note: `findSimilarMemories` already calls `cosineSimilarity()` without a prefix (it was local). After removing the local definition and adding the import, it will use the imported version. No other changes needed.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/memories.ts
git commit -m "refactor: deduplicate cosineSimilarity, import from embedding.ts"
```

---

### Task 2: Add persist() Calls

**Files:**
- Modify: `src/lib/storage/memories.ts`
- Modify: `src/lib/storage/agent-states.ts`

- [ ] **Step 1: Add persist() to memories.ts write functions**

In `src/lib/storage/memories.ts`, add `persist` to the existing import from db.ts. Find the current db import (likely `import { getDb } from './db';`) and change it to `import { getDb, persist } from './db';`.

Then add `await persist()` at the end of each write function, wrapped in try/catch:

**`insertMemory`** — add after the second `db.run(...)`:
```ts
	try { await persist(); } catch {}
```

**`deleteMemory`** — add after the `db.run('DELETE FROM memories...')`:
```ts
	try { await persist(); } catch {}
```

**`deleteMemoriesForSession`** — add after `db.run('DELETE FROM summaries...')`:
```ts
	try { await persist(); } catch {}
```

Also check if `insertSummary` exists and add persist there too.

- [ ] **Step 2: Add persist() to agent-states.ts write functions**

In `src/lib/storage/agent-states.ts`, add `persist` to the db import:
```ts
import { getDb, persist } from './db';
```

Add `try { await persist(); } catch {}` at the end of:

**`updateSceneState`** — add at the very end of the function (after both the INSERT and UPDATE branches, at the closing brace level of the function).

**`updateCharacterState`** — same approach.

**`deleteCharacterState`** — add after the `db.run('DELETE...')`.

**`deleteSceneState`** — if this function exists, add persist there too.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/memories.ts src/lib/storage/agent-states.ts
git commit -m "fix: add SQLite persist() calls after write operations"
```

---

### Task 3: Unify SceneState Types

**Files:**
- Modify: `src/lib/types/scene.ts`
- Modify: `src/lib/types/agent-state.ts`
- Modify: `src/lib/core/agents/scene-state-agent.ts`
- Modify: `src/lib/core/agents/agent-runner.ts`
- Modify: `src/lib/storage/agent-states.ts`

- [ ] **Step 1: Expand SceneState in scene.ts**

Current `src/lib/types/scene.ts`:
```ts
export interface SceneState {
  location: string;
  time: string;
  mood: string;
  participatingCharacters: string[];
  variables: VariableStore;
}
```

Add the two new fields from the agent-state version:
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

- [ ] **Step 2: Update all SceneState defaults**

Search for places that create default `SceneState` objects (stores, tests, etc.) and add the new fields:

```ts
environmentalNotes: '',
lastUpdated: 0,
```

Key locations to check:
- `src/lib/stores/scene.ts` — `DEFAULT_SCENE` objects
- `src/lib/stores/settings.ts` — if it creates default scenes
- Test files that construct `SceneState` objects

- [ ] **Step 3: Update agent-state.ts to use unified SceneState**

In `src/lib/types/agent-state.ts`, remove the `SceneState` interface and import from `./scene` instead:

Remove:
```ts
export interface SceneState {
	sessionId: string;
	location: string;
	characters: string[];
	atmosphere: string;
	timeOfDay: string;
	environmentalNotes: string;
	lastUpdated: number;
}
```

Add import (if not already present):
```ts
import type { SceneState as UnifiedSceneState } from './scene';
```

For backward compatibility, add a type alias:
```ts
export type { SceneState as UnifiedSceneState } from './scene';
```

Then update `StateUpdate` to use the unified type. The `StateUpdate.scene` field currently uses the agent-state `SceneState` (which has `characters`, `atmosphere`, `timeOfDay`). After unification, it should use the unified type which has `participatingCharacters`, `mood`, `time`.

Update `StateUpdate`:
```ts
export interface StateUpdate {
	scene?: Partial<UnifiedSceneState>;
	characters?: Partial<CharacterState>[];
	directorGuidance?: DirectorGuidance;
}
```

- [ ] **Step 4: Update scene-state-agent.ts**

The agent's `SceneExtraction` interface uses agent-state field names (`characters`, `atmosphere`, `timeOfDay`). These are the LLM extraction output fields — keep them as-is since they represent the LLM response format.

The `formatScenePrompt` function reads from `SceneState` (agent-state version). Update it to read from the unified type:
- `state.characters` → `state.participatingCharacters`
- `state.atmosphere` → `state.mood`
- `state.timeOfDay` → `state.time`

The `onAfterReceive` method writes to `updatedState.scene`. Update the field mapping from extraction output to unified SceneState:
- `extraction.location` → `location`
- `extraction.characters` → `participatingCharacters`
- `extraction.atmosphere` → `mood`
- `extraction.timeOfDay` → `time`
- `extraction.environmentalNotes` → `environmentalNotes`
- Set `lastUpdated` to `Date.now()`

- [ ] **Step 5: Update agent-runner.ts state persistence**

In `src/lib/core/agents/agent-runner.ts`, the `onAfterReceive` method has field mapping:
```ts
sceneStore.update((state: any) => ({
	...state,
	location: agentScene.location || state.location,
	mood: agentScene.atmosphere || state.mood,
	time: agentScene.timeOfDay || state.time,
	participatingCharacters: agentScene.characters || state.participatingCharacters,
}));
```

Since the types are now unified, simplify this to:
```ts
sceneStore.update((state: any) => ({
	...state,
	...Object.fromEntries(
		Object.entries(agentScene).filter(([_, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
	),
}));
```

Or even simpler, direct spread:
```ts
sceneStore.update((state: any) => ({
	...state,
	location: agentScene.location || state.location,
	mood: agentScene.mood || state.mood,
	time: agentScene.time || state.time,
	participatingCharacters: agentScene.participatingCharacters || state.participatingCharacters,
	environmentalNotes: agentScene.environmentalNotes || state.environmentalNotes,
}));
```

- [ ] **Step 6: Update agent-states.ts storage**

In `src/lib/storage/agent-states.ts`, the SQL columns use the old field names (`characters`, `atmosphere`, `time_of_day`). The storage schema stays as-is (SQL column names don't need to match TypeScript field names), but the TypeScript code that maps between SQL rows and the SceneState interface needs updating.

In `getSceneState`:
```ts
// Change the return mapping from:
characters: JSON.parse(row[2] as string),
atmosphere: row[3] as string,
timeOfDay: row[4] as string,
// To:
participatingCharacters: JSON.parse(row[2] as string),
mood: row[3] as string,
time: row[4] as string,
```

In `updateSceneState`:
- Update the `Partial<Omit<SceneState, ...>>` parameter to use unified field names
- Update the object construction inside to use unified field names

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. Fix any test that constructs SceneState objects without the new fields.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: unify SceneState types, add environmentalNotes and lastUpdated"
```

---

### Task 4: Extract Shared Agent LLM Caller

**Files:**
- Create: `src/lib/core/agents/agent-llm.ts`
- Modify: `src/lib/core/agents/director-agent.ts`
- Modify: `src/lib/core/agents/scene-state-agent.ts`
- Modify: `src/lib/core/agents/character-state-agent.ts`
- Modify: `src/lib/core/agents/memory-agent.ts`

- [ ] **Step 1: Create agent-llm.ts**

Create `src/lib/core/agents/agent-llm.ts`:

```ts
import type { Message } from '$lib/types/message';
import type { UserConfig } from '$lib/types/config';
import type { ChatMetadata } from '$lib/types/plugin';
import { getRegistry } from '$lib/core/bootstrap';

export interface AgentLLMConfig {
	providerId: string;
	apiKey: string;
	model: string;
	baseUrl?: string;
	temperature?: number;
	maxTokens?: number;
}

export async function callAgentLLM(
	systemPrompt: string,
	userContent: string,
	config: AgentLLMConfig,
	timeout = 30000,
): Promise<string> {
	const provider = getRegistry().getProvider(config.providerId);
	const messages: Message[] = [
		{ role: 'system', content: systemPrompt, type: 'system', timestamp: 0 },
		{ role: 'user', content: userContent, type: 'dialogue', timestamp: 0 },
	];

	const chatConfig: UserConfig = {
		providerId: config.providerId,
		model: config.model,
		apiKey: config.apiKey,
		baseUrl: config.baseUrl,
		temperature: config.temperature,
		maxTokens: config.maxTokens ?? 1024,
	};

	const metadata: ChatMetadata = {};
	let fullText = '';

	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), timeout);

	try {
		for await (const token of provider.chat(messages, chatConfig, metadata)) {
			fullText += token;
		}
		clearTimeout(timeoutId);
		return fullText;
	} catch (error) {
		clearTimeout(timeoutId);
		throw error;
	}
}
```

- [ ] **Step 2: Refactor director-agent.ts**

In `src/lib/core/agents/director-agent.ts`:

Add import:
```ts
import { callAgentLLM } from './agent-llm';
```

Replace the `callDirectorModel` function. Current function is ~80 lines of raw fetch logic. Replace with:

```ts
async function callDirectorModel(context: string, mode: DirectorMode): Promise<DirectorGuidance | null> {
	const config = getDirectorConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	const modePrompt = mode === 'absolute'
		? 'This is top-priority direction. The response must obey it and create a strong narrative turn now.'
		: mode === 'strong'
			? 'Apply strong directorial control and force a meaningful beat in this response.'
			: 'Apply light but persistent guidance to keep the scene moving.';

	const systemPrompt = `${DIRECTOR_SYSTEM_PROMPT}\n\nMode: ${modePrompt}`;

	try {
		const text = await callAgentLLM(systemPrompt, context, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: 1024,
		});
		return parseDirectorOutput(text);
	} catch {
		return null;
	}
}
```

Remove all unused imports that were only needed for the raw fetch (AbortController, etc.).

- [ ] **Step 3: Refactor scene-state-agent.ts**

In `src/lib/core/agents/scene-state-agent.ts`:

Add import:
```ts
import { callAgentLLM } from './agent-llm';
```

Replace `callSceneExtractionModel` function (~70 lines) with:

```ts
async function callSceneExtractionModel(response: string): Promise<SceneExtraction | null> {
	const config = getSceneConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	try {
		const text = await callAgentLLM(SCENE_SYSTEM_PROMPT, response, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: 512,
		});
		return parseSceneOutput(text);
	} catch {
		return null;
	}
}
```

- [ ] **Step 4: Refactor character-state-agent.ts**

In `src/lib/core/agents/character-state-agent.ts`:

Add import:
```ts
import { callAgentLLM } from './agent-llm';
```

Replace `callCharacterExtractionModel` function (~70 lines) with:

```ts
async function callCharacterExtractionModel(response: string): Promise<CharacterExtraction | null> {
	const config = getCharacterConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	try {
		const text = await callAgentLLM(CHARACTER_SYSTEM_PROMPT, response, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: 1024,
		});
		return parseCharacterOutput(text);
	} catch {
		return null;
	}
}
```

- [ ] **Step 5: Refactor memory-agent.ts**

In `src/lib/core/agents/memory-agent.ts`:

Add import:
```ts
import { callAgentLLM } from './agent-llm';
```

Replace `callExtractionModel` function (~50 lines) with:

```ts
async function callExtractionModel(conversation: string, prompt: string): Promise<string> {
	const config = getModelConfig();
	if (!config.provider || !config.apiKey || !config.model) {
		throw new Error('No model configured for memory extraction');
	}

	return callAgentLLM(prompt, conversation, {
		providerId: config.provider,
		apiKey: config.apiKey,
		model: config.model,
		baseUrl: config.baseUrl,
		temperature: config.temperature,
		maxTokens: 2048,
	});
}
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. Note: Agent tests that mock the LLM response may need adjustment since the call path changes from raw fetch to provider.chat().

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: extract shared agent LLM caller using PluginRegistry"
```

---

### Task 5: Split chats.ts

**Files:**
- Create: `src/lib/storage/sessions.ts`
- Create: `src/lib/storage/messages.ts`
- Create: `src/lib/storage/scene-storage.ts`
- Modify: `src/lib/storage/chats.ts`
- Modify: All files that import from `chats.ts`

- [ ] **Step 1: Identify all exports from chats.ts**

Read `src/lib/storage/chats.ts` and list all exported functions. Group them:

**Session functions:** `listSessions`, `createSession`, `updateSession`, `deleteSession`
**Message functions:** `loadMessages`, `saveMessages`, `loadMessagesLegacy`, `saveMessagesLegacy`
**Scene functions:** `loadScene`, `saveScene`, `loadSceneLegacy`, `saveSceneLegacy`
**Other:** `migrateLegacyChat`, `deleteChat`

- [ ] **Step 2: Create sessions.ts**

Create `src/lib/storage/sessions.ts`. Move session-related functions and their dependencies (imports for paths, database helpers). Include the `ChatSession` type import.

Key functions to move:
- `listSessions`
- `createSession`
- `updateSession`
- `deleteSession`
- `migrateLegacyChat` (if it's session-related)

- [ ] **Step 3: Create messages.ts**

Create `src/lib/storage/messages.ts`. Move message-related functions:

Key functions to move:
- `loadMessages`
- `saveMessages`
- `loadMessagesLegacy`
- `saveMessagesLegacy`

- [ ] **Step 4: Create scene-storage.ts**

Create `src/lib/storage/scene-storage.ts`. Move scene-related functions:

Key functions to move:
- `loadScene`
- `saveScene`
- `loadSceneLegacy`
- `saveSceneLegacy`

- [ ] **Step 5: Update chats.ts to re-export**

In `src/lib/storage/chats.ts`, replace the moved functions with re-exports:

```ts
export { listSessions, createSession, updateSession, deleteSession } from './sessions';
export { loadMessages, saveMessages } from './messages';
export { loadScene, saveScene } from './scene-storage';
```

Keep any remaining functions that don't fit neatly (like `deleteChat`).

- [ ] **Step 6: Update imports across the codebase**

Search for files that import from `chats.ts`:
```bash
rg "from.*storage/chats" src/
```

Since `chats.ts` re-exports everything, existing imports should still work. But update direct imports to use the new modules where possible (e.g., `chat-repo.ts` could import from `./sessions` directly).

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: split chats.ts into sessions, messages, scene-storage modules"
```

---

### Task 6: Split use-chat.ts

**Files:**
- Create: `src/lib/core/chat/use-chat-streaming.ts`
- Create: `src/lib/core/chat/use-chat-illustration.ts`
- Create: `src/lib/core/chat/use-chat-helpers.ts`
- Modify: `src/lib/core/chat/use-chat.ts`

- [ ] **Step 1: Create use-chat-helpers.ts**

Read `src/lib/core/chat/use-chat.ts` and extract helper functions.

Create `src/lib/core/chat/use-chat-helpers.ts`:

Move these functions:
- `resolveActiveCard`
- `resolvePersona`
- `worldCardToCharacterCard`
- `getSessionPersonaId`
- `ResolvedCard` interface

Include all necessary imports (stores, types, storage functions).

- [ ] **Step 2: Create use-chat-streaming.ts**

Create `src/lib/core/chat/use-chat-streaming.ts`:

Move these functions:
- `stripThinking`
- `streamAndFinalize`

`streamAndFinalize` calls `chatStore`, `chatRepo`, and the illustration function. Import these.

- [ ] **Step 3: Create use-chat-illustration.ts**

Create `src/lib/core/chat/use-chat-illustration.ts`:

Move these functions:
- `generateAndInsertIllustrations`
- `generateIllustration`

- [ ] **Step 4: Update use-chat.ts**

Replace moved code with imports:

```ts
import { resolveActiveCard, resolvePersona, getSessionPersonaId } from './use-chat-helpers';
import { streamAndFinalize } from './use-chat-streaming';
```

Keep in use-chat.ts:
- `initChat`
- `injectFirstMessage`
- `sendMessage`
- `editMessage`
- `rerollFromMessage`

These become thin functions that import helpers from the split modules.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: split use-chat.ts into streaming, illustration, helpers modules"
```

---

### Task 7: Apply Branded Types

**Files:**
- Modify: `src/lib/types/session.ts`
- Modify: `src/lib/types/agent.ts`
- Modify: `src/lib/types/memory.ts`
- Modify: `src/lib/stores/chat.ts`

- [ ] **Step 1: Apply to session.ts**

In `src/lib/types/session.ts`, import branded types and apply:

```ts
import type { SessionId, CharacterId } from './branded';

export interface ChatSession {
  id: SessionId;
  characterId: CharacterId;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  personaId?: string;
  cardType?: 'character' | 'world';
}
```

- [ ] **Step 2: Apply to agent.ts**

In `src/lib/types/agent.ts`, import and apply:

```ts
import type { SessionId, CharacterId } from './branded';

export interface AgentContext {
  sessionId: SessionId;
  cardId: CharacterId;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
  config: UserConfig;
}
```

- [ ] **Step 3: Apply to memory.ts**

In `src/lib/types/memory.ts`, import and apply:

```ts
import type { SessionId } from './branded';

export interface MemoryRecord {
  id: string;
  sessionId: SessionId;
  // ...rest unchanged
}
```

- [ ] **Step 4: Apply to chat store**

In `src/lib/stores/chat.ts`, update the ChatState interface:

```ts
import type { CharacterId, SessionId } from '$lib/types/branded';

interface ChatState {
  chatId: CharacterId | null;
  sessionId: SessionId | null;
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string | null;
  isStreaming: boolean;
}
```

- [ ] **Step 5: Fix all resulting type errors**

After applying branded types, many places that pass plain `string` values to branded fields will error. Fix them by using the factory functions:

```ts
import { makeCharacterId, makeSessionId } from '$lib/types/branded';

// Where strings are assigned to branded fields:
const id = makeSessionId(crypto.randomUUID());
```

Search for all compile errors and fix them. Key locations:
- `src/lib/storage/chats.ts` / `sessions.ts` — where sessions are created
- `src/lib/stores/chat.ts` — where chatId/sessionId are set
- `src/lib/repositories/chat-repo.ts` — bridges storage to store
- `src/lib/core/chat/use-chat.ts` — passes characterId
- `src/lib/core/chat/engine.ts` — creates AgentContext
- `src/lib/core/agents/*.ts` — receive AgentContext

- [ ] **Step 6: Run type check**

Run: `npx svelte-check --tsconfig ./tsconfig.json`
Expected: No new errors related to branded types

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: apply branded types to SessionId, CharacterId across codebase"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx svelte-check --tsconfig ./tsconfig.json`
Expected: No new errors

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address integration issues from final verification"
```
