# Session System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the session system with data integrity fixes, robustness improvements, UI/UX enhancements, and new capabilities.

**Architecture:** Incremental refactor of existing modules. Keep JSON file storage. Fix types, add atomic writes, session cache, soft-delete archive, and UI features.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vitest, Tauri FS plugin, sql.js (memories only)

**Spec:** `docs/superpowers/specs/2026-04-18-session-system-overhaul-design.md`

---

## File Structure

### New files
- `src/lib/storage/export-session.ts` — session export logic
- `tests/storage/export-session.test.ts` — export tests

### Modified files
- `src/lib/storage/database.ts` — add `writeJsonAtomic`
- `src/lib/storage/paths.ts` — add archive path helpers
- `src/lib/storage/sessions.ts` — `SessionsFile` structure, archive ops, pinnedAt, cardType
- `src/lib/storage/messages.ts` — remove `updateSession` side effect
- `src/lib/storage/memories.ts` — add `countMemories`
- `src/lib/types/session.ts` — add `pinnedAt`, fix `personaId` type
- `src/lib/stores/chat.ts` — rename `chatId` → `characterId`
- `src/lib/stores/scene.ts` — add typed public fields for characterId/sessionId
- `src/lib/repositories/chat-repo.ts` — session cache, preview updates, remove redundancy
- `src/lib/repositories/scene-repo.ts` — fix type-unsafe cast
- `src/lib/core/chat/use-chat.ts` — `chatId` → `characterId` references
- `src/lib/core/chat/use-chat-helpers.ts` — cache-based `getSessionPersonaId`
- `src/lib/components/SessionItem.svelte` — pin, export, memory badge, archive variant
- `src/lib/components/SessionPanel.svelte` — sorting, search, archive, name dialog
- `src/routes/chat/[id]/+page.svelte` — wire up new operations

### Test files to update
- `tests/storage/sessions.test.ts`
- `tests/storage/messages.test.ts`
- `tests/storage/memories.test.ts`
- `tests/repositories/chat-repo.test.ts`
- `tests/repositories/scene-repo.test.ts`
- `tests/stores/chat.test.ts`

---

### Task 1: Atomic writes

**Files:**
- Modify: `src/lib/storage/database.ts`
- Modify: `tests/storage/database.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/storage/database.test.ts`:

```typescript
import { vi } from 'vitest';

describe('writeJsonAtomic', () => {
  it('writes to temp file then renames', async () => {
    const { writeJsonAtomic } = await import('$lib/storage/database');
    const writtenPaths: string[] = [];
    const renamedFrom: string[] = [];
    const renamedTo: string[] = [];

    vi.doMock('@tauri-apps/plugin-fs', () => ({
      writeTextFile: async (path: string, _data: string) => { writtenPaths.push(path); },
      rename: async (from: string, to: string) => { renamedFrom.push(from); renamedTo.push(to); },
      readTextFile: async () => '{}',
      mkdir: async () => {},
      readDir: async () => [],
      exists: async () => true,
      remove: async () => {},
      BaseDirectory: { AppData: 1 },
    }));

    await writeJsonAtomic('test/path.json', { hello: 'world' });

    expect(writtenPaths).toEqual(['test/path.json.tmp']);
    expect(renamedFrom).toEqual(['test/path.json.tmp']);
    expect(renamedTo).toEqual(['test/path.json']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/database.test.ts`
Expected: FAIL — `writeJsonAtomic` is not exported

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/storage/database.ts`:

```typescript
import { rename } from '@tauri-apps/plugin-fs';

export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeTextFile(tmpPath, JSON.stringify(data, null, 2), BASE);
  await rename(tmpPath, path, BASE);
}
```

Also add `rename` to the existing import from `@tauri-apps/plugin-fs` at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage/database.test.ts`
Expected: PASS

- [ ] **Step 5: Replace existing `writeJson` calls in sessions.ts, messages.ts, scene-storage.ts with `writeJsonAtomic`**

In `src/lib/storage/sessions.ts`, change the import and all `writeJson` calls:
- `import { readJson, writeJson, ... }` → `import { readJson, writeJsonAtomic, ... }`
- Replace every `writeJson(...)` call with `writeJsonAtomic(...)`

Do the same in `src/lib/storage/messages.ts` and `src/lib/storage/scene-storage.ts`.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add writeJsonAtomic for crash-safe file writes"
```

---

### Task 2: Type corrections — ChatSession and chatStore

**Files:**
- Modify: `src/lib/types/session.ts`
- Modify: `src/lib/stores/chat.ts`
- Modify: `src/lib/storage/sessions.ts`
- Modify: `src/lib/repositories/chat-repo.ts`
- Modify: `src/lib/core/chat/use-chat.ts`
- Modify: `src/lib/core/chat/use-chat-helpers.ts`
- Modify: `src/routes/chat/[id]/+page.svelte`
- Modify: `tests/stores/chat.test.ts`
- Modify: `tests/repositories/chat-repo.test.ts`

- [ ] **Step 1: Update `ChatSession` type**

In `src/lib/types/session.ts`:

Change `personaId?: string` to `personaId?: PersonaId` (import `PersonaId` from `./branded`).

Add `pinnedAt?: number` field.

Result:
```typescript
import type { CharacterId, SessionId, PersonaId } from './branded';

export interface ChatSession {
  id: SessionId;
  characterId: CharacterId;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  personaId?: PersonaId;
  cardType?: 'character' | 'world';
  pinnedAt?: number;
}
```

- [ ] **Step 2: Rename `chatId` → `characterId` in chatStore**

In `src/lib/stores/chat.ts`, rename every occurrence of `chatId` to `characterId`:

- `ChatState.chatId` → `ChatState.characterId`
- `setSessionState(chatId, ...)` → `setSessionState(characterId, ...)`
- All references in `clear()`, `setSessionState()`, etc.

- [ ] **Step 3: Update all consumers of `state.chatId`**

Find every file that references `state.chatId` or `chatStore` with `chatId` and rename to `characterId`. Key files:

- `src/lib/repositories/chat-repo.ts` — `state.chatId` → `state.characterId` (2 occurrences in `saveMessages`)
- `src/lib/core/chat/use-chat-helpers.ts` — `state.chatId` → `state.characterId` (in `getSessionPersonaId`)
- `src/routes/chat/[id]/+page.svelte` — any references to `chatState.chatId` → `chatState.characterId`
- `tests/stores/chat.test.ts` — `chatId` → `characterId` in all assertions
- `tests/repositories/chat-repo.test.ts` — same

Use a project-wide search for `chatId` (excluding the string literal `"chatId"` in logs and the field name in ChatSession which is already `characterId`) and update each occurrence.

- [ ] **Step 4: Set `cardType` in `createSession`**

In `src/lib/storage/sessions.ts`, update the `createSession` function to accept an optional `cardType`:

```typescript
export async function createSession(
  characterId: string,
  name?: string,
  cardType?: 'character' | 'world',
): Promise<ChatSession> {
```

Add `cardType` to the session object:

```typescript
const session: ChatSession = {
  id: makeSessionId(crypto.randomUUID()),
  characterId: makeCharacterId(characterId),
  name: name ?? `Chat ${sessions.length + 1}`,
  createdAt: now,
  lastMessageAt: now,
  preview: '',
  cardType,
};
```

Also update the `migrateLegacyChat` function — set `cardType: undefined` (no card type info available for legacy sessions).

- [ ] **Step 5: Update test files**

Update `tests/stores/chat.test.ts` — rename all `chatId` to `characterId`.

Update `tests/repositories/chat-repo.test.ts` — rename all `chatId` to `characterId`.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: fix session types — branded personaId, characterId rename, cardType in createSession"
```

---

### Task 3: Fix scene-repo type-unsafe cast

**Files:**
- Modify: `src/lib/stores/scene.ts`
- Modify: `src/lib/repositories/scene-repo.ts`
- Modify: `tests/repositories/scene-repo.test.ts` (if exists)

- [ ] **Step 1: Add typed SceneState interface with context fields**

In `src/lib/stores/scene.ts`, the store already includes `currentCharacterId` and `currentSessionId` in the internal state. The issue is that `scene-repo.ts` accesses these via `state as any`.

Export a `SceneStateWithContext` type so consumers can access these fields without casting:

```typescript
export interface SceneStateWithContext extends SceneState {
  currentCharacterId: string | null;
  currentSessionId: string | null;
}
```

Update the store's type to use this explicitly:

```typescript
function createSceneStore() {
  const DEFAULT_SCENE: SceneStateWithContext = {
    location: '',
    time: '',
    mood: '',
    participatingCharacters: [],
    variables: {},
    environmentalNotes: '',
    lastUpdated: 0,
    currentCharacterId: null,
    currentSessionId: null,
  };

  const { subscribe, set, update } = writable<SceneStateWithContext>(DEFAULT_SCENE);
  // ... rest unchanged
}
```

- [ ] **Step 2: Fix scene-repo to use typed access**

In `src/lib/repositories/scene-repo.ts`, update the `save()` method:

Change:
```typescript
const state = get(sceneStore);
const { currentCharacterId, currentSessionId } = state as any;
```

To:
```typescript
const state = get(sceneStore);
const { currentCharacterId, currentSessionId } = state;
```

Import `SceneStateWithContext` if needed for explicit typing (the `get()` return should already be typed correctly now).

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: remove type-unsafe cast in scene-repo, export SceneStateWithContext"
```

---

### Task 4: Remove cross-layer coupling in messages.ts

**Files:**
- Modify: `src/lib/storage/messages.ts`
- Modify: `src/lib/repositories/chat-repo.ts`
- Modify: `tests/storage/messages.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/storage/messages.test.ts`:

```typescript
it('saveMessages does not call updateSession', async () => {
  const { updateSession } = await import('$lib/storage/sessions');
  const spy = vi.spyOn(await import('$lib/storage/sessions'), 'updateSession');

  await saveMessages('char-1', 'sess-1', [{ role: 'user', content: 'hello', type: 'dialogue', timestamp: Date.now() }]);

  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/messages.test.ts`
Expected: FAIL — `updateSession` is called

- [ ] **Step 3: Remove the side effect from `messages.ts`**

In `src/lib/storage/messages.ts`:

1. Remove the `import { updateSession } from './sessions';` line.
2. Remove the import of `updateSession` from the existing `import { listSessions, createSession, migrateLegacyChat } from './sessions';` line (it's on a separate import).
3. Simplify `saveMessages` to:

```typescript
export async function saveMessages(
  characterId: string,
  sessionId: string,
  messages: Message[],
): Promise<void> {
  await ensureDir(PATHS.sessionDir(characterId, sessionId));
  await writeJsonAtomic(PATHS.sessionMessages(characterId, sessionId), messages);
}
```

- [ ] **Step 4: Add preview update to `chat-repo.saveMessages`**

In `src/lib/repositories/chat-repo.ts`, update `saveMessages` to include the preview/metadata update that was removed from `messages.ts`:

```typescript
async saveMessages(): Promise<void> {
  const state = get(chatStore);
  if (state.characterId && state.sessionId) {
    try {
      const characterId = state.characterId as string;
      const sessionId = state.sessionId as string;
      await chatStorage.saveMessages(characterId, sessionId, state.messages);

      const lastMsg = state.messages.length > 0 ? state.messages[state.messages.length - 1] : null;
      if (lastMsg) {
        const role = lastMsg.role === 'user' ? 'You' : '';
        const prefix = role ? `${role}: ` : '';
        await chatStorage.updateSession(characterId, sessionId, {
          lastMessageAt: lastMsg.timestamp,
          preview: `${prefix}${lastMsg.content}`.slice(0, 120),
        });
      }

      log.debug('Messages saved', {
        characterId,
        sessionId,
        messageCount: state.messages.length
      });
    } catch (error) {
      throw new StorageError(
        'saveMessages',
        'Failed to save messages',
        error as Error
      );
    }
  }
},
```

Import `updateSession` is already available through `chatStorage` (which re-exports from `sessions.ts`). Verify that `chatStorage.updateSession` is accessible — if not, add it to the re-exports in `src/lib/storage/chats.ts`.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move session metadata update from messages.ts to chat-repo"
```

---

### Task 5: Remove redundancy in chat-repo

**Files:**
- Modify: `src/lib/repositories/chat-repo.ts`

- [ ] **Step 1: Fix double `listSessions` call in `loadChat`**

In `src/lib/repositories/chat-repo.ts`, the `loadChat` method currently calls `listSessions` twice (lines 54-55). Remove the first call since `listSessions` already handles migration internally:

Change:
```typescript
await chatStorage.listSessions(chatId); // triggers migration
const sessions = await chatStorage.listSessions(chatId);
```

To:
```typescript
const sessions = await chatStorage.listSessions(chatId);
```

- [ ] **Step 2: Remove `loadSessionById` method**

Delete the entire `loadSessionById` method from `chatRepo`:

```typescript
async loadSessionById(characterId: string, sessionId: string): Promise<void> {
  await this.loadSession(characterId, sessionId);
},
```

- [ ] **Step 3: Search for any callers of `loadSessionById` and update them to use `loadSession` directly**

Search the codebase for `loadSessionById` references. If found, replace with `loadSession`. If none found, proceed.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove redundant listSessions call and loadSessionById alias"
```

---

### Task 6: SessionsFile structure and archive paths

**Files:**
- Modify: `src/lib/storage/paths.ts`
- Modify: `src/lib/storage/sessions.ts`
- Modify: `src/lib/types/session.ts`
- Modify: `tests/storage/sessions.test.ts`

- [ ] **Step 1: Add archive path to paths.ts**

In `src/lib/storage/paths.ts`, add:

```typescript
sessionArchive: (characterId: string) => `chats/${characterId}/.archive`,
sessionArchiveDir: (characterId: string, sessionId: string) => `chats/${characterId}/.archive/${sessionId}`,
```

- [ ] **Step 2: Define `SessionsFile` type in session.ts**

In `src/lib/types/session.ts`, add:

```typescript
export interface SessionsFile {
  sessions: ChatSession[];
  archivedSessions?: ChatSession[];
}
```

- [ ] **Step 3: Update `sessions.ts` to use `SessionsFile` format**

In `src/lib/storage/sessions.ts`:

1. Import `SessionsFile` from `'$lib/types/session'`.
2. Add a migration helper:

```typescript
async function readSessionsFile(characterId: string): Promise<SessionsFile> {
  const indexPath = PATHS.sessionsIndex(characterId);
  if (!(await existsPath(indexPath))) {
    return { sessions: [] };
  }
  try {
    const data = await readJson<SessionsFile | ChatSession[]>(indexPath);
    if (Array.isArray(data)) {
      return { sessions: data };
    }
    return data;
  } catch {
    return { sessions: [] };
  }
}

async function writeSessionsFile(characterId: string, file: SessionsFile): Promise<void> {
  await writeJsonAtomic(PATHS.sessionsIndex(characterId), file);
}
```

3. Update `listSessions` to use `readSessionsFile`:

```typescript
export async function listSessions(characterId: string): Promise<ChatSession[]> {
  if (!(await existsPath(PATHS.sessionsIndex(characterId)))) {
    await migrateLegacyChat(characterId);
  }
  const file = await readSessionsFile(characterId);
  return file.sessions;
}
```

4. Update `listArchivedSessions` (new function):

```typescript
export async function listArchivedSessions(characterId: string): Promise<ChatSession[]> {
  const file = await readSessionsFile(characterId);
  return file.archivedSessions ?? [];
}
```

5. Update `createSession` to use `readSessionsFile` / `writeSessionsFile`.

6. Update `updateSession` to use `readSessionsFile` / `writeSessionsFile`.

7. Update `deleteSession` to use `readSessionsFile` / `writeSessionsFile`.

- [ ] **Step 4: Write tests for new SessionsFile format**

Add to `tests/storage/sessions.test.ts`:

```typescript
it('handles legacy array format in sessions.json', async () => { ... });
it('reads archivedSessions from SessionsFile format', async () => { ... });
it('writes SessionsFile format with archivedSessions', async () => { ... });
```

Mock the file system to return a plain `ChatSession[]` array (legacy format) and verify `listSessions` still works. Then test the new format.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/storage/sessions.test.ts`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add SessionsFile structure with archive support"
```

---

### Task 7: Session index cache in chat-repo

**Files:**
- Modify: `src/lib/repositories/chat-repo.ts`
- Modify: `src/lib/core/chat/use-chat-helpers.ts`
- Modify: `tests/repositories/chat-repo.test.ts`

- [ ] **Step 1: Add cache to chat-repo**

In `src/lib/repositories/chat-repo.ts`:

```typescript
import type { ChatSession } from '$lib/types';
import type { CharacterId } from '$lib/types/branded';

const _sessionCache = new Map<string, ChatSession[]>();

function cacheKey(characterId: string): string {
  return characterId;
}

function invalidateCache(characterId: string): void {
  _sessionCache.delete(cacheKey(characterId));
}

export const chatRepo = {
  async getCachedSessions(characterId: string): Promise<ChatSession[]> {
    const key = cacheKey(characterId);
    if (_sessionCache.has(key)) {
      return _sessionCache.get(key)!;
    }
    const sessions = await chatStorage.listSessions(characterId);
    _sessionCache.set(key, sessions);
    return sessions;
  },

  // ... existing methods, updated to use cache and invalidate on mutations
};
```

Update `loadChat` to use `getCachedSessions` instead of direct `listSessions` calls.

Update `createSession`, `saveMessages` (which calls `updateSession`), and any mutation methods to call `invalidateCache(characterId)` after the mutation.

Add `invalidateCache(characterId)` call in `loadSession` when `characterId` changes (track previous characterId).

Export `getCachedSessions` and `invalidateCache` for use by `use-chat-helpers.ts`.

- [ ] **Step 2: Update `getSessionPersonaId` to use cache**

In `src/lib/core/chat/use-chat-helpers.ts`:

Change `getSessionPersonaId` to use the cached repo method instead of direct `listSessions`:

```typescript
import { chatRepo } from '$lib/repositories/chat-repo';

export async function getSessionPersonaId(): Promise<string | undefined> {
  const state = get(chatStore);
  if (!state.characterId || !state.sessionId) return undefined;
  try {
    const sessions = await chatRepo.getCachedSessions(state.characterId as string);
    const session = sessions.find(s => s.id === state.sessionId);
    return session?.personaId as string | undefined;
  } catch {
    return undefined;
  }
}
```

Remove the direct `import { listSessions } from '$lib/storage/chats'` if no longer needed.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add session index cache to chat-repo for faster persona lookups"
```

---

### Task 8: Soft-delete with archive

**Files:**
- Modify: `src/lib/storage/sessions.ts`
- Modify: `src/lib/storage/chats.ts` (re-exports)
- Modify: `src/lib/repositories/chat-repo.ts`
- Modify: `tests/storage/sessions.test.ts`

- [ ] **Step 1: Write tests for archive/restore/permanent delete**

Add to `tests/storage/sessions.test.ts`:

```typescript
it('archiveSession moves session to archivedSessions', async () => { ... });
it('archiveSession moves directory to .archive', async () => { ... });
it('restoreSession moves session back to active and restores directory', async () => { ... });
it('permanentDeleteSession removes archived session directory and entry', async () => { ... });
it('listArchivedSessions returns archived sessions', async () => { ... });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/storage/sessions.test.ts`
Expected: FAIL — archive functions not exported

- [ ] **Step 3: Implement archive operations**

Add to `src/lib/storage/sessions.ts`:

```typescript
export async function archiveSession(characterId: string, sessionId: string): Promise<void> {
  const file = await readSessionsFile(characterId);
  const idx = file.sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return;

  const [session] = file.sessions.splice(idx, 1);
  file.archivedSessions = [...(file.archivedSessions ?? []), session];

  await ensureDir(PATHS.sessionArchive(characterId));
  await writeSessionsFile(characterId, file);

  // Move directory to archive
  const srcDir = PATHS.sessionDir(characterId, sessionId);
  const destDir = PATHS.sessionArchiveDir(characterId, sessionId);
  if (await existsPath(srcDir)) {
    await ensureDir(PATHS.sessionArchive(characterId));
    // Copy files then remove source (Tauri FS may not have rename across dirs)
    const { readDir, readTextFile, writeTextFile, mkdir, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const BASE = { baseDir: BaseDirectory.AppData };
    await mkdir(destDir, { ...BASE, recursive: true });
    const entries = await readDir(srcDir, BASE);
    for (const entry of entries) {
      const content = await readTextFile(`${srcDir}/${entry.name}`, BASE);
      await writeTextFile(`${destDir}/${entry.name}`, content, BASE);
    }
    await remove(srcDir, { ...BASE, recursive: true });
  }
}

export async function restoreSession(characterId: string, sessionId: string): Promise<void> {
  const file = await readSessionsFile(characterId);
  const archived = file.archivedSessions ?? [];
  const idx = archived.findIndex(s => s.id === sessionId);
  if (idx === -1) return;

  const [session] = archived.splice(idx, 1);
  file.archivedSessions = archived.length > 0 ? archived : undefined;
  file.sessions.push(session);
  await writeSessionsFile(characterId, file);

  // Move directory back from archive
  const srcDir = PATHS.sessionArchiveDir(characterId, sessionId);
  const destDir = PATHS.sessionDir(characterId, sessionId);
  if (await existsPath(srcDir)) {
    const { readDir, readTextFile, writeTextFile, mkdir, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const BASE = { baseDir: BaseDirectory.AppData };
    await ensureDir(destDir);
    const entries = await readDir(srcDir, BASE);
    for (const entry of entries) {
      const content = await readTextFile(`${srcDir}/${entry.name}`, BASE);
      await writeTextFile(`${destDir}/${entry.name}`, content, BASE);
    }
    await remove(srcDir, { ...BASE, recursive: true });
  }
}

export async function permanentDeleteSession(characterId: string, sessionId: string): Promise<void> {
  const file = await readSessionsFile(characterId);
  const archived = file.archivedSessions ?? [];
  file.archivedSessions = archived.filter(s => s.id !== sessionId);
  if (file.archivedSessions.length === 0) file.archivedSessions = undefined;
  await writeSessionsFile(characterId, file);

  await removePath(PATHS.sessionArchiveDir(characterId, sessionId));
}
```

Also re-export these from `src/lib/storage/chats.ts`.

- [ ] **Step 4: Update chat-repo to expose archive operations and invalidate cache**

Add to `chatRepo` in `src/lib/repositories/chat-repo.ts`:

```typescript
async archiveSession(characterId: string, sessionId: string): Promise<void> {
  await chatStorage.archiveSession(characterId, sessionId);
  invalidateCache(characterId);
},

async restoreSession(characterId: string, sessionId: string): Promise<string> {
  await chatStorage.restoreSession(characterId, sessionId);
  invalidateCache(characterId);
  return sessionId;
},

async permanentDeleteSession(characterId: string, sessionId: string): Promise<void> {
  await chatStorage.permanentDeleteSession(characterId, sessionId);
  invalidateCache(characterId);
},

async getArchivedSessions(characterId: string): Promise<ChatSession[]> {
  return chatStorage.listArchivedSessions(characterId);
},
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/storage/sessions.test.ts`
Expected: All tests pass

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add soft-delete with archive for sessions"
```

---

### Task 9: Preview improvements

**Files:**
- Modify: `src/lib/repositories/chat-repo.ts` (already updated in Task 4)
- Modify: `tests/repositories/chat-repo.test.ts`

- [ ] **Step 1: Write test for role-prefix preview**

Add to `tests/repositories/chat-repo.test.ts`:

```typescript
it('saveMessages updates preview with role prefix for user messages', async () => {
  // ...setup: add a user message to chatStore
  // verify updateSession is called with "You: message content" prefix
});

it('saveMessages updates preview with 120 char limit', async () => {
  // ...setup: add a long message
  // verify preview is sliced to 120 chars
});
```

- [ ] **Step 2: Verify preview logic in chat-repo.saveMessages**

The preview logic was already added in Task 4. Verify the role prefix logic:

For user messages: `You: ${content}`.slice(0, 120)
For assistant messages: just `${content}`.slice(0, 120) (the character name would require card lookup which adds complexity; keep it simple for now).

Update the preview logic in `chat-repo.saveMessages` if needed:

```typescript
const prefix = lastMsg.role === 'user' ? 'You: ' : '';
const preview = `${prefix}${lastMsg.content}`.slice(0, 120);
await chatStorage.updateSession(characterId, sessionId, {
  lastMessageAt: lastMsg.timestamp,
  preview,
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: improve session preview with role prefix and 120 char limit"
```

---

### Task 10: Session export

**Files:**
- Create: `src/lib/storage/export-session.ts`
- Create: `tests/storage/export-session.test.ts`
- Modify: `src/lib/storage/chats.ts` (re-export)

- [ ] **Step 1: Define the export type**

Create `src/lib/storage/export-session.ts`:

```typescript
import type { ChatSession } from '$lib/types/session';
import type { Message } from '$lib/types';
import type { SceneState } from '$lib/types/scene';
import { readJson, existsPath } from './database';
import { PATHS } from './paths';

export interface SessionExport {
  version: 1;
  exportedAt: number;
  card: { id: string; name: string; type: 'character' | 'world' };
  session: ChatSession;
  messages: Message[];
  scene: SceneState | null;
}

export async function buildSessionExport(
  characterId: string,
  sessionId: string,
  cardName: string,
  cardType: 'character' | 'world',
): Promise<SessionExport> {
  const messages = await readJson<Message[]>(PATHS.sessionMessages(characterId, sessionId)).catch(() => []);
  let scene: SceneState | null = null;
  if (await existsPath(PATHS.sessionScene(characterId, sessionId))) {
    scene = await readJson<SceneState>(PATHS.sessionScene(characterId, sessionId)).catch(() => null);
  }
  const sessions = await readJson<ChatSession[]>(PATHS.sessionsIndex(characterId)).catch(() => []);
  const session = sessions.find(s => s.id === sessionId);

  return {
    version: 1,
    exportedAt: Date.now(),
    card: { id: characterId, name: cardName, type: cardType },
    session: session!,
    messages,
    scene,
  };
}

export function serializeExport(exp: SessionExport): string {
  return JSON.stringify(exp, null, 2);
}
```

- [ ] **Step 2: Write tests**

Create `tests/storage/export-session.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('export-session', () => {
  it('builds export with messages, scene, and session metadata', async () => { ... });
  it('handles missing scene gracefully (null)', async () => { ... });
  it('serializes to JSON string', () => { ... });
});
```

Mock `database.ts` to return test data for the paths.

- [ ] **Step 3: Add re-export in chats.ts**

Add to `src/lib/storage/chats.ts`:

```typescript
export { buildSessionExport, serializeExport } from './export-session';
export type { SessionExport } from './export-session';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/storage/export-session.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add session export with buildSessionExport and serializeExport"
```

---

### Task 11: Memory count per session

**Files:**
- Modify: `src/lib/storage/memories.ts`
- Modify: `tests/storage/memories.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/storage/memories.test.ts`:

```typescript
it('countMemories returns count for a session', async () => {
  // Insert some memories for a session
  // Call countMemories(sessionId)
  // Assert correct count
});

it('countMemories returns 0 for session with no memories', async () => {
  const { countMemories } = await import('$lib/storage/memories');
  const count = await countMemories('nonexistent-session');
  expect(count).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/memories.test.ts`
Expected: FAIL — `countMemories` is not exported

- [ ] **Step 3: Implement `countMemories`**

Add to `src/lib/storage/memories.ts`:

```typescript
export async function countMemories(sessionId: string): Promise<number> {
  const db = await getDb();
  const rows = db.exec('SELECT COUNT(*) FROM memories WHERE session_id = ?', [sessionId]);
  if (!rows.length) return 0;
  return rows[0].values[0][0] as number;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/storage/memories.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add countMemories for session memory badge"
```

---

### Task 12: SessionItem UI — pin toggle, export, memory badge

**Files:**
- Modify: `src/lib/components/SessionItem.svelte`

- [ ] **Step 1: Update SessionItem props and actions**

Add new props to `SessionItem.svelte`:

```typescript
let {
  session,
  isActive,
  personas,
  memoryCount = 0,
  onselect,
  onrename,
  ondelete,
  onsetpersona,
  onpin,
  onexport,
}: {
  session: ChatSession;
  isActive: boolean;
  personas: { id: string; name: string }[];
  memoryCount?: number;
  onselect: (id: string) => void;
  onrename: (id: string, name: string) => void;
  ondelete: (id: string) => void;
  onsetpersona: (id: string, personaId: string | undefined) => void;
  onpin: (id: string, pinned: boolean) => void;
  onexport: (id: string) => void;
} = $props();
```

- [ ] **Step 2: Add pin toggle and export button to the action row**

Update the action buttons section (the `<div class="flex gap-1 shrink-0">` block):

```svelte
<div class="flex gap-1 shrink-0" onclick={(e) => e.stopPropagation()}>
  <button onclick={() => onpin(session.id, !session.pinnedAt)} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-0.5" title={session.pinnedAt ? 'Unpin' : 'Pin'}>
    {session.pinnedAt ? '📌' : '📍'}
  </button>
  <button onclick={startRename} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-0.5" title="Rename">✎</button>
  <button onclick={() => onexport(session.id)} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer p-0.5" title="Export">↓</button>
  <button onclick={handleDelete} class="text-subtext0 hover:text-red bg-transparent border-none cursor-pointer p-0.5" title="Archive">✕</button>
</div>
```

- [ ] **Step 3: Add memory count badge**

After the preview text, add the memory badge:

```svelte
{#if session.preview}
  <p class="text-xs text-subtext0 mt-0.5 truncate">{session.preview}</p>
{/if}
<div class="flex items-center gap-2 mt-1">
  <span class="text-[10px] text-subtext0">{dateStr}</span>
  {#if memoryCount > 0}
    <span class="text-[10px] text-lavender bg-surface0 rounded px-1 py-0.5 cursor-default" title="View memories (coming soon)">
      {memoryCount} memories
    </span>
  {/if}
  <!-- persona button stays here -->
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pin toggle, export button, memory badge to SessionItem"
```

---

### Task 13: SessionPanel UI — sorting, search, archive, name dialog

**Files:**
- Modify: `src/lib/components/SessionPanel.svelte`

- [ ] **Step 1: Add new props and state**

Update `SessionPanel.svelte` props:

```typescript
let {
  sessions,
  archivedSessions = [],
  activeSessionId,
  personas,
  onselect,
  onrename,
  ondelete,
  oncreate,
  onclose,
  onsetpersona,
  onpin,
  onexport,
  onarchive,       // NEW
  onrestore,       // NEW
  onpermanentlyDelete, // NEW
}: {
  sessions: ChatSession[];
  archivedSessions?: ChatSession[];
  activeSessionId: string | null;
  personas: { id: string; name: string }[];
  onselect: (id: string) => void;
  onrename: (id: string, name: string) => void;
  ondelete: (id: string) => void;
  oncreate: (name?: string) => void;
  onclose: () => void;
  onsetpersona: (id: string, personaId: string | undefined) => void;
  onpin: (id: string, pinned: boolean) => void;
  onexport: (id: string) => void;
  onarchive: (id: string) => void;
  onrestore: (id: string) => void;
  onpermanentlyDelete: (id: string) => void;
} = $props();
```

Add state:

```typescript
let searchQuery = $state('');
let showArchive = $state(false);
let showNewSessionInput = $state(false);
let newSessionName = $state('');
```

- [ ] **Step 2: Add sorting and filtering logic**

```typescript
const filteredSessions = $derived(() => {
  let result = sessions;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(s => s.name.toLowerCase().includes(q));
  }
  const pinned = result.filter(s => s.pinnedAt).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
  const unpinned = result.filter(s => !s.pinnedAt).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return [...pinned, ...unpinned];
});

const filteredArchived = $derived(() => {
  if (!searchQuery.trim()) return archivedSessions;
  const q = searchQuery.toLowerCase();
  return archivedSessions.filter(s => s.name.toLowerCase().includes(q));
});
```

- [ ] **Step 3: Add search input to header**

After the header `<h2>`, add:

```svelte
<div class="px-4 pb-2">
  <input
    type="text"
    bind:value={searchQuery}
    placeholder="Search sessions..."
    class="w-full bg-surface0 text-text text-sm px-3 py-1.5 rounded-lg border border-surface1 focus:outline-none focus:border-mauve placeholder:text-subtext0"
  />
</div>
```

- [ ] **Step 4: Replace session list with sorted/filtered version**

```svelte
<div class="flex-1 overflow-y-auto p-2 space-y-1">
  {#if showNewSessionInput}
    <div class="flex gap-1 p-2">
      <input
        type="text"
        bind:value={newSessionName}
        placeholder="Session name..."
        class="flex-1 bg-surface0 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
        onkeydown={(e) => {
          if (e.key === 'Enter') { oncreate(newSessionName.trim() || undefined); showNewSessionInput = false; newSessionName = ''; }
          if (e.key === 'Escape') { showNewSessionInput = false; newSessionName = ''; }
        }}
      />
      <button onclick={() => { oncreate(newSessionName.trim() || undefined); showNewSessionInput = false; newSessionName = ''; }} class="text-xs text-green bg-transparent border-none cursor-pointer">✓</button>
    </div>
  {/if}

  {#if filteredSessions().length === 0}
    <div class="text-center text-subtext0 text-sm py-8">No sessions found</div>
  {:else}
    {#each filteredSessions() as session}
      <SessionItem
        {session}
        isActive={session.id === activeSessionId}
        {personas}
        memoryCount={0}
        {onselect}
        {onrename}
        ondelete={onarchive}
        {onsetpersona}
        {onpin}
        {onexport}
      />
    {/each}
  {/if}

  {#if archivedSessions.length > 0}
    <div class="mt-4 border-t border-surface1 pt-2">
      <button
        onclick={() => showArchive = !showArchive}
        class="w-full text-left text-xs text-subtext0 hover:text-text bg-transparent border-none cursor-pointer px-2 py-1"
      >
        Archived ({archivedSessions.length}) {showArchive ? '▲' : '▼'}
      </button>
      {#if showArchive}
        {#each filteredArchived() as session}
          <SessionItem
            {session}
            isActive={false}
            {personas}
            memoryCount={0}
            onselect={onrestore}
            onrename={onrename}
            ondelete={onpermanentlyDelete}
            {onsetpersona}
            {onpin}
            {onexport}
          />
        {/each}
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 5: Update new session button to show name input**

```svelte
<div class="p-3 border-t border-surface0">
  <button
    onclick={() => showNewSessionInput = true}
    class="w-full text-sm text-green hover:text-lavender bg-transparent border border-surface1 rounded-lg px-3 py-2 cursor-pointer hover:bg-surface0 transition-colors"
  >
    + New Session
  </button>
</div>
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add sorting, search, archive section, name dialog to SessionPanel"
```

---

### Task 14: Wire up new operations in +page.svelte

**Files:**
- Modify: `src/routes/chat/[id]/+page.svelte`

- [ ] **Step 1: Add archived sessions state and loading**

Add state variables alongside the existing `sessions` state:

```typescript
let archivedSessions = $state<ChatSession[]>([]);
```

Add a function to load archived sessions:

```typescript
async function loadArchivedSessions() {
  if (!id) return;
  archivedSessions = await chatStorage.listArchivedSessions(id);
}
```

Call `loadArchivedSessions()` wherever `loadSessions()` is called.

- [ ] **Step 2: Add archive/restore/permanent-delete handlers**

```typescript
async function archiveSession(sessionId: string) {
  if (!id) return;
  if (sessions.length <= 1) return; // can't archive last session
  await chatStorage.archiveSession(id, sessionId);
  await loadSessions();
  await loadArchivedSessions();
  if (sessionId === $chatStore.sessionId) {
    const remaining = sessions.filter(s => s.id !== sessionId);
    if (remaining.length > 0) {
      switchSession(remaining[0].id);
    }
  }
}

async function restoreSession(sessionId: string) {
  if (!id) return;
  await chatStorage.restoreSession(id, sessionId);
  await loadSessions();
  await loadArchivedSessions();
}

async function permanentDeleteSession(sessionId: string) {
  if (!id) return;
  if (!confirm('Permanently delete this session? This cannot be undone.')) return;
  await chatStorage.permanentDeleteSession(id, sessionId);
  await loadArchivedSessions();
}
```

- [ ] **Step 3: Add pin handler**

```typescript
async function pinSession(sessionId: string, pinned: boolean) {
  if (!id) return;
  await chatStorage.updateSession(id, sessionId, { pinnedAt: pinned ? Date.now() : undefined });
  await loadSessions();
}
```

- [ ] **Step 4: Add export handler**

```typescript
async function exportSessionById(sessionId: string) {
  if (!id) return;
  const cardName = resolvedCard?.card?.name ?? 'Unknown';
  const cardType = resolvedCard?.cardType ?? 'character';
  const exportData = await chatStorage.buildSessionExport(id, sessionId, cardName, cardType);
  const json = chatStorage.serializeExport(exportData);
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: `${cardName} - ${sessionId}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (path) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, json);
  }
}
```

- [ ] **Step 5: Update SessionPanel props**

Pass all new handlers to `<SessionPanel>`:

```svelte
<SessionPanel
  {sessions}
  {archivedSessions}
  activeSessionId={$chatStore.sessionId}
  {personas}
  onselect={switchSession}
  onrename={renameSession}
  ondelete={archiveSession}
  oncreate={createNewSession}
  onclose={() => showSessionPanel = false}
  onsetpersona={setSessionPersona}
  onpin={pinSession}
  onexport={exportSessionById}
  onarchive={archiveSession}
  onrestore={restoreSession}
  onpermanentlyDelete={permanentDeleteSession}
/>
```

- [ ] **Step 6: Update `createNewSession` to accept optional name**

```typescript
async function createNewSession(name?: string) {
  if (!id) return;
  // ... save current state
  const sessionId = await chatStorage.createSession(id, name, resolvedCard?.cardType);
  // ... load new session
  await loadSessions();
  await injectFirstMessage();
  // ... update URL
}
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire up archive, pin, export, name dialog in chat page"
```

---

### Task 15: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run svelte-check**

Run: `npx svelte-check --tsconfig ./tsconfig.json`
Expected: No new errors from our changes (pre-existing errors in unrelated files are acceptable)

- [ ] **Step 3: Verify no regressions in existing session tests**

Run: `npx vitest run tests/storage/sessions.test.ts tests/storage/messages.test.ts tests/repositories/chat-repo.test.ts`
Expected: All pass

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: resolve final verification issues for session system overhaul"
```
