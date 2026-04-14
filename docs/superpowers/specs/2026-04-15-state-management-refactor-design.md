# State Management Refactoring — Repository Pattern Design Spec

**Date:** 2026-04-15  
**Status:** Draft  
**Priority:** High

## Goal

Refactor state management from mixed-concern stores (state + persistence + migration) to clean separation using the Repository Pattern. This addresses technical debt from continuous feature additions and creates a maintainable foundation for future development.

## Scope

Apply Repository Pattern to all stores:
1. **settingsStore** → settings store + settings repository
2. **chatStore** → chat store + chat repository  
3. **charactersStore** → characters store + characters repository
4. **worldsStore** → worlds store + worlds repository

## Architecture

### Three-Layer Architecture

| Layer | Responsibility | Current State | Target State |
|-------|---------------|---------------|--------------|
| **Stores** | Pure reactive state | Mixed with persistence | Only state management |
| **Repositories** | Persistence, migration, caching | Embedded in stores | Dedicated layer |
| **Services** | Cross-store coordination, business logic | Scattered in components | Centralized |

### Key Principles

1. **Stores are pure**: No knowledge of localStorage, JSON files, or migration logic
2. **Repositories own persistence**: All load/save/migrate logic lives here
3. **Services coordinate**: When multiple stores need to update together
4. **Backward compatible**: Components continue using `$store` syntax unchanged

## File Organization

### New Directory Structure

```
src/lib/
├── stores/              # Pure reactive stores only
│   ├── settings.ts
│   ├── chat.ts
│   ├── characters.ts
│   ├── worlds.ts
│   └── scene.ts
├── repositories/        # Persistence layer
│   ├── settings-repo.ts
│   ├── chat-repo.ts
│   ├── characters-repo.ts
│   └── worlds-repo.ts
└── services/            # Business logic (if needed)
    └── chat-service.ts  # Coordinates chat + settings + characters
```

### File Responsibilities

**Store files** (e.g., `stores/settings.ts`):
- Define state interface (no optional migration fields)
- Create writable store with clean defaults
- Export subscribe, set, update
- NO load(), save(), or migrate() methods

**Repository files** (e.g., `repositories/settings-repo.ts`):
- Load data from storage
- Apply migrations
- Save data to storage
- Transform raw storage data to store-compatible format
- Handle errors and validation

**Service files** (e.g., `services/chat-service.ts`):
- Coordinate multiple stores
- Implement business logic that spans domains
- Orchestrate complex operations

## Implementation Details

### Store Pattern (After Refactor)

```typescript
// src/lib/stores/settings.ts
import { writable } from 'svelte/store';

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
  outputLanguage: string;  // Required, no longer optional
}

const DEFAULT_STATE: SettingsState = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  outputLanguage: '',
  // Other fields intentionally undefined until loaded
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<SettingsState>(DEFAULT_STATE);
  
  return {
    subscribe,
    set,
    update,
    // Expose reset for testing
    reset: () => set(DEFAULT_STATE),
  };
}

export const settingsStore = createSettingsStore();
```

### Repository Pattern

```typescript
// src/lib/repositories/settings-repo.ts
import { settingsStore, type SettingsState } from '$lib/stores/settings';
import * as settingsStorage from '$lib/storage/settings';
import { createDefaultPresetSettings, migratePresetItems, createDefaultPreset } from '$lib/core/presets/defaults';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

export const settingsRepo = {
  /**
   * Load settings from storage, apply migrations, set into store
   */
  async load(): Promise<void> {
    try {
      const raw = await settingsStorage.loadSettings();
      const migrated = this.migrate(raw);
      settingsStore.set(migrated);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Store remains at default state
    }
  },

  /**
   * Save current store state to storage
   */
  async save(): Promise<void> {
    try {
      const state = this.getCurrentState();
      await settingsStorage.saveSettings(state);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error; // Let caller handle UI feedback
    }
  },

  /**
   * Get current state from store (for saving)
   */
  getCurrentState(): SettingsState {
    // Use get() from svelte/store to read current value
    const { get } = require('svelte/store');
    return get(settingsStore);
  },

  /**
   * Migrate raw storage data to current schema
   */
  migrate(raw: any): SettingsState {
    // Apply default prompt preset if missing
    if (!raw.promptPresets) {
      raw.promptPresets = createDefaultPresetSettings();
    }

    // Apply noiseSchedule migration
    if (raw.imageGeneration?.novelai && !raw.imageGeneration.novelai.noiseSchedule) {
      raw.imageGeneration.novelai.noiseSchedule = 'karras';
    }

    // Apply preset migrations (system prompt, author's note, jailbreak)
    if (raw.promptPresets) {
      for (const preset of raw.promptPresets.presets) {
        migratePresetItems(preset.items);
        
        // Add missing default items (jailbreak, prefill) to old presets
        const defaultPreset = createDefaultPreset();
        const existingTypes = new Set(preset.items.map((i: any) => i.type));
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
};
```

### Connection Point (App Initialization)

```typescript
// src/routes/+layout.svelte
import { onMount } from 'svelte';
import { settingsRepo } from '$lib/repositories/settings-repo';
import { chatRepo } from '$lib/repositories/chat-repo';

onMount(async () => {
  // Load all repositories
  await Promise.all([
    settingsRepo.load(),
    chatRepo.load(),  // If chat needs repo
    // Other repos...
  ]);
});
```

### Component Usage (Unchanged)

Components continue using stores exactly as before:

```svelte
<!-- src/routes/settings/+page.svelte -->
<script>
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  
  async function handleSave() {
    await settingsRepo.save();
  }
</script>

<select bind:value={$settingsStore.theme} on:change={handleSave}>
  <!-- ... -->
</select>
```

## Migration Strategy

### Phase 1: Create Repositories Alongside Existing Code

1. Create `repositories/settings-repo.ts` with full migration logic
2. Keep existing `stores/settings.ts` unchanged temporarily
3. Add initialization in `+layout.svelte` that uses repository
4. Test that everything works

### Phase 2: Clean Up Stores

1. Remove `load()` and `save()` from stores
2. Remove migration logic from stores
3. Store becomes pure state container

### Phase 3: Repeat for Other Stores

Apply same pattern to:
- `chatStore` (may need coordination with chat storage)
- `charactersStore`
- `worldsStore`

## Files Changed

### New Files
- `src/lib/repositories/settings-repo.ts`
- `src/lib/repositories/chat-repo.ts`
- `src/lib/repositories/characters-repo.ts`
- `src/lib/repositories/worlds-repo.ts`

### Modified Files
- `src/lib/stores/settings.ts` - Remove load/save/migrate
- `src/lib/stores/chat.ts` - Remove persistence logic
- `src/lib/stores/characters.ts` - Remove persistence logic
- `src/lib/stores/worlds.ts` - Remove persistence logic
- `src/routes/+layout.svelte` - Add repository initialization

### Deleted Files (None)
All existing functionality preserved, just reorganized.

## Testing

### Unit Tests
- Test repositories in isolation (mock storage layer)
- Test stores with simple state changes
- Test migration logic with various old data formats

### Integration Tests
- Test full load → display → modify → save cycle
- Test that components receive store updates
- Test error handling (storage failures)

### Regression Tests
- All 507 existing tests must pass
- No breaking changes to component API

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Migration bugs | Medium | Thorough testing with old data formats; keep backups |
| Timing issues (store not loaded) | Low | Initialize repositories before component mount in +layout |
| Circular dependencies | Low | Repositories import stores, stores import nothing; services coordinate |
| Performance regression | Low | Repositories load once at startup; no change to runtime performance |

## Benefits After Refactor

1. **Testability**: Stores can be tested without mocking storage
2. **Clarity**: Clear separation of concerns, easier to find code
3. **Flexibility**: Can swap storage layer (localStorage → IndexedDB → backend) without touching stores
4. **Maintainability**: Migrations centralized, not scattered across stores
5. **Type Safety**: Better typing without `any` casts in migration code

## Out of Scope (Future Work)

- Svelte 5 runes migration (can be done later)
- Redux-style global state (not needed with this pattern)
- Advanced caching in repositories (can be added later)
- Service Worker / offline support (builds on repository layer)

## Success Criteria

- [ ] All stores are pure (no persistence logic)
- [ ] All persistence lives in repositories
- [ ] All migrations centralized in repositories
- [ ] Components use stores unchanged (`$store` syntax)
- [ ] All 507 tests pass
- [ ] No TypeScript errors in refactored code
- [ ] No runtime errors during normal usage
