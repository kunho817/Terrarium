# Session System Overhaul — Design Spec

**Date:** 2026-04-18
**Approach:** Incremental refactor (Approach A) — fix existing codebase in place, keep JSON file storage.

## Scope

Four areas: data integrity, robustness, UI/UX enhancements, and new capabilities.

---

## 1. Data Integrity Fixes

### 1a. Type corrections

- `ChatSession.personaId` changes from `string | undefined` to `PersonaId | undefined` (branded type from `branded.ts`).
- `chatStore.chatId` renamed to `characterId` to match its actual type (`CharacterId`). All consumers updated.
- `createSession()` in `sessions.ts` sets `cardType` from the card's type during creation (currently always undefined).

### 1b. Remove cross-layer coupling

- `saveMessages()` in `messages.ts` currently calls `updateSession()` as a side effect to update `lastMessageAt` and `preview`. This responsibility moves to `chat-repo.saveMessages()`, which is the proper orchestration layer.
- `messages.ts` becomes pure read/write of the messages array — no session metadata awareness.

### 1c. Remove redundancy

- `loadChat()` in `chat-repo.ts` calls `listSessions()` twice (once to trigger migration, once to get results). Refactor to single call since `listSessions()` already handles migration internally.
- Remove `loadSessionById()` method from `chat-repo.ts` — it is an exact alias for `loadSession()` with no added value.

### 1d. Fix type-unsafe cast

- `scene-repo.ts` reads `currentCharacterId` and `currentSessionId` from scene store via `state as any`. Add these as typed public fields on the scene store so the cast is unnecessary.

### Files changed

`session.ts`, `chat.ts` (store), `messages.ts`, `chat-repo.ts`, `scene.ts`, `scene-repo.ts`, `sessions.ts`, `+page.svelte`

---

## 2. Robustness Improvements

### 2a. Atomic writes via temp-file-rename

- Add `writeJsonAtomic(path, data)` to `database.ts`. Writes to `{path}.tmp` first, then renames to the final path. Prevents corrupt files on crash mid-write.
- All session index, message, and scene state writes use this instead of plain `writeJson`.

### 2b. Session index cache in chat-repo

- `chatRepo` maintains an in-memory `_sessionCache: Map<CharacterId, ChatSession[]>`. Populated on first `listSessions()` call for a given character. Invalidated on create, update, delete, archive, or restore operations.
- `getSessionPersonaId()` (currently reads `sessions.json` from disk on every `sendMessage`) reads from the cache instead.
- Cache is keyed by `CharacterId`, cleared when the active character changes.

### 2c. Soft-delete with archive

- `deleteSession()` moves the session directory to `chats/{characterId}/.archive/{sessionId}/` instead of removing it.
- `sessions.json` gets a new optional field: `archivedSessions?: ChatSession[]` — separate from the active sessions array.
- UI: a collapsible "Archived (N)" section at the bottom of SessionPanel (shows count when collapsed), listing archived sessions with "Restore" and "Permanently Delete" actions per item. Starts collapsed.
- Restore moves the directory back and transfers the session from `archivedSessions` to the active array.
- Permanent delete does the actual `removePath` on the archived directory and removes from `archivedSessions`.

### 2d. Delete last-session guard

- Current hard block (`sessions.length <= 1`) stays for the active list — you cannot delete your last active session.
- Archived sessions can be permanently deleted freely (they are already inactive).

### Files changed

`database.ts`, `chat-repo.ts`, `sessions.ts`, `SessionPanel.svelte`, `SessionItem.svelte` (archive variant)

---

## 3. UI/UX Enhancements

### 3a. Session sorting

- SessionPanel sorts sessions: pinned first (sorted by `pinnedAt` desc), then unpinned (sorted by `lastMessageAt` desc).
- Sorting is applied at the UI layer in SessionPanel, not in storage. Storage keeps insertion order.

### 3b. Session pinning

- `ChatSession` gets a new optional field: `pinnedAt?: number` (epoch ms, set when pinned). Presence of this field means "pinned"; absence means "unpinned".
- SessionItem gets a pin/unpin toggle button (pin icon). Toggling calls `updateSession()` with `{ pinnedAt: Date.now() }` or `{ pinnedAt: undefined }`.
- Pinned sessions show a pin indicator icon in the session list.

### 3c. Session search/filter

- Search input at the top of SessionPanel (above the session list).
- Filters sessions by name (case-insensitive substring match).
- Searches across both active and archived sections (both are filtered by the same query).

### 3d. Session preview improvements

- Preview shows role prefix: "You: ..." for user messages, character name for assistant messages (e.g. "Alice: ...").
- Preview length bumped from 80 to 120 characters.

### Files changed

`session.ts` (add `pinnedAt`), `SessionPanel.svelte`, `SessionItem.svelte`, `sessions.ts`, `messages.ts`

---

## 4. New Capabilities

### 4a. Single session export

- New file: `src/lib/storage/export-session.ts` with `exportSession(characterId, sessionId)`.
- Bundles messages + scene state + card reference into a single JSON file:
  ```typescript
  interface SessionExport {
    version: 1;
    exportedAt: number;
    card: { id: string; name: string; type: 'character' | 'world' };
    session: ChatSession;
    messages: Message[];
    scene: SceneState;
  }
  ```
- Downloaded via Tauri's `save` dialog (user picks location).
- Triggered by an export button in SessionItem (icon button, same row as rename/delete).

### 4b. Memory count per session

- SessionItem shows a small memory count badge (e.g. "5 memories") next to the preview text.
- Count comes from a new `countMemories(sessionId)` function in `memories.ts`.
- Clicking the badge is a placeholder for the memory inspector (sub-project 4) — for now it shows a tooltip "View memories (coming soon)".

### 4c. Session creation with name dialog

- Instead of auto-naming "Chat N+1", the "+ New Session" button shows an inline text input at the top of the session list.
- User types a name or leaves blank for auto-name. Enter to confirm, Escape to cancel.
- Auto-name fallback remains "Chat {n+1}" where n = active sessions count.

### Files changed

`session.ts`, `messages.ts`, `memories.ts`, `SessionItem.svelte`, `SessionPanel.svelte`, new `export-session.ts` in storage

---

## Architecture After Overhaul

```
+page.svelte (route)
    |
    +-- chat-repo.ts ------->_sessionCache (Map<CharacterId, ChatSession[]>)
    |                     |-> sessions.ts (atomic JSON I/O)
    |                     |-> messages.ts (pure message read/write)
    |                     |-> export-session.ts (single session export)
    |
    +-- scene-repo.ts -----> scene-storage.ts (atomic JSON I/O)
    |                   \--> sceneStore (typed fields, no `as any`)
    |
    +-- use-chat.ts ------> chatStore (characterId field, not chatId)
    |                  \--> engine (pipeline)
    |
    +-- SessionPanel.svelte
    |     +-- search input
    |     +-- SessionItem[] (sorted: pinned first, then by date)
    |     +-- name input (new session creation)
    |     +-- ArchiveSection (collapsible)
    |           +-- ArchivedSessionItem[] (restore / permanent delete)
    |
Storage on disk:
  AppData/chats/{charId}/sessions.json              [active + archived sessions]
  AppData/chats/{charId}/{sessId}/messages.json      [messages]
  AppData/chats/{charId}/{sessId}/scene.json         [scene state]
  AppData/chats/{charId}/.archive/{sessId}/           [archived session dirs]
```

## Data Model Changes

```typescript
// session.ts — updated ChatSession
interface ChatSession {
  id: SessionId;
  characterId: CharacterId;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  personaId?: PersonaId;      // was string
  cardType?: 'character' | 'world';
  pinnedAt?: number;           // NEW — epoch ms, presence = pinned
}

// sessions.json — updated structure
interface SessionsFile {
  sessions: ChatSession[];
  archivedSessions?: ChatSession[];  // NEW
}
```
