# State Management Refactoring Implementation Plan

> **For agentic workers:** Use Serena MCP tools for precise symbol-based editing. Test-driven approach with verification at each step.

**Goal:** Separate persistence logic from stores using Repository Pattern - stores hold pure reactive state, repositories handle all persistence.

**Architecture:** 
- **Stores** (`src/lib/stores/*`): Pure Svelte writable stores with state-only methods (set, update, helpers)
- **Repositories** (`src/lib/repositories/*`): Handle persistence (load/save/delete), storage API calls, error handling
- **Components**: Import both stores (for reactive state) and repositories (for persistence operations)

**Tech Stack:** Svelte 5, TypeScript strict, Vitest

---

## Analysis Summary

### Stores with Persistence Logic (to be refactored):

| Store | Persistence Methods | Pure State Methods | Affected Components |
|-------|--------------------|--------------------|---------------------|
| settings | load(), save() | update() | +layout.svelte, settings/* pages |
| characters | loadList(), selectCharacter(), saveCurrent(), deleteCharacter() | clearSelection() | +page.svelte, characters/*, chat/[id]/* |
| worlds | loadList(), selectWorld(), saveCurrent(), deleteWorld() | clearSelection() | +page.svelte, worlds/*, chat/[id]/* |
| chat | loadSession(), loadChat(), save() | addMessage(), updateMessage(), etc. | chat/[id]/+page.svelte |
| scene | loadScene(), loadSceneLegacy(), save() | updateScene(), setVariable() | chat/[id]/* |
| theme | None (derived only) | N/A | No changes needed |

---

## File Structure Changes

### New Files (Create):
- `src/lib/repositories/settings-repo.ts`
- `src/lib/repositories/characters-repo.ts`
- `src/lib/repositories/worlds-repo.ts`
- `src/lib/repositories/chat-repo.ts`
- `src/lib/repositories/scene-repo.ts`

### Modified Files (Refactor):
- `src/lib/stores/settings.ts` - Remove load(), save()
- `src/lib/stores/characters.ts` - Remove loadList(), selectCharacter(), saveCurrent(), deleteCharacter()
- `src/lib/stores/worlds.ts` - Remove loadList(), selectWorld(), saveCurrent(), deleteWorld()
- `src/lib/stores/chat.ts` - Remove loadSession(), loadChat(), save()
- `src/lib/stores/scene.ts` - Remove loadScene(), loadSceneLegacy(), save()

### Components to Update (Import repositories):
- `src/routes/+layout.svelte`
- `src/routes/+page.svelte`
- `src/routes/characters/+page.svelte`
- `src/routes/characters/[id]/edit/+page.svelte`
- `src/routes/worlds/+page.svelte`
- `src/routes/worlds/[id]/edit/+page.svelte`
- `src/routes/chat/[id]/+page.svelte`
- `src/routes/chat/[id]/info/+page.svelte`
- `src/routes/settings/+page.svelte`
- `src/routes/settings/image-generation/+page.svelte`
- `src/routes/settings/memory/+page.svelte`
- `src/routes/settings/models/+page.svelte`
- `src/routes/settings/personas/+page.svelte`
- `src/routes/settings/prompt-builder/+page.svelte`
- `src/routes/settings/providers/+page.svelte`
- `src/routes/settings/theme-editor/+page.svelte`

### Tests to Update:
- `tests/stores/settings-store.test.ts`
- `tests/stores/characters-store.test.ts`
- `tests/stores/worlds-store.test.ts`
- `tests/stores/chat.test.ts`

---

## Task 1: Settings Repository

**Files:**
- Create: `src/lib/repositories/settings-repo.ts`
- Modify: `src/lib/stores/settings.ts:18-71`
- Modify: `src/routes/+layout.svelte:11`
- Modify: `src/routes/settings/+page.svelte:9,14`
- Modify: `src/routes/settings/image-generation/+page.svelte:189,224`
- Modify: `src/routes/settings/memory/+page.svelte:28,55`
- Modify: `src/routes/settings/models/+page.svelte:40,73`
- Modify: `src/routes/settings/personas/+page.svelte:67,74,78`
- Modify: `src/routes/settings/prompt-builder/+page.svelte:13,132`
- Modify: `src/routes/settings/providers/+page.svelte:13,34`
- Modify: `src/routes/settings/theme-editor/+page.svelte:46,66`
- Test: `tests/stores/settings-store.test.ts`

### Step 1: Create Settings Repository

**File:** `src/lib/repositories/settings-repo.ts`

```typescript
/**
 * Settings repository — handles persistence for settings store.
 */

import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
import type { AppSettings } from '$lib/storage/settings';

export const settingsRepo = {
  /**
   * Load settings from storage and apply migrations.
   */
  async load(): Promise<void> {
    const settings = await settingsStorage.loadSettings();
    
    // Migrate: add default prompt preset if not present
    if (!settings.promptPresets) {
      settings.promptPresets = createDefaultPresetSettings();
    }
    
    // Migrate: add noiseSchedule to novelai config if missing
    if (settings.imageGeneration?.novelai && !(settings.imageGeneration.novelai as any).noiseSchedule) {
      settings.imageGeneration.novelai.noiseSchedule = 'karras';
    }
    
    // Migrate: update outdated system prompt and Author's Note, add missing items
    if (settings.promptPresets) {
      let migrated = false;
      for (const preset of settings.promptPresets.presets) {
        if (migratePresetItems(preset.items)) {
          migrated = true;
        }
        // Add missing default items (e.g., jailbreak) to old presets
        const defaultPreset = createDefaultPreset();
        const defaultItemsByType = new Map(defaultPreset.items.map(i => [i.type, i]));
        const existingTypes = new Set(preset.items.map(i => i.type));
        for (const [type, defaultItem] of defaultItemsByType) {
          if (!existingTypes.has(type)) {
            preset.items.push({ ...defaultItem, id: crypto.randomUUID() });
            migrated = true;
          }
        }
      }
      if (migrated) {
        await settingsStorage.saveSettings(settings);
      }
    }
    
    // Ensure all required fields exist
    if (!settings.modelSlots) {
      settings.modelSlots = {};
    }
    if (!settings.memorySettings) {
      settings.memorySettings = {
        extractionBatchSize: 5,
        tokenBudget: 4096,
        topK: 15,
        summaryThreshold: 50,
        embeddingProvider: '',
        embeddingApiKey: '',
        embeddingModel: '',
      };
    }
    if (settings.outputLanguage === undefined) {
      settings.outputLanguage = '';
    }
    
    settingsStore.set(settings);
  },

  /**
   * Save current settings to storage.
   */
  async save(): Promise<void> {
    const state = get(settingsStore);
    await settingsStorage.saveSettings(state);
  },
  
  /**
   * Get current state (synchronous, for non-async usage).
   */
  getCurrentState(): AppSettings {
    return get(settingsStore);
  },
};
```

### Step 2: Refactor Settings Store to Pure State

**File:** `src/lib/stores/settings.ts`

Replace the entire file content:

```typescript
/**
 * Settings store — pure reactive state for app settings.
 * Persistence handled by settingsRepo in repositories/settings-repo.ts
 */

import { writable } from 'svelte/store';
import type { AppSettings } from '$lib/storage/settings';
import { createDefaultPresetSettings } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  developerMode: false,
  imageGeneration: { ...DEFAULT_IMAGE_CONFIG } as import('$lib/types/image-config').ImageGenerationConfig,
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
  outputLanguage: '',
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<AppSettings>(DEFAULT_SETTINGS);

  return {
    subscribe,
    set,
    update,
    
    // Helper for partial updates (backward compatible)
    updatePartial(partial: Partial<AppSettings>) {
      update((s) => ({ ...s, ...partial }));
    },
    
    reset() {
      set(DEFAULT_SETTINGS);
    },
  };
}

export const settingsStore = createSettingsStore();
```

### Step 3: Update Components to Use Repository

For each settings page, update imports and replace `settingsStore.load()` with `settingsRepo.load()` and `settingsStore.save()` with `settingsRepo.save()`.

**Example for +layout.svelte:**

```typescript
// Add import
import { settingsRepo } from '$lib/repositories/settings-repo';

// Change:
await settingsStore.load();
// To:
await settingsRepo.load();
```

### Step 4: Update Tests

**File:** `tests/stores/settings-store.test.ts`

Remove tests for load() and save() methods, keep only pure state tests.

### Step 5: Verify

```bash
npm run test -- tests/stores/settings-store.test.ts
npm run check
```

---

## Task 2: Characters Repository

**Files:**
- Create: `src/lib/repositories/characters-repo.ts`
- Modify: `src/lib/stores/characters.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/characters/+page.svelte`
- Modify: `src/routes/characters/[id]/edit/+page.svelte`
- Modify: `src/routes/chat/[id]/+page.svelte`
- Modify: `src/routes/chat/[id]/info/+page.svelte`
- Test: `tests/stores/characters-store.test.ts`

### Step 1: Create Characters Repository

**File:** `src/lib/repositories/characters-repo.ts`

```typescript
/**
 * Characters repository — handles persistence for characters store.
 */

import { get } from 'svelte/store';
import { charactersStore } from '$lib/stores/characters';
import * as characterStorage from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

export const charactersRepo = {
  /**
   * Load all characters list.
   */
  async loadList(): Promise<void> {
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const list = await characterStorage.listCharacters();
      charactersStore.update((s) => ({ ...s, list, isLoading: false }));
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Select a character and load its details.
   */
  async selectCharacter(id: string): Promise<void> {
    charactersStore.update((s) => ({ ...s, isLoading: true }));
    try {
      const card = await characterStorage.loadCharacter(id);
      charactersStore.update((s) => ({ ...s, currentId: id, current: card, isLoading: false }));
    } catch (error) {
      charactersStore.update((s) => ({ ...s, isLoading: false }));
      throw error;
    }
  },

  /**
   * Save the currently selected character.
   */
  async saveCurrent(): Promise<void> {
    const state = get(charactersStore);
    if (state.currentId && state.current) {
      await characterStorage.saveCharacter(state.currentId, state.current);
    }
  },

  /**
   * Delete a character.
   */
  async deleteCharacter(id: string): Promise<void> {
    await characterStorage.deleteCharacter(id);
    const state = get(charactersStore);
    if (state.currentId === id) {
      charactersStore.clearSelection();
    }
    charactersStore.update((s) => ({
      ...s,
      list: s.list.filter((c) => c.id !== id),
    }));
  },
};
```

### Step 2: Refactor Characters Store

**File:** `src/lib/stores/characters.ts`

```typescript
/**
 * Characters store — pure reactive state for character list and selection.
 * Persistence handled by charactersRepo in repositories/characters-repo.ts
 */

import { writable } from 'svelte/store';
import type { CharacterCard } from '$lib/types';

export interface CharactersState {
  list: { id: string; name: string }[];
  currentId: string | null;
  current: CharacterCard | null;
  isLoading: boolean;
}

const DEFAULT_STATE: CharactersState = {
  list: [],
  currentId: null,
  current: null,
  isLoading: false,
};

function createCharactersStore() {
  const { subscribe, set, update } = writable<CharactersState>(DEFAULT_STATE);

  return {
    subscribe,
    set,
    update,

    // Pure state helpers (no persistence)
    setCharacters(list: { id: string; name: string }[]) {
      update((s) => ({ ...s, list }));
    },

    selectCharacterState(id: string | null, current: CharacterCard | null) {
      update((s) => ({ ...s, currentId: id, current }));
    },

    updateCharacterInList(id: string, name: string) {
      update((s) => ({
        ...s,
        list: s.list.map((c) => (c.id === id ? { ...c, name } : c)),
      }));
    },

    removeCharacter(id: string) {
      update((s) => ({
        ...s,
        list: s.list.filter((c) => c.id !== id),
        currentId: s.currentId === id ? null : s.currentId,
        current: s.currentId === id ? null : s.current,
      }));
    },

    clearSelection() {
      update((s) => ({ ...s, currentId: null, current: null }));
    },

    reset() {
      set(DEFAULT_STATE);
    },
  };
}

export const charactersStore = createCharactersStore();
```

### Step 3-5: Update Components, Tests, Verify

Similar pattern to Task 1.

---

## Task 3: Worlds Repository

**Files:**
- Create: `src/lib/repositories/worlds-repo.ts`
- Modify: `src/lib/stores/worlds.ts`
- Modify: Components (similar list to characters)
- Test: `tests/stores/worlds-store.test.ts`

Follow same pattern as Task 2, but for worlds store.

---

## Task 4: Chat Repository

**Files:**
- Create: `src/lib/repositories/chat-repo.ts`
- Modify: `src/lib/stores/chat.ts`
- Modify: `src/routes/chat/[id]/+page.svelte`
- Test: `tests/stores/chat.test.ts`

Follow same pattern.

---

## Task 5: Scene Repository

**Files:**
- Create: `src/lib/repositories/scene-repo.ts`
- Modify: `src/lib/stores/scene.ts`
- Modify: `src/routes/chat/[id]/+page.svelte`
- Modify: `src/routes/chat/[id]/info/+page.svelte`

Follow same pattern.

---

## Task 6: Final Verification

**Run full test suite:**
```bash
npm run test
```

**Run type checking:**
```bash
npm run check
```

**Verify no regressions:**
- All 500+ tests should pass
- No new TypeScript errors
- Application runs in dev mode

---

## Key Conventions

1. **Repository methods should:**
   - Set `isLoading: true` at the start of async operations
   - Set `isLoading: false` on both success and error
   - Handle errors and re-throw for caller handling
   - Call storage APIs and update stores with results

2. **Store methods should:**
   - Only manipulate reactive state
   - Never call storage APIs directly
   - Provide helper methods for common state updates
   - Be synchronous (except for the subscribe/update/set from writable)

3. **Component patterns:**
   - Import stores for reactive state: `$charactersStore.list`
   - Import repositories for persistence: `await charactersRepo.loadList()`
   - Handle errors from repositories in components

---

## Completion Checklist

- [ ] All repositories created with proper error handling
- [ ] All stores refactored to pure state
- [ ] All components updated to use repositories for persistence
- [ ] All tests updated and passing
- [ ] No TypeScript errors
- [ ] Application tested in dev mode
