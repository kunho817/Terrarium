# Refactoring Round Design

**Date:** 2026-04-20
**Scope:** High + Medium severity code quality issues + block system merge
**Approach:** Bottom-up by layer (types → core → store → UI → blocks)

---

## Section 1: Type System Foundation

### 1a. Plugin Interface Merge

Delete `plugins/plugin-interface.ts` and `plugins/plugin-validator.ts`. These define aspirational interfaces (`BasePlugin`, `AIProvider`, `CardFormat`, `ImageProvider`, `PromptBuilder`) that no runtime code implements. All runtime code uses `types/plugin.ts` interfaces (`ProviderPlugin`, `CardFormatPlugin`, `ImageProviderPlugin`, `PromptBuilderPlugin`) via `PluginRegistry`.

**Files deleted:**
- `src/lib/plugins/plugin-interface.ts` (268 lines)
- `src/lib/plugins/plugin-validator.ts` (356 lines)

**No changes to:** `types/plugin.ts`, `plugins/registry.ts`, or any provider/card-format implementations.

### 1b. AlternateGreetings Type Fix

`CharacterCard.alternateGreetings` is typed as `AlternateGreeting[]` but all card format parsers (`risuai.ts`, `sillytavern.ts`, `generic-json.ts`) produce `string[]`. This is a latent runtime error.

Change `CharacterCard.alternateGreetings` from `AlternateGreeting[]` to `string[]`. Remove the `AlternateGreeting` import from `character.ts`. The `AlternateGreeting` type remains in `world.ts` and is still used by `WorldCard`.

**Files changed:**
- `src/lib/types/character.ts` — change `alternateGreetings: AlternateGreeting[]` to `alternateGreetings: string[]`, remove import
- `src/lib/plugins/card-formats/risuai.ts` — no change (already produces strings)
- `src/lib/plugins/card-formats/sillytavern.ts` — no change (already produces strings)

### 1c. Remove `any` Types

Replace 12 `any` usages with proper types:

| File | Current | Fix |
|------|---------|-----|
| `storage/db.ts:63-65` | `let db: any` | Import and use `Database` type from sql.js |
| `storage/world-import.ts:9,22,51` | `raw: any`, `char: any`, `parsed: any` | Define explicit `RisuRawCard`, `StRawCard` raw interfaces |
| `core/image/generator.ts:73` | `(p: any) =>` | Type as `{ afterParagraph: number; prompt: string }` |
| `core/agents/agent-runner.ts:125` | `(state: any)` | Type as imported `SceneState` |
| `core/agents/character-state-agent.ts:92` | `(c: any)` | Type as `{ name: string; ... }` partial interface |
| `core/agents/memory-agent.ts:187` | `(m) => (m as any).id` | Use optional chaining on `Message` type or cast to `{ id?: string }` |
| `core/lua/runtime.ts:30` | `as any` | Use proper `VariableValue` type |
| `core/chat/use-chat-illustration.ts:20` | `config as any` | Type properly using `ImageGenerationConfig` |
| `repositories/settings-repo.ts:27` | `as any` | Use explicit property mapping instead of cast |

---

## Section 2: Core Chat Pipeline

### 2a. Extract Config Builder in `use-chat.ts`

`sendMessage()` and `rerollFromMessage()` duplicate ~20 lines of provider config resolution, preset lookup, and image config extraction. Extract:

```ts
interface ResolvedChatConfig {
  config: UserConfig;
  activePreset: PromptPreset | undefined;
  imageConfig: ImageGenerationConfig;
  imageAutoGenerate: boolean;
}

function resolveChatConfig(settings: SettingsState): ResolvedChatConfig
```

Both callers use `resolveChatConfig(get(settingsStore))`.

### 2b. Extract Trigger Execution in `engine.ts`

Four near-identical trigger execution blocks (on_user_message, on_message user, on_ai_message, on_message AI). Extract:

```ts
interface TriggerExecutionContext {
  triggers: Trigger[];
  event: string;
  message: string;
  isUserMessage: boolean;
  scene: SceneState;
  variables: VariableStore;
}

async function executeTriggers(
  ctx: TriggerExecutionContext
): Promise<{ scene: SceneState }>
```

Each block becomes a single call. Engine `send()` drops from ~300 effective lines to ~180.

### 2c. Unify `buildProviderConfig` in `generator.ts`

`buildProviderConfig(ctx)` and `buildDirectProviderConfig(imageConfig, artStyle)` are identical logic with different parameter sources. Merge into:

```ts
function buildImageProviderConfig(
  imageConfig: ImageGenerationConfig,
  negativePrompt: string
): UserConfig
```

Both `generateForChat` and `generateIllustration` call this. Remove both old methods.

---

## Section 3: Store/Repository Boundary

### 3a. Create `memory-repo.ts`

`MemoryPanel.svelte` imports 7 functions directly from `$lib/storage/memories`. Create `src/lib/repositories/memory-repo.ts`:

```ts
export const memoryRepo = {
  getForSession(sessionId: string): Promise<MemoryView[]>,
  getSummaries(sessionId: string): Promise<SessionSummary[]>,
  addMemory(sessionId: string, type: MemoryType, content: string, importance: number): Promise<void>,
  updateMemory(id: string, patch: { content?: string; importance?: number; type?: MemoryType }): Promise<void>,
  deleteMemory(id: string): Promise<void>,
  updateSummary(id: string, patch: { summary: string }): Promise<void>,
  deleteSummary(id: string): Promise<void>,
}
```

The repo handles `makeSessionId()` internally and constructs full `MemoryRecord` with defaults. The UI no longer needs to know about `embedding`, `sourceMessageIds`, `turnNumber`, etc.

### 3b. Update MemoryPanel

Replace all `$lib/storage/memories` imports with `memoryRepo`. Component script block drops from ~115 lines to ~60 lines.

---

## Section 4: UI Component Splitting

### 4a. Split `settings/image-generation/+page.svelte`

Current: 605 lines. Split into 4 sub-components under `src/lib/components/editors/`:

| Component | Responsibility | ~Lines |
|-----------|---------------|--------|
| `ImageProviderConfig.svelte` | Provider toggle, NovelAI config, ComfyUI config | ~120 |
| `ImagePromptConfig.svelte` | Auto-generate toggle, prompt instructions textarea, art style selector | ~80 |
| `ImagePresetManager.svelte` | Custom art style preset list, add/edit/delete | ~100 |
| `ImageTestPanel.svelte` | Test prompt input, generate button, result preview | ~80 |

Parent page becomes ~80 lines — state binding + layout composition.

### 4b. Component Pattern

Each sub-component receives data via props, emits changes via `onchange` callbacks. No store/storage imports in sub-components. Parent handles persistence via `settingsRepo`.

---

## Section 5: Block System Unification

### 5a. Remove Scratch Block System

The visual block system (`types/blocks.ts` graph model) is more capable and has the richer UI. The scratch system is a parallel implementation of the same concept with a simpler tree model.

**Files deleted:**
- `src/lib/types/scratch-blocks.ts` (64 lines)
- `src/lib/stores/scratch-script.ts` (209 lines)
- `src/lib/components/scratch/BlockPalette.svelte`
- `src/lib/components/scratch/PreviewPanel.svelte`
- `src/lib/components/scratch/ScratchBlock.svelte`
- `src/lib/components/scratch/ScratchBuilder.svelte`
- `src/lib/components/scratch/ScratchCanvas.svelte`
- `src/lib/components/scratch/SlotRenderer.svelte`
- `src/lib/blocks/scratch-definitions.ts`
- `src/lib/blocks/scratch-executor.ts`

**Files modified:**
- `src/lib/types/index.ts` — remove all scratch-blocks re-exports
- Any route/page that imports scratch components — remove those imports

**Net result:** ~800+ lines removed, one canonical block system.

---

## Execution Order

1. **Section 1** — Type system (foundation, no behavioral changes)
2. **Section 2** — Core chat pipeline (depends on Section 1 types)
3. **Section 3** — Memory repo (independent, safe)
4. **Section 4** — Image settings UI split (independent, safe)
5. **Section 5** — Block system cleanup (largest deletion, safe)

Each section: implement → run tests (867 must pass) → commit.
