# State Management Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor settings, chat, characters, and worlds stores to use Repository Pattern — separating pure reactive state (stores) from persistence logic (repositories).

**Architecture:** Stores become pure Svelte writable stores with no persistence logic. Repositories handle all load/save/migrate operations. Components continue using `$store` syntax unchanged.

**Tech Stack:** Svelte 4 stores, TypeScript, Vitest for testing

---

## File Structure

### New Files (4 repositories)
- `src/lib/repositories/settings-repo.ts` - Settings persistence and migration
- `src/lib/repositories/chat-repo.ts` - Chat persistence
- `src/lib/repositories/characters-repo.ts` - Characters persistence
- `src/lib/repositories/worlds-repo.ts` - Worlds persistence

### Modified Files (4 stores + layout)
- `src/lib/stores/settings.ts` - Remove load/save/migrate, become pure store
- `src/lib/stores/chat.ts` - Remove persistence logic
- `src/lib/stores/characters.ts` - Remove persistence logic
- `src/lib/stores/worlds.ts` - Remove persistence logic
- `src/routes/+layout.svelte` - Add repository initialization

---

## Task 1: Create Settings Repository

**Files:**
- Create: `src/lib/repositories/settings-repo.ts`
- Modify: `src/lib/stores/settings.ts` (temporarily - just for reference)
- Modify: `src/routes/+layout.svelte` (add initialization)

### Step 1.1: Create settings repository file structure

```typescript
// src/lib/repositories/settings-repo.ts
import { get } from 'svelte/store';
import { settingsStore, type SettingsState } from '$lib/stores/settings';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { ModelSlot, MemorySettings } from '$lib/types/config';

export const settingsRepo = {
  async load(): Promise<void> {
    // Implementation in next step
  },

  async save(): Promise<void> {
    // Implementation in next step
  },

  getCurrentState(): SettingsState {
    return get(settingsStore);
  },

  migrate(raw: any): SettingsState {
    // Implementation in next step
  }
};
```

### Step 1.2: Implement load() method

Add to `settingsRepo` in `src/lib/repositories/settings-repo.ts`:

```typescript
  async load(): Promise<void> {
    try {
      const raw = await settingsStorage.loadSettings();
      const migrated = this.migrate(raw);
      settingsStore.set(migrated);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Store remains at default state - this is expected for first run
    }
  }
```

### Step 1.3: Implement save() method

Add to `settingsRepo`:

```typescript
  async save(): Promise<void> {
    try {
      const state = this.getCurrentState();
      await settingsStorage.saveSettings(state);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }
```

### Step 1.4: Implement migrate() method

Add to `settingsRepo`:

```typescript
  migrate(raw: any): SettingsState {
    // Ensure object exists
    if (!raw || typeof raw !== 'object') {
      raw = {};
    }

    // Apply default prompt preset if missing
    if (!raw.promptPresets) {
      raw.promptPresets = createDefaultPresetSettings();
    }

    // Apply noiseSchedule migration for novelai
    if (raw.imageGeneration?.novelai && !raw.imageGeneration.novelai.noiseSchedule) {
      raw.imageGeneration.noiseSchedule = 'karras';
    }

    // Apply preset migrations (system prompt, author's note, jailbreak)
    if (raw.promptPresets?.presets) {
      for (const preset of raw.promptPresets.presets) {
        if (migratePresetItems(preset.items)) {
          // Migration applied
        }
        
        // Add missing default items (jailbreak, prefill) to old presets
        const defaultPreset = createDefaultPreset();
        const existingTypes = new Set(preset.items.map((i: { type: string }) => i.type));
        for (const defaultItem of defaultPreset.items) {
          if (!existingTypes.has(defaultItem.type)) {
            preset.items.push({ ...defaultItem, id: crypto.randomUUID() });
          }
        }
      }
    }

    // Apply default objects for missing fields
    if (!raw.modelSlots) raw.modelSlots = {};
    if (!raw.memorySettings) {
      raw.memorySettings = {
        extractionBatchSize: 5,
        tokenBudget: 4096,
        topK: 15,
        summaryThreshold: 50,
        embeddingProvider: '',
        embeddingApiKey: '',
        embeddingModel: '',
      };
    }
    if (raw.outputLanguage === undefined) raw.outputLanguage = '';

    return raw as SettingsState;
  }
```

### Step 1.5: Add repository initialization to layout

In `src/routes/+layout.svelte`, add to the `<script>` section (after imports, before other code):

```typescript
import { onMount } from 'svelte';
import { settingsRepo } from '$lib/repositories/settings-repo';

onMount(async () => {
  await settingsRepo.load();
});
```

If there's already an onMount, merge the calls:

```typescript
onMount(async () => {
  await Promise.all([
    settingsRepo.load(),
    // other initialization...
  ]);
});
```

### Step 1.6: Update components to use repository for save

In `src/routes/settings/+page.svelte`, replace the `handleSave` function:

```typescript
import { settingsRepo } from '$lib/repositories/settings-repo';

async function handleSave() {
  await settingsRepo.save();
}
```

Do the same for other settings pages:
- `src/routes/settings/memory/+page.svelte`
- `src/routes/settings/models/+page.svelte`
- `src/routes/settings/prompt-builder/+page.svelte`

### Step 1.7: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 1.8: Commit

```bash
git add src/lib/repositories/settings-repo.ts src/routes/+layout.svelte src/routes/settings/+page.svelte src/routes/settings/memory/+page.svelte src/routes/settings/models/+page.svelte src/routes/settings/prompt-builder/+page.svelte
git commit -m "feat: add settings repository and integrate with layout/settings pages"
```

---

## Task 2: Refactor Settings Store to Pure State

**Files:**
- Modify: `src/lib/stores/settings.ts`

### Step 2.1: Remove load/save/migrate from settings store

Replace the entire content of `src/lib/stores/settings.ts` with:

```typescript
/**
 * Settings store — pure reactive state only.
 * Persistence handled by settingsRepo in repositories/settings-repo.ts
 */

import { writable } from 'svelte/store';
import type { PromptPresetSettings } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { ModelSlot, MemorySettings } from '$lib/types/config';

export interface SettingsState {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  promptPresets?: PromptPresetSettings;
  developerMode?: boolean;
  imageGeneration?: ImageGenerationConfig;
  defaultPersonaId?: string;
  customArtStylePresets?: ArtStylePreset[];
  modelSlots?: Record<string, ModelSlot>;
  memorySettings?: MemorySettings;
  outputLanguage: string;
}

const DEFAULT_STATE: SettingsState = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  outputLanguage: '',
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<SettingsState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    reset: () => set(DEFAULT_STATE),
  };
}

export const settingsStore = createSettingsStore();
```

### Step 2.2: Remove unused imports from settings store

The refactored file should only import:
- `writable` from svelte/store
- Type definitions (PromptPresetSettings, ImageGenerationConfig, ArtStylePreset, ModelSlot, MemorySettings)

Remove imports for:
- settingsStorage (no longer needed)
- createDefaultPresetSettings, migratePresetItems, createDefaultPreset
- DEFAULT_IMAGE_CONFIG

### Step 2.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 2.4: Commit

```bash
git add src/lib/stores/settings.ts
git commit -m "refactor: make settings store pure, move persistence to repository"
```

---

## Task 3: Create Chat Repository

**Files:**
- Create: `src/lib/repositories/chat-repo.ts`
- Modify: `src/lib/stores/chat.ts` (reference only)

### Step 3.1: Read current chat store implementation

Read `src/lib/stores/chat.ts` to understand:
- Current state structure (ChatState)
- Current loadSession implementation
- Current addMessage implementation
- What storage methods it calls

### Step 3.2: Create chat repository

Create `src/lib/repositories/chat-repo.ts`:

```typescript
/**
 * Chat repository — handles persistence for chat store.
 */

import { get } from 'svelte/store';
import { chatStore, type ChatState } from '$lib/stores/chat';
import * as chatStorage from '$lib/storage/chats';
import type { Message } from '$lib/types';

export const chatRepo = {
  /**
   * Load a chat session
   */
  async loadSession(characterId: string, sessionId: string): Promise<void> {
    try {
      const messages = await chatStorage.loadMessages(characterId, sessionId);
      chatStore.set({
        chatId: characterId,
        sessionId,
        messages,
        isLoading: false,
        streamingMessage: null,
        isStreaming: false,
      });
    } catch (error) {
      console.error('Failed to load chat session:', error);
      chatStore.reset();
    }
  },

  /**
   * Save current messages to storage
   */
  async saveMessages(): Promise<void> {
    const state = get(chatStore);
    if (!state.chatId || !state.sessionId) return;
    
    try {
      await chatStorage.saveMessages(state.chatId, state.sessionId, state.messages);
    } catch (error) {
      console.error('Failed to save messages:', error);
      throw error;
    }
  },

  /**
   * Create a new session
   */
  async createSession(characterId: string): Promise<string> {
    try {
      const sessionId = await chatStorage.createSession(characterId);
      await this.loadSession(characterId, sessionId);
      return sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }
};
```

### Step 3.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 3.4: Commit

```bash
git add src/lib/repositories/chat-repo.ts
git commit -m "feat: add chat repository"
```

---

## Task 4: Refactor Chat Store to Pure State

**Files:**
- Modify: `src/lib/stores/chat.ts`

### Step 4.1: Replace chat store with pure version

Replace content of `src/lib/stores/chat.ts` with:

```typescript
/**
 * Chat store — pure reactive state only.
 * Persistence handled by chatRepo in repositories/chat-repo.ts
 */

import { writable } from 'svelte/store';
import type { Message } from '$lib/types';

export interface ChatState {
  chatId: string | null;
  sessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string | null;
  isStreaming: boolean;
}

const DEFAULT_STATE: ChatState = {
  chatId: null,
  sessionId: null,
  messages: [],
  isLoading: false,
  streamingMessage: null,
  isStreaming: false,
};

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    
    // Helper methods that only update state (no persistence)
    addMessage: (message: Message) => {
      update(s => ({ ...s, messages: [...s.messages, message] }));
    },
    
    updateMessage: (index: number, message: Message) => {
      update(s => ({
        ...s,
        messages: s.messages.map((m, i) => i === index ? message : m)
      }));
    },
    
    removeMessage: (index: number) => {
      update(s => ({
        ...s,
        messages: s.messages.filter((_, i) => i !== index)
      }));
    },
    
    setStreamingMessage: (content: string | null) => {
      update(s => ({ ...s, streamingMessage: content, isStreaming: content !== null }));
    },
    
    reset: () => set(DEFAULT_STATE),
  };
}

export const chatStore = createChatStore();
```

### Step 4.2: Update components to use chatRepo

Find components that call chatStorage directly or use old chatStore.loadSession(), and update them:

**Example in chat page:**
```typescript
import { chatRepo } from '$lib/repositories/chat-repo';

// Old:
// await chatStore.loadSession(characterId, sessionId);

// New:
await chatRepo.loadSession(characterId, sessionId);
```

**For message operations that need persistence:**
```typescript
import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';

// Add to store (reactive update)
chatStore.addMessage(newMessage);

// Persist to storage
await chatRepo.saveMessages();
```

### Step 4.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 4.4: Commit

```bash
git add src/lib/stores/chat.ts
git commit -m "refactor: make chat store pure, move persistence to repository"
```

---

## Task 5: Create Characters Repository

**Files:**
- Create: `src/lib/repositories/characters-repo.ts`
- Modify: `src/lib/stores/characters.ts` (reference)

### Step 5.1: Read current characters store

Read `src/lib/stores/characters.ts` to understand:
- State structure
- Load/save patterns
- Storage methods used

### Step 5.2: Create characters repository

Create `src/lib/repositories/characters-repo.ts`:

```typescript
/**
 * Characters repository — handles persistence for characters store.
 */

import { get } from 'svelte/store';
import { charactersStore, type CharactersState } from '$lib/stores/characters';
import * as charactersStorage from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

export const charactersRepo = {
  /**
   * Load all characters
   */
  async load(): Promise<void> {
    try {
      const characters = await charactersStorage.loadCharacters();
      charactersStore.set({
        characters,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load characters:', error);
      charactersStore.reset();
    }
  },

  /**
   * Save a character
   */
  async saveCharacter(character: CharacterCard): Promise<void> {
    try {
      await charactersStorage.saveCharacter(character);
      // Update store
      const state = get(charactersStore);
      const index = state.characters.findIndex(c => c.id === character.id);
      if (index >= 0) {
        charactersStore.updateCharacter(index, character);
      } else {
        charactersStore.addCharacter(character);
      }
    } catch (error) {
      console.error('Failed to save character:', error);
      throw error;
    }
  },

  /**
   * Delete a character
   */
  async deleteCharacter(id: string): Promise<void> {
    try {
      await charactersStorage.deleteCharacter(id);
      charactersStore.removeCharacter(id);
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  }
};
```

### Step 5.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 5.4: Commit

```bash
git add src/lib/repositories/characters-repo.ts
git commit -m "feat: add characters repository"
```

---

## Task 6: Refactor Characters Store to Pure State

**Files:**
- Modify: `src/lib/stores/characters.ts`

### Step 6.1: Replace with pure version

Replace content with:

```typescript
/**
 * Characters store — pure reactive state only.
 * Persistence handled by charactersRepo.
 */

import { writable } from 'svelte/store';
import type { CharacterCard } from '$lib/types';

export interface CharactersState {
  characters: CharacterCard[];
  isLoading: boolean;
}

const DEFAULT_STATE: CharactersState = {
  characters: [],
  isLoading: true,
};

function createCharactersStore() {
  const { subscribe, set, update } = writable<CharactersState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    
    addCharacter: (character: CharacterCard) => {
      update(s => ({
        ...s,
        characters: [...s.characters, character]
      }));
    },
    
    updateCharacter: (index: number, character: CharacterCard) => {
      update(s => ({
        ...s,
        characters: s.characters.map((c, i) => i === index ? character : c)
      }));
    },
    
    removeCharacter: (id: string) => {
      update(s => ({
        ...s,
        characters: s.characters.filter(c => c.id !== id)
      }));
    },
    
    reset: () => set(DEFAULT_STATE),
  };
}

export const charactersStore = createCharactersStore();
```

### Step 6.2: Update components

Update character pages to use `charactersRepo.load()` instead of store methods.

### Step 6.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 6.4: Commit

```bash
git add src/lib/stores/characters.ts src/routes/characters/
git commit -m "refactor: make characters store pure, move persistence to repository"
```

---

## Task 7: Create Worlds Repository

**Files:**
- Create: `src/lib/repositories/worlds-repo.ts`

### Step 7.1: Create repository

Create `src/lib/repositories/worlds-repo.ts`:

```typescript
/**
 * Worlds repository — handles persistence for worlds store.
 */

import { get } from 'svelte/store';
import { worldsStore, type WorldsState } from '$lib/stores/worlds';
import * as worldsStorage from '$lib/storage/worlds';
import type { WorldCard } from '$lib/types/world';

export const worldsRepo = {
  /**
   * Load all worlds
   */
  async load(): Promise<void> {
    try {
      const worlds = await worldsStorage.loadWorlds();
      worldsStore.set({
        worlds,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load worlds:', error);
      worldsStore.reset();
    }
  },

  /**
   * Save a world
   */
  async saveWorld(world: WorldCard): Promise<void> {
    try {
      await worldsStorage.saveWorld(world);
      const state = get(worldsStore);
      const index = state.worlds.findIndex(w => w.id === world.id);
      if (index >= 0) {
        worldsStore.updateWorld(index, world);
      } else {
        worldsStore.addWorld(world);
      }
    } catch (error) {
      console.error('Failed to save world:', error);
      throw error;
    }
  },

  /**
   * Delete a world
   */
  async deleteWorld(id: string): Promise<void> {
    try {
      await worldsStorage.deleteWorld(id);
      worldsStore.removeWorld(id);
    } catch (error) {
      console.error('Failed to delete world:', error);
      throw error;
    }
  }
};
```

### Step 7.2: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 7.3: Commit

```bash
git add src/lib/repositories/worlds-repo.ts
git commit -m "feat: add worlds repository"
```

---

## Task 8: Refactor Worlds Store to Pure State

**Files:**
- Modify: `src/lib/stores/worlds.ts`

### Step 8.1: Replace with pure version

Replace content with:

```typescript
/**
 * Worlds store — pure reactive state only.
 * Persistence handled by worldsRepo.
 */

import { writable } from 'svelte/store';
import type { WorldCard } from '$lib/types/world';

export interface WorldsState {
  worlds: WorldCard[];
  isLoading: boolean;
}

const DEFAULT_STATE: WorldsState = {
  worlds: [],
  isLoading: true,
};

function createWorldsStore() {
  const { subscribe, set, update } = writable<WorldsState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    
    addWorld: (world: WorldCard) => {
      update(s => ({
        ...s,
        worlds: [...s.worlds, world]
      }));
    },
    
    updateWorld: (index: number, world: WorldCard) => {
      update(s => ({
        ...s,
        worlds: s.worlds.map((w, i) => i === index ? world : w)
      }));
    },
    
    removeWorld: (id: string) => {
      update(s => ({
        ...s,
        worlds: s.worlds.filter(w => w.id !== id)
      }));
    },
    
    reset: () => set(DEFAULT_STATE),
  };
}

export const worldsStore = createWorldsStore();
```

### Step 8.2: Update components

Update worlds pages to use `worldsRepo.load()`.

### Step 8.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 8.4: Commit

```bash
git add src/lib/stores/worlds.ts src/routes/worlds/
git commit -m "refactor: make worlds store pure, move persistence to repository"
```

---

## Task 9: Add Repository Initialization to Layout

**Files:**
- Modify: `src/routes/+layout.svelte`

### Step 9.1: Import all repositories

Add imports:
```typescript
import { settingsRepo } from '$lib/repositories/settings-repo';
import { charactersRepo } from '$lib/repositories/characters-repo';
import { worldsRepo } from '$lib/repositories/worlds-repo';
```

### Step 9.2: Initialize all on mount

```typescript
onMount(async () => {
  await Promise.all([
    settingsRepo.load(),
    charactersRepo.load(),
    worldsRepo.load(),
  ]);
});
```

Note: Chat repo doesn't load on startup (it's session-specific).

### Step 9.3: Run tests

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 9.4: Commit

```bash
git add src/routes/+layout.svelte
git commit -m "feat: initialize all repositories on app mount"
```

---

## Task 10: Final Verification

### Step 10.1: Run full test suite

```bash
npx vitest run
```

Expected: All 507 tests pass.

### Step 10.2: Run typecheck

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -50
```

Expected: No new errors in refactored files.

### Step 10.3: Test manually (if possible)

1. Load app - verify settings load correctly
2. Navigate to Settings - verify values display
3. Change a setting - verify it saves
4. Navigate to Characters - verify list loads
5. Navigate to Worlds - verify list loads

### Step 10.4: Commit any fixes

If any issues found, fix and commit.

---

## Success Checklist

After all tasks complete, verify:

- [ ] `settingsStore` has no `load()`, `save()`, or `migrate()` methods
- [ ] `chatStore` has no persistence logic
- [ ] `charactersStore` has no persistence logic  
- [ ] `worldsStore` has no persistence logic
- [ ] All repositories exist in `src/lib/repositories/`
- [ ] `+layout.svelte` initializes repositories on mount
- [ ] All 507 tests pass
- [ ] Components still use `$store` syntax
- [ ] No TypeScript errors in refactored files

## Benefits Achieved

1. **Testability**: Stores can be tested without mocking storage
2. **Clarity**: Clear separation between state and persistence
3. **Flexibility**: Can swap storage layer without touching stores
4. **Maintainability**: Migrations centralized
5. **Type Safety**: Better typing in repository layer