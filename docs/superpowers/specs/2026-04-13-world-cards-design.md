# World Cards Design

## Overview

World Cards are a new card type that define a complete universe/setting for AI roleplay. Unlike Character Cards (which are character-centric), World Cards are world-centric — they describe a setting with its regions, rules, history, and original characters, enabling users to experience varied situations within a creator's universe.

World Cards are a separate type from Character Cards, with their own storage, editor UI, and prompt assembly logic. However, the session relationship is identical: a session links to one card (either character or world), and the session's `cardType` field determines which storage to load from.

## WorldCard Type

```ts
interface WorldCard {
  name: string;
  description: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];

  systemPrompt: string;
  postHistoryInstructions: string;
  depthPrompt?: DepthPrompt;
  defaultPersonaId?: string;

  lorebook: LorebookEntry[];
  loreSettings: LorebookSettings;

  characters: WorldCharacter[];

  regexScripts: RegexScript[];
  triggers: Trigger[];
  virtualScript?: string;
  scriptState: VariableStore;

  backgroundHTML?: string;
  backgroundCSS?: string;
  customTheme?: string;

  creator: string;
  tags: string[];
  creatorNotes: string;
  license?: string;
  metadata: Record<string, unknown>;
}

interface WorldCharacter {
  id: string;
  name: string;
  description: string;
  personality?: string;
  exampleMessages?: string;
  avatar?: string;
  lorebookEntryIds?: string[];
}
```

### Key Differences from CharacterCard

| Aspect | CharacterCard | WorldCard |
|--------|--------------|-----------|
| Focus | Single character | Entire world/setting |
| `personality` | Present | Absent |
| `exampleMessages` | Present | Absent (moved to WorldCharacter) |
| `characters` roster | Absent | Present — OCs in the world |
| Lorebook categories | Flat | Categorized (character/region/setting/misc) |
| `characterVersion` | Present | Absent |
| Storage | `characters/{id}/card.json` | `worlds/{id}/world.json` |

### Lorebook Categorization

Add an optional `category` field to `LorebookEntry`:

```ts
interface LorebookEntry {
  // ... existing fields ...
  category?: 'character' | 'region' | 'setting' | 'misc';
}
```

This is optional and backward-compatible — existing entries default to `misc`. The world editor's lorebook tab shows a category filter dropdown.

## Storage

### Directory Structure

```
worlds/
  {uuid}/
    world.json
characters/
  {uuid}/
    card.json        (unchanged)
chats/
  {id}/              (id is either a character ID or world ID)
    sessions.json
    {sessionId}/
      messages.json
      scene.json
```

### New Storage Module: `src/lib/storage/worlds.ts`

Same CRUD pattern as `characters.ts`:
- `listWorlds()` → `{ id: string; name: string }[]`
- `loadWorld(id: string)` → `WorldCard`
- `saveWorld(id: string, card: WorldCard)` → `void`
- `deleteWorld(id: string)` → `void`
- `createWorld(card: WorldCard)` → `string`

### PATHS additions (`src/lib/storage/paths.ts`)

```ts
static worlds = 'worlds';
static worldDir(id: string) { return `${PATHS.worlds}/${id}`; }
static worldCard(id: string) { return `${PATHS.worlds}/${id}/world.json`; }
```

## Session Linking

### ChatSession Update

```ts
interface ChatSession {
  id: string;
  characterId: string;        // For worlds, this holds the world card ID
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
  personaId?: string;
  cardType: 'character' | 'world';  // NEW — determines which storage to use
}
```

Default `cardType` is `'character'` for backward compatibility. Existing sessions without this field default to `'character'`.

### Storage Routing

When loading a session, check `cardType`:
- `'character'` → load from `characters/{characterId}/card.json`
- `'world'` → load from `worlds/{characterId}/world.json`

The `chats/` directory structure is shared — world sessions use the same `chats/{id}/` pattern with the world card ID as the directory name.

## UI Flow

### Home Page (`/`)

Two tabs at the top: **Characters** and **Worlds**. Each tab shows a grid of cards. Clicking a card opens its chat at `/chat/{id}`.

The page loads both character and world lists on mount. A `cardType` query param or state variable tracks which tab is active.

### Chat Page (`/chat/[id]`)

Unchanged structure. On mount, the page needs to determine whether `{id}` refers to a character or a world:

1. Try loading from `characters/{id}/card.json`
2. If not found, try `worlds/{id}/world.json`
3. Set the `cardType` accordingly

Alternatively, the home page can pass `cardType` as a query param when navigating: `/chat/{id}?cardType=world`.

The TopBar displays the world name and a "World" badge when in world mode.

### World Editor (`/worlds/[id]/edit`)

New route with tabs:

1. **Overview**: name, description, scenario, first message, alternate greetings, creator info
2. **System Prompt**: world rules, narration guidelines, post-history instructions, depth prompt
3. **Lorebook**: categorized lorebook entries with category filter (All / Characters / Regions / Settings / Misc)
4. **Characters**: OC roster editor — add, remove, edit WorldCharacters. Each character has: name, description, personality (optional), example messages (optional), avatar (optional). Can link to lorebook entries.
5. **Scripts**: regex scripts, triggers (same UI as character editor)
6. **Theme**: background HTML/CSS, custom theme (same as character editor)

### World Creation

"Create World" button on the home page Worlds tab. Creates a blank WorldCard with sensible defaults and opens the editor.

### World Import

New file format `.tcworld` — a JSON file containing a `WorldCard` object. Import flow mirrors character import: file picker → parse → store.

The `CardFormatPlugin` system can be extended with a `worldFormatPlugins` registry, or the existing registry can be extended with a `cardType` field on format plugins.

## Prompt Assembly

When `cardType === 'world'`, the prompt assembler uses `WorldCard` data:

- `{{char}}` resolves to the world name
- `{{description}}` resolves to the world description
- `{{scenario}}` resolves to the world scenario
- Lorebook entries are matched and injected as usual, with category-aware filtering available
- World characters' descriptions are injected as additional context — either via auto-generated lorebook entries or as a dedicated prompt section
- `{{user}}` resolves to the active persona as usual

### World Characters in Prompts

Each `WorldCharacter` generates a **synthetic** lorebook entry at prompt assembly time (not persisted in the lorebook array). These virtual entries have `constant: true` and `category: 'character'`, containing the character's name, description, and personality. This makes all world characters available in every prompt without manual lorebook management. The user can also create additional real lorebook entries for a character and link them via `lorebookEntryIds`.

## Implementation Priority

1. Types and storage (`WorldCard`, `WorldCharacter`, storage module, paths)
2. Session `cardType` field and routing logic
3. Home page tab UI (Characters / Worlds)
4. World editor (Overview, System Prompt, Lorebook, Characters, Scripts, Theme tabs)
5. Prompt assembly for world cards
6. World import/export (`.tcworld` format)
7. Lorebook `category` field with backward compatibility
