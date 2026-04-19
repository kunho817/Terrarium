# Memory Inspector — Design Spec

**Date:** 2026-04-19
**Sub-project:** 4 of 4 (Code Quality → Session System → Agent Progress → **Memory Inspector**)

## Problem

The AI memory system stores extracted facts (events, traits, relationships, locations, states) in SQLite, but there's no way for users to see what the AI remembers. Users can't verify memory accuracy, fix incorrect memories, manually add important facts, or clean up stale data.

## Goal

A side panel that lets users browse, search, filter, edit, add, and delete memories for the current session, plus view and manage session summaries.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Display | Side panel (like SessionPanel) | Consistent with existing UI pattern |
| Scope | Current session only | Most relevant context |
| Sections | Memories + Summaries tabs | Clear separation of concerns |
| CRUD | Full editor | Users need control over what AI remembers |
| Filtering | Type pills + text search | Quick narrowing of large memory sets |
| Manual entry | Add memory button | Users know things the AI hasn't extracted |

## Architecture

### New Storage Functions

In `src/lib/storage/memories.ts`:
- `updateMemory(id, patch: { content?, importance?, type? })` — UPDATE existing memory
- `updateSummary(id, patch: { summary? })` — UPDATE existing summary

Both persist to SQLite via `persist()`.

### UI Components

**`MemoryPanel.svelte`** — Side panel container:
- Fixed overlay, slides from right (same pattern as SessionPanel)
- Tab toggle: "Memories" | "Summaries"
- Close button
- Props: `sessionId`, `onclose`

**`MemoryList.svelte`** — Memory browsing + editing:
- Type filter pills (event, trait, relationship, location, state)
- Search input for content text
- Sort toggle (importance / recency)
- "Add Memory" button
- Renders `MemoryCard` for each memory
- Empty state when no memories

**`MemoryCard.svelte`** — Single memory display/edit:
- Collapsed: type badge, content preview (1 line), importance indicator
- Expanded: full content textarea, importance slider (0-1), type dropdown, turn number, date
- Action buttons: Save, Delete
- Props: `memory`, `onupdate(id, patch)`, `ondelete(id)`

**`SummaryList.svelte`** — Summary browsing + editing:
- List of summaries with turn range header
- Collapsed: summary preview
- Expanded: full summary textarea, Save/Delete buttons

### Integration

- Add a brain/book icon button in the SceneInfoBar or chat header
- On click, set `showMemoryPanel = true` in `+page.svelte`
- Pass current `sessionId` from chat store
- Provide handler functions that call storage and refresh the panel

### Data Flow

1. Panel opens → load `getMemoriesForSession(sessionId)` + `getSummariesForSession(sessionId)`
2. User edits memory → call `updateMemory(id, patch)` → refresh list
3. User adds memory → call `insertMemory(newRecord)` → refresh list
4. User deletes memory → call `deleteMemory(id)` → refresh list
5. User edits summary → call `updateSummary(id, patch)` → refresh list
6. User deletes summary → call new `deleteSummary(id)` → refresh list

### Manual Memory Addition

When user clicks "Add Memory", show a form with:
- Content (textarea, required)
- Type (dropdown: event/trait/relationship/location/state)
- Importance (slider, default 0.7)

Auto-fill: `id` (UUID), `sessionId` (current), `sourceMessageIds` (empty), `turnNumber` (current turn), `createdAt` (now), `embedding` (zero vector — manual memories don't need embeddings).

## Scope

### In scope
- Memory panel component with tabs
- Memory browsing with type filter and search
- Memory CRUD (edit content/importance/type, add manual, delete)
- Summary browsing with edit/delete
- Trigger button in chat UI

### Out of scope
- Editing embedding vectors (not meaningful for users)
- Cross-session memory search
- Memory export/import
- Bulk delete operations
- Memory deduplication in the inspector

## Files Changed

| File | Change |
|------|--------|
| `src/lib/storage/memories.ts` | Add `updateMemory`, `deleteSummary`, `updateSummary` |
| `src/lib/components/MemoryPanel.svelte` | **New** — side panel container |
| `src/lib/components/MemoryCard.svelte` | **New** — single memory display/edit |
| `src/lib/components/SummaryList.svelte` | **New** — summary list with edit |
| `src/routes/chat/[id]/+page.svelte` | Add trigger button + panel state |
| `src/lib/components/SceneInfoBar.svelte` | Add memory inspector trigger button |
| `tests/storage/memories.test.ts` | Add tests for new functions |
