# Refactoring Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Terrarium codebase for code quality — eliminate duplicate plugin interfaces, fix type mismatches, reduce duplication in core pipeline, enforce store/repo boundaries, split oversized UI files, and remove the redundant scratch block system.

**Architecture:** Bottom-up by layer. Section 1 (types) first since everything depends on it. Then core pipeline, store boundary, UI splitting, and finally block system cleanup. Each section is committed independently with all 867 tests passing.

**Tech Stack:** TypeScript, SvelteKit, Vitest, sql.js

**Test command:** `npx vitest run` (867 tests must pass after every task)
**Typecheck command:** `npx svelte-check --threshold error`

---

## Section 1: Type System Foundation

### Task 1: Delete unused plugin interface files

**Files:**
- Delete: `src/lib/plugins/plugin-interface.ts`
- Delete: `src/lib/plugins/plugin-validator.ts`
- Delete: `tests/plugins/plugin-validator.test.ts`

These files define aspirational plugin interfaces (`BasePlugin`, `AIProvider`, `CardFormat`, `ImageProvider`, `PromptBuilder`) that no runtime code implements. All runtime code uses `types/plugin.ts` interfaces via `PluginRegistry`.

- [ ] **Step 1: Delete the three files**

```bash
rm src/lib/plugins/plugin-interface.ts
rm src/lib/plugins/plugin-validator.ts
rm tests/plugins/plugin-validator.test.ts
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All 867 tests pass (test count drops by ~15 since plugin-validator tests are removed, but remaining tests still pass)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove unused plugin-interface and plugin-validator"
```

---

### Task 2: Fix CharacterCard.alternateGreetings type

**Files:**
- Modify: `src/lib/types/character.ts:9,23`

`CharacterCard.alternateGreetings` is typed as `AlternateGreeting[]` (structured objects with `{id, name, content}`), but all card format parsers (`risuai.ts`, `sillytavern.ts`, `generic-json.ts`) produce `string[]`. The `AlternateGreeting` structured type remains for `WorldCard` only.

- [ ] **Step 1: Update character.ts**

In `src/lib/types/character.ts`, remove the AlternateGreeting import (line 9) and change the field type (line 23):

Change line 9 from:
```ts
import type { AlternateGreeting } from './world';
```
to: (remove this line entirely)

Change line 23 from:
```ts
  alternateGreetings: AlternateGreeting[];
```
to:
```ts
  alternateGreetings: string[];
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/character.ts
git commit -m "fix: CharacterCard.alternateGreetings type to match parser output (string[])"
```

---

### Task 3: Remove `any` from db.ts

**Files:**
- Modify: `src/lib/storage/db.ts:62-65,82,86`

The sql.js `Database` type is available from the `sql.js` package. Use it to replace `any`.

- [ ] **Step 1: Add import and replace any types**

In `src/lib/storage/db.ts`, add after line 1:
```ts
import type { Database } from 'sql.js';
```

Replace lines 62-65:
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<any> | null = null;
```
with:
```ts
let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass (note: 2 pre-existing sql.js WASM errors in test env are acceptable)

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/db.ts
git commit -m "refactor: replace any with Database type in db.ts"
```

---

### Task 4: Remove `any` from world-import.ts

**Files:**
- Modify: `src/lib/storage/world-import.ts:9,22,51`

Replace `any` with explicit raw interfaces for the JSON data being parsed.

- [ ] **Step 1: Add raw interfaces and update functions**

Add before the `TCWORLD_SPEC` constant (after line 3):
```ts
interface RawAlternateGreeting {
	id?: string;
	name?: string;
	content?: string;
}

interface RawWorldCharacter {
	id?: string;
	name?: string;
	description?: string;
	personality?: string;
	exampleMessages?: string;
	avatar?: string | null;
	lorebookEntryIds?: string[];
	trackState?: boolean;
	tags?: string[];
}

interface RawWorldData extends Partial<WorldCard> {
	alternateGreetings?: (RawAlternateGreeting | string)[];
	characters?: RawWorldCharacter[];
	scenarios?: unknown;
}
```

Change `migrateAlternateGreetings` signature (line 9) from:
```ts
function migrateAlternateGreetings(raw: any): AlternateGreeting[] {
```
to:
```ts
function migrateAlternateGreetings(raw: (RawAlternateGreeting | string)[] | undefined): AlternateGreeting[] {
```

Change `migrateCharacter` signature (line 22) from:
```ts
function migrateCharacter(char: any): WorldCharacter {
```
to:
```ts
function migrateCharacter(char: RawWorldCharacter): WorldCharacter {
```

Change `parseWorldCard` local variable (line 51) from:
```ts
	let parsed: any;
```
to:
```ts
	let parsed: { spec?: string; specVersion?: string; data?: RawWorldData };
```

Change line 61 from:
```ts
	const raw = parsed.data;
```
to:
```ts
	const raw: RawWorldData = parsed.data ?? {};
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/world-import.ts
git commit -m "refactor: replace any with explicit raw interfaces in world-import"
```

---

### Task 5: Remove `any` from remaining core files

**Files:**
- Modify: `src/lib/core/image/generator.ts:73`
- Modify: `src/lib/core/agents/agent-runner.ts:125`
- Modify: `src/lib/core/agents/character-state-agent.ts:92`
- Modify: `src/lib/core/agents/memory-agent.ts:187`
- Modify: `src/lib/core/lua/runtime.ts:30`
- Modify: `src/lib/core/chat/use-chat-illustration.ts:20`
- Modify: `src/lib/repositories/settings-repo.ts:27`

- [ ] **Step 1: Fix generator.ts line 73**

In `src/lib/core/image/generator.ts`, change line 73 from:
```ts
      return parsed.filter(
        (p: any) =>
```
to:
```ts
      return parsed.filter(
        (p: { afterParagraph?: number; prompt?: string }) =>
```

- [ ] **Step 2: Fix agent-runner.ts line 125**

In `src/lib/core/agents/agent-runner.ts`, add at the top imports:
```ts
import type { SceneState } from '$lib/types/scene';
```

Change line 125 from:
```ts
				sceneStore.update((state: any) => ({
```
to:
```ts
				sceneStore.update((state: SceneState) => ({
```

- [ ] **Step 3: Fix character-state-agent.ts line 92**

In `src/lib/core/agents/character-state-agent.ts`, change line 92 from:
```ts
			characters: parsed.characters.map((c: any) => ({
```
to:
```ts
			characters: parsed.characters.map((c: { name?: string; emotion?: string; location?: string; inventory?: string[]; health?: string; notes?: string }) => ({
```

- [ ] **Step 4: Fix memory-agent.ts line 187**

In `src/lib/core/agents/memory-agent.ts`, change line 187 from:
```ts
					sourceMessageIds: messageWindow.map((m) => (m as any).id).filter(Boolean),
```
to:
```ts
					sourceMessageIds: messageWindow.map((m: Message & { id?: string }) => m.id).filter((id): id is string => typeof id === 'string'),
```

Add `Message` to the type import at the top of the file if not already there. Check the existing imports — if `Message` is not imported, add:
```ts
import type { Message } from '$lib/types';
```

- [ ] **Step 5: Fix lua/runtime.ts line 30**

In `src/lib/core/lua/runtime.ts`, change line 30 from:
```ts
			setVar: (name: string, value: unknown) => { this.variables[name] = value as any; },
```
to:
```ts
			setVar: (name: string, value: VariableValue) => { this.variables[name] = value; },
```

Check if `VariableValue` type is imported. Look at the file imports — if `VariableStore` or `VariableValue` is imported from `$lib/types/script`, ensure `VariableValue` is in the import. The `variables` field type should be `VariableStore` which is `Record<string, VariableValue>`, so this should type-check correctly.

- [ ] **Step 6: Fix use-chat-illustration.ts line 20**

In `src/lib/core/chat/use-chat-illustration.ts`, change line 20 from:
```ts
		const plans = await generator.planIllustrations(assistantMessage.content, config as any);
```
to:
```ts
		const plans = await generator.planIllustrations(assistantMessage.content, config as UserConfig);
```

Add `UserConfig` to the imports at the top:
```ts
import type { Message, UserConfig } from '$lib/types';
```

- [ ] **Step 7: Fix settings-repo.ts line 27**

In `src/lib/repositories/settings-repo.ts`, change line 27 from:
```ts
      if (settings.imageGeneration?.novelai && !(settings.imageGeneration.novelai as any).noiseSchedule) {
```
to:
```ts
      if (settings.imageGeneration?.novelai && !settings.imageGeneration.novelai.noiseSchedule) {
```

The `noiseSchedule` property already exists on the `ImageGenerationConfig['novelai']` type, so the `as any` cast is unnecessary.

- [ ] **Step 8: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: No new errors (pre-existing errors in plugin-validator.ts should be gone now)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: replace all remaining any types with proper interfaces"
```

---

## Section 2: Core Chat Pipeline

### Task 6: Extract resolveChatConfig helper in use-chat.ts

**Files:**
- Modify: `src/lib/core/chat/use-chat.ts`

`sendMessage()` (lines 81-100) and `rerollFromMessage()` (lines 150-169) duplicate ~20 lines of provider config resolution, preset lookup, and image config extraction.

- [ ] **Step 1: Add the helper function and interface**

Add after the imports (after line 14), before `initChat`:

```ts
import type { UserConfig } from '$lib/types';
import type { ImageGenerationConfig } from '$lib/types/image-config';

interface ResolvedChatConfig {
	config: UserConfig;
	activePreset: PromptPreset | undefined;
	imageConfig: ImageGenerationConfig;
	imageAutoGenerate: boolean;
}

function resolveChatConfig(settings: Record<string, unknown>): ResolvedChatConfig {
	const providerConfig = settings.providers[settings.defaultProvider] as Record<string, unknown> | undefined;
	const baseConfig: UserConfig = {
		providerId: settings.defaultProvider,
		model: (providerConfig?.model as string) || undefined,
		apiKey: (providerConfig?.apiKey as string) || undefined,
		baseUrl: (providerConfig?.baseUrl as string) || undefined,
		temperature: (providerConfig?.temperature as number) || undefined,
		maxTokens: (providerConfig?.maxTokens as number) || undefined,
	};

	const config = resolveEffectiveSettings(baseConfig, undefined);

	const presetSettings = settings.promptPresets;
	let activePreset: PromptPreset | undefined;
	if (presetSettings) {
		activePreset = presetSettings.presets.find((p: PromptPreset) => p.id === presetSettings.activePresetId);
	}

	const imageConfig = settings.imageGeneration;
	const imageAutoGenerate = !!(imageConfig?.autoGenerate && imageConfig.provider !== 'none');

	return { config, activePreset, imageConfig, imageAutoGenerate };
}
```

Note: The `resolveChatConfig` takes a settings object and the optional `worldSettings`. The callers will pass the full settings and worldSettings separately. Adjust the signature:

```ts
function resolveChatConfig(settings: AppSettings, worldSettings?: import('$lib/types/world').WorldSettings): ResolvedChatConfig {
```

And change the `resolveEffectiveSettings` call to:
```ts
	const config = resolveEffectiveSettings(baseConfig, worldSettings);
```

Import `AppSettings` at the top:
```ts
import type { AppSettings } from '$lib/storage/settings';
```

- [ ] **Step 2: Refactor sendMessage to use the helper**

Replace `sendMessage` (lines 70-120) with:

```ts
export async function sendMessage(input: string, type: MessageType): Promise<void> {
	const state = get(chatStore);
	const settings = get(settingsStore);

	const resolved = resolveActiveCard();
	if (!resolved) return;

	const sessionPersonaId = await getSessionPersonaId();
	const persona = await resolvePersona(resolved.card, sessionPersonaId);
	const engine = getEngine();
	const { config, activePreset, imageConfig, imageAutoGenerate } = resolveChatConfig(settings, resolved.worldCard?.worldSettings);

	const result = await engine.send({
		input,
		type,
		card: resolved.card,
		scene: get(sceneStore),
		config,
		messages: state.messages,
		characterId: (state.characterId as string | null) ?? undefined,
		sessionId: (state.sessionId as string | null) ?? undefined,
		preset: activePreset,
		persona,
		worldCard: resolved.worldCard,
		imageAutoGenerate,
	});

	chatStore.addMessage(result.userMessage);

	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
}
```

- [ ] **Step 3: Refactor rerollFromMessage to use the helper**

Replace `rerollFromMessage` (lines 130-185) with:

```ts
export async function rerollFromMessage(userMessageIndex: number): Promise<void> {
	const state = get(chatStore);
	const settings = get(settingsStore);

	if (userMessageIndex < 0 || userMessageIndex >= state.messages.length) return;

	const resolved = resolveActiveCard();
	if (!resolved) return;

	const userMessage = state.messages[userMessageIndex];
	if (userMessage.role !== 'user') return;

	chatStore.truncateAfter(userMessageIndex);
	await chatRepo.saveMessages();

	const currentState = get(chatStore);
	const sessionPersonaId = await getSessionPersonaId();
	const persona = await resolvePersona(resolved.card, sessionPersonaId);
	const engine = getEngine();
	const { config, activePreset, imageConfig, imageAutoGenerate } = resolveChatConfig(settings, resolved.worldCard?.worldSettings);

	const result = await engine.send({
		input: userMessage.content,
		type: userMessage.type,
		card: resolved.card,
		scene: get(sceneStore),
		config,
		messages: currentState.messages,
		preset: activePreset,
		persona,
		worldCard: resolved.worldCard,
		imageAutoGenerate,
	});

	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/use-chat.ts
git commit -m "refactor: extract resolveChatConfig to deduplicate sendMessage/rerollFromMessage"
```

---

### Task 7: Extract executeTriggers helper in engine.ts

**Files:**
- Modify: `src/lib/core/chat/engine.ts`

Four near-identical trigger execution blocks exist in the `send()` method. Extract a shared helper.

- [ ] **Step 1: Add the helper function**

Add before the `ChatEngine` class (after the `buildWorldCharacterLore` function, around line 66):

```ts
interface TriggerExecContext {
	triggers: import('$lib/types/trigger').Trigger[];
	event: string;
	message: string;
	isUserMessage: boolean;
	scene: SceneState;
}

async function executeTriggers(
	ctx: TriggerExecContext,
): Promise<{ scene: SceneState }> {
	let currentScene = ctx.scene;

	const triggers = matchTriggers(ctx.triggers, ctx.event, {
		message: ctx.message,
		isUserMessage: ctx.isUserMessage,
	});

	for (const trigger of triggers) {
		try {
			const scriptResult = await executeScript(trigger.script, {
				variables: currentScene.variables,
				scene: { location: currentScene.location, time: currentScene.time, mood: currentScene.mood },
				message: ctx.message,
				isUserMessage: ctx.isUserMessage,
			});
			if (scriptResult.success) {
				const { scene: newScene } = applyMutations(currentScene, scriptResult.mutations as ScriptMutation[]);
				currentScene = newScene;
			}
		} catch {
		}
	}

	return { scene: currentScene };
}
```

- [ ] **Step 2: Replace the four trigger blocks in send()**

Replace lines 116-166 (the four trigger execution blocks: on_user_message via TriggerExecutor, on_user_message via matchTriggers, on_message for user, and their combined logic) with:

After creating `userMessage` and before `this.events.emit('on_user_message', ...)`, replace all trigger code with:

```ts
    let triggerScene = options.scene;
    if (options.card.triggers?.length > 0) {
      try {
        const executor = new TriggerExecutor(options.card.triggers, triggerScene.variables);
        const result = await executor.execute('on_user_message');
        triggerScene = { ...triggerScene, variables: result.variables };
      } catch {
      }
    }

    const userTrigResult = await executeTriggers({
      triggers: options.card.triggers,
      event: 'on_user_message',
      message: processedInput,
      isUserMessage: true,
      scene: triggerScene,
    });
    triggerScene = userTrigResult.scene;

    const onMsgUserResult = await executeTriggers({
      triggers: options.card.triggers,
      event: 'on_message',
      message: processedInput,
      isUserMessage: true,
      scene: triggerScene,
    });
    triggerScene = onMsgUserResult.scene;
```

And in the `tokenStream()` function (the AI message trigger blocks, lines 318-363), replace with:

```ts
      if (capturedCtx.card.triggers?.length > 0) {
        try {
          const executor = new TriggerExecutor(capturedCtx.card.triggers, capturedCtx.scene.variables);
          await executor.execute('on_ai_message');
        } catch {
        }
      }

      const aiTrigResult = await executeTriggers({
        triggers: capturedCtx.card.triggers,
        event: 'on_ai_message',
        message: processed,
        isUserMessage: false,
        scene: capturedCtx.scene,
      });

      const onMsgAiResult = await executeTriggers({
        triggers: capturedCtx.card.triggers,
        event: 'on_message',
        message: processed,
        isUserMessage: false,
        scene: aiTrigResult.scene,
      });
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/chat/engine.ts
git commit -m "refactor: extract executeTriggers helper to deduplicate engine.ts"
```

---

### Task 8: Unify buildProviderConfig in generator.ts

**Files:**
- Modify: `src/lib/core/image/generator.ts`

`buildProviderConfig(ctx)` and `buildDirectProviderConfig(imageConfig, artStyle)` are nearly identical.

- [ ] **Step 1: Replace both methods with a single unified one**

Replace the two private methods `buildProviderConfig` (lines 227-254) and `buildDirectProviderConfig` (lines 256-283) with a single private method:

```ts
  private buildImageProviderConfig(
    imageConfig: ImageGenerationConfig,
    negativePrompt: string,
  ): UserConfig {
    if (imageConfig.provider === 'novelai') {
      return {
        providerId: 'novelai',
        apiKey: imageConfig.novelai.apiKey,
        model: imageConfig.novelai.model,
        width: imageConfig.novelai.width,
        height: imageConfig.novelai.height,
        steps: imageConfig.novelai.steps,
        scale: imageConfig.novelai.scale,
        sampler: imageConfig.novelai.sampler,
        noiseSchedule: imageConfig.novelai.noiseSchedule,
        negativePrompt,
      } as UserConfig;
    }

    if (imageConfig.provider === 'comfyui') {
      return {
        providerId: 'comfyui',
        comfyuiUrl: imageConfig.comfyui.url,
        comfyuiWorkflow: imageConfig.comfyui.workflow,
        comfyuiTimeout: imageConfig.comfyui.timeout,
        negativePrompt,
      } as UserConfig;
    }

    return { providerId: 'none' } as UserConfig;
  }
```

- [ ] **Step 2: Update the two call sites**

In `generateForChat()` (line 150), change:
```ts
    const providerConfig = this.buildProviderConfig(ctx);
```
to:
```ts
    const providerConfig = this.buildImageProviderConfig(ctx.imageConfig, ctx.artStyle.negativePrompt);
```

In `generateIllustration()` (line 94), change:
```ts
    const providerConfig = this.buildDirectProviderConfig(imageConfig, artStyle);
```
to:
```ts
    const providerConfig = this.buildImageProviderConfig(imageConfig, artStyle.negativePrompt);
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/image/generator.ts
git commit -m "refactor: unify buildProviderConfig methods in generator.ts"
```

---

## Section 3: Store/Repository Boundary

### Task 9: Create memory-repo.ts

**Files:**
- Create: `src/lib/repositories/memory-repo.ts`

- [ ] **Step 1: Create the memory repository**

Create `src/lib/repositories/memory-repo.ts` with:

```ts
import {
	getMemoriesForSession,
	getSummariesForSession,
	updateMemory,
	deleteMemory,
	insertMemory,
	updateSummary,
	deleteSummary,
} from '$lib/storage/memories';
import type { MemoryType, MemoryRecord, SessionSummary } from '$lib/types/memory';
import { makeSessionId } from '$lib/types/branded';

export interface MemoryView {
	id: string;
	type: MemoryType;
	content: string;
	importance: number;
	turnNumber: number;
	createdAt: number;
}

export const memoryRepo = {
	async getForSession(sessionId: string): Promise<MemoryView[]> {
		const mems = await getMemoriesForSession(sessionId);
		return mems.map(m => ({
			id: m.id,
			type: m.type,
			content: m.content,
			importance: m.importance,
			turnNumber: m.turnNumber,
			createdAt: m.createdAt,
		}));
	},

	async getSummaries(sessionId: string): Promise<SessionSummary[]> {
		return getSummariesForSession(sessionId);
	},

	async addMemory(sessionId: string, type: MemoryType, content: string, importance: number): Promise<void> {
		const record: MemoryRecord = {
			id: crypto.randomUUID(),
			sessionId: makeSessionId(sessionId),
			type,
			content,
			importance,
			sourceMessageIds: [],
			turnNumber: 0,
			createdAt: Date.now(),
			embedding: new Array(128).fill(0),
		};
		await insertMemory(record);
	},

	async updateMemory(id: string, patch: { content?: string; importance?: number; type?: MemoryType }): Promise<void> {
		await updateMemory(id, patch);
	},

	async deleteMemory(id: string): Promise<void> {
		await deleteMemory(id);
	},

	async updateSummary(id: string, patch: { summary: string }): Promise<void> {
		await updateSummary(id, patch);
	},

	async deleteSummary(id: string): Promise<void> {
		await deleteSummary(id);
	},
};
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass (new file, no imports changed yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/repositories/memory-repo.ts
git commit -m "refactor: create memory-repo to decouple UI from storage layer"
```

---

### Task 10: Update MemoryPanel to use memory-repo

**Files:**
- Modify: `src/lib/components/MemoryPanel.svelte`

- [ ] **Step 1: Replace storage imports with repo**

Replace the imports section (lines 3-13) in `MemoryPanel.svelte`:

Change from:
```ts
	import {
		getMemoriesForSession,
		getSummariesForSession,
		updateMemory,
		deleteMemory,
		insertMemory,
		updateSummary,
		deleteSummary,
	} from '$lib/storage/memories';
	import type { MemoryType, MemoryRecord, SessionSummary } from '$lib/types/memory';
	import { makeSessionId } from '$lib/types/branded';
```
to:
```ts
	import { memoryRepo, type MemoryView } from '$lib/repositories/memory-repo';
	import type { MemoryType, SessionSummary } from '$lib/types/memory';
```

- [ ] **Step 2: Update local type and state**

Change line 25 (the MemoryView type) from:
```ts
	type MemoryView = { id: string; type: MemoryType; content: string; importance: number; turnNumber: number; createdAt: number };
```
Remove this line (the type is now imported from the repo).

- [ ] **Step 3: Update load function**

Change the `load()` function to use the repo:
```ts
	async function load() {
		try {
			memories = await memoryRepo.getForSession(sessionId);
			summaries = await memoryRepo.getSummaries(sessionId);
		} catch {
			memories = [];
			summaries = [];
		}
	}
```

- [ ] **Step 4: Update handler functions**

Replace `handleUpdate`:
```ts
	async function handleUpdate(id: string, patch: { content?: string; importance?: number; type?: MemoryType }) {
		await memoryRepo.updateMemory(id, patch);
		await load();
	}
```

Replace `handleDelete`:
```ts
	async function handleDelete(id: string) {
		await memoryRepo.deleteMemory(id);
		await load();
	}
```

Replace `handleAddMemory`:
```ts
	async function handleAddMemory() {
		if (!newContent.trim()) return;
		await memoryRepo.addMemory(sessionId, newType, newContent.trim(), newImportance);
		newContent = '';
		newType = 'event';
		newImportance = 0.7;
		showAddForm = false;
		await load();
	}
```

Replace `handleUpdateSummary`:
```ts
	async function handleUpdateSummary(id: string, patch: { summary: string }) {
		await memoryRepo.updateSummary(id, patch);
		await load();
	}
```

Replace `handleDeleteSummary`:
```ts
	async function handleDeleteSummary(id: string) {
		await memoryRepo.deleteSummary(id);
		await load();
	}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/MemoryPanel.svelte
git commit -m "refactor: update MemoryPanel to use memory-repo instead of direct storage"
```

---

## Section 4: UI Component Splitting

### Task 11: Extract ImageProviderConfig.svelte

**Files:**
- Create: `src/lib/components/editors/ImageProviderConfig.svelte`

This component handles provider selection and the NovelAI/ComfyUI configuration sections.

- [ ] **Step 1: Create the component**

Create `src/lib/components/editors/ImageProviderConfig.svelte` with props for all provider-specific state and onchange callbacks. The component receives:
- `provider`, `novelaiApiKey`, `novelaiModel`, `novelaiWidth`, `novelaiHeight`, `novelaiSteps`, `novelaiScale`, `novelaiSampler`, `novelaiNoiseSchedule`
- `comfyuiUrl`, `comfyuiWorkflow`, `comfyuiTimeout`
- `modelGroups` (derived)
- `compatibleSchedules` (derived)
- `NOVELAI_SAMPLERS`

Use bind: for two-way state binding (the parent owns the state, child updates it directly via bind).

```svelte
<script lang="ts">
	import {
		NOVELAI_SAMPLERS,
	} from '$lib/core/image-gen/novelai-constants';
	import type { ImageGenerationConfig } from '$lib/types';

	export let NOVELAI_MODELS: typeof import('$lib/core/image-gen/novelai-constants').NOVELAI_MODELS;

	let {
		provider = $bindable(),
		novelaiApiKey = $bindable(),
		novelaiModel = $bindable(),
		novelaiWidth = $bindable(),
		novelaiHeight = $bindable(),
		novelaiSteps = $bindable(),
		novelaiScale = $bindable(),
		novelaiSampler = $bindable(),
		novelaiNoiseSchedule = $bindable(),
		comfyuiUrl = $bindable(),
		comfyuiWorkflow = $bindable(),
		comfyuiTimeout = $bindable(),
		modelGroups,
		compatibleSchedules,
	}: {
		provider: string;
		novelaiApiKey: string;
		novelaiModel: string;
		novelaiWidth: number;
		novelaiHeight: number;
		novelaiSteps: number;
		novelaiScale: number;
		novelaiSampler: string;
		novelaiNoiseSchedule: string;
		comfyuiUrl: string;
		comfyuiWorkflow: string;
		comfyuiTimeout: number;
		modelGroups: () => [string, { value: string; label: string }[]][];
		compatibleSchedules: { value: string; label: string }[];
	} = $props();
</script>

<section class="space-y-3">
	<h2 class="text-sm font-medium text-text">Image Provider</h2>
	<select
		bind:value={provider}
		class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
		       focus:outline-none focus:border-mauve"
	>
		<option value="none">None</option>
		<option value="novelai">NovelAI</option>
		<option value="comfyui">ComfyUI</option>
	</select>
	<p class="text-xs text-subtext0">Select the image generation provider to use for illustrations.</p>
</section>

{#if provider === 'novelai'}
	<section class="space-y-3">
		<h2 class="text-sm font-medium text-text">NovelAI Settings</h2>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-key">API Key</label>
			<input id="nai-key" type="password" bind:value={novelaiApiKey}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve"
				placeholder="Your NovelAI API key" />
		</div>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-model">Model</label>
			<select id="nai-model" bind:value={novelaiModel}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve">
				{#each modelGroups() as [group, models]}
					<optgroup label={group}>
						{#each models as model}
							<option value={model.value}>{model.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-width">Width</label>
				<input id="nai-width" type="number" bind:value={novelaiWidth}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve" />
			</div>
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-height">Height</label>
				<input id="nai-height" type="number" bind:value={novelaiHeight}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve" />
			</div>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-steps">Steps</label>
				<input id="nai-steps" type="number" bind:value={novelaiSteps}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve" />
			</div>
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-scale">CFG Scale</label>
				<input id="nai-scale" type="number" bind:value={novelaiScale}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve" />
			</div>
		</div>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-sampler">Sampler</label>
			<select id="nai-sampler" bind:value={novelaiSampler}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve">
				{#each NOVELAI_SAMPLERS as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-noise-schedule">Noise Schedule</label>
			<select id="nai-noise-schedule" bind:value={novelaiNoiseSchedule}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve">
				{#each compatibleSchedules as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</div>
	</section>
{/if}

{#if provider === 'comfyui'}
	<section class="space-y-3">
		<h2 class="text-sm font-medium text-text">ComfyUI Settings</h2>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="cui-url">Server URL</label>
			<input id="cui-url" type="text" bind:value={comfyuiUrl}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve"
				placeholder="http://localhost:8188" />
		</div>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="cui-workflow">Workflow JSON</label>
			<textarea id="cui-workflow" bind:value={comfyuiWorkflow} rows={8}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"
				placeholder="Paste your ComfyUI workflow JSON here..."></textarea>
		</div>
		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="cui-timeout">Timeout (seconds)</label>
			<input id="cui-timeout" type="number" bind:value={comfyuiTimeout}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve" />
		</div>
	</section>
{/if}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass (new file, not wired up yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editors/ImageProviderConfig.svelte
git commit -m "refactor: extract ImageProviderConfig component from image-generation settings"
```

---

### Task 12: Extract ImagePromptConfig.svelte

**Files:**
- Create: `src/lib/components/editors/ImagePromptConfig.svelte`

Handles auto-generate toggle, image prompt instructions, and prompt textareas.

- [ ] **Step 1: Create the component**

Create `src/lib/components/editors/ImagePromptConfig.svelte`:

```svelte
<script lang="ts">
	let {
		autoGenerate = $bindable(),
		imagePromptInstructions = $bindable(),
		positivePrompt = $bindable(),
		negativePrompt = $bindable(),
	}: {
		autoGenerate: boolean;
		imagePromptInstructions: string;
		positivePrompt: string;
		negativePrompt: string;
	} = $props();
</script>

<section class="space-y-3">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-sm font-medium text-text">Auto-generate Illustrations</h2>
			<p class="text-xs text-subtext0">Automatically generate images during roleplay based on scene context.</p>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={autoGenerate}
			onclick={() => { autoGenerate = !autoGenerate; }}
			class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
			       transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-2 focus:ring-offset-base
			       {autoGenerate ? 'bg-mauve' : 'bg-surface1'}"
		>
			<span
				class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow ring-0
				       transition-transform duration-200 ease-in-out
				       {autoGenerate ? 'translate-x-5' : 'translate-x-0'}"
			></span>
		</button>
	</div>
</section>

<section class="space-y-3">
	<h2 class="text-sm font-medium text-text">Art Style</h2>
	<div class="space-y-1">
		<label class="text-xs font-medium text-subtext0" for="positive-prompt">Positive Prompt</label>
		<textarea id="positive-prompt" bind:value={positivePrompt} rows={3}
			class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
			       focus:outline-none focus:border-mauve resize-y"
			placeholder="Tags and phrases to include in generated images..."></textarea>
	</div>
	<div class="space-y-1">
		<label class="text-xs font-medium text-subtext0" for="negative-prompt">Negative Prompt</label>
		<textarea id="negative-prompt" bind:value={negativePrompt} rows={3}
			class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
			       focus:outline-none focus:border-mauve resize-y"
			placeholder="Tags and phrases to exclude from generated images..."></textarea>
	</div>
</section>

<section class="space-y-3">
	<div>
		<h2 class="text-sm font-medium text-text">Image Prompt Instructions</h2>
		<p class="text-xs text-subtext0">Instructions for the AI when generating image prompts from scene context.</p>
	</div>
	<textarea
		bind:value={imagePromptInstructions}
		rows={6}
		class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
		       focus:outline-none focus:border-mauve resize-y"
		placeholder="Describe how the AI should generate image prompts..."
	></textarea>
</section>
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editors/ImagePromptConfig.svelte
git commit -m "refactor: extract ImagePromptConfig component from image-generation settings"
```

---

### Task 13: Extract ImagePresetManager.svelte

**Files:**
- Create: `src/lib/components/editors/ImagePresetManager.svelte`

Handles art style preset selection, custom preset CRUD, and the preset editor form.

- [ ] **Step 1: Create the component**

Create `src/lib/components/editors/ImagePresetManager.svelte`:

```svelte
<script lang="ts">
	import { DEFAULT_ART_PRESETS } from '$lib/types';
	import type { ArtStylePreset } from '$lib/types/art-style';

	let {
		artStylePresetId = $bindable(),
		customPresets = $bindable(),
		positivePrompt = $bindable(),
		negativePrompt = $bindable(),
	}: {
		artStylePresetId: string;
		customPresets: ArtStylePreset[];
		positivePrompt: string;
		negativePrompt: string;
	} = $props();

	let showPresetEditor = $state(false);
	let editingPreset: ArtStylePreset | null = $state(null);
	let newPresetName = $state('');
	let newPresetPositive = $state('');
	let newPresetNegative = $state('');

	const allPresets = $derived([...DEFAULT_ART_PRESETS, ...customPresets]);

	function handlePresetChange(id: string) {
		artStylePresetId = id;
		const preset = allPresets.find((p) => p.id === id);
		if (preset) {
			positivePrompt = preset.positivePrompt;
			negativePrompt = preset.negativePrompt;
		}
	}

	function handleNewPreset() {
		newPresetName = '';
		newPresetPositive = positivePrompt;
		newPresetNegative = negativePrompt;
		editingPreset = null;
		showPresetEditor = true;
	}

	function handleEditPreset(id: string) {
		const preset = customPresets.find((p) => p.id === id);
		if (!preset) return;
		newPresetName = preset.name;
		newPresetPositive = preset.positivePrompt;
		newPresetNegative = preset.negativePrompt;
		editingPreset = preset;
		showPresetEditor = true;
	}

	function handleSavePreset() {
		if (!newPresetName.trim()) return;
		if (editingPreset) {
			const idx = customPresets.findIndex((p) => p.id === editingPreset!.id);
			if (idx >= 0) {
				customPresets[idx] = {
					...editingPreset,
					name: newPresetName,
					positivePrompt: newPresetPositive,
					negativePrompt: newPresetNegative,
				};
				customPresets = [...customPresets];
			}
		} else {
			const newPreset: ArtStylePreset = {
				id: crypto.randomUUID(),
				name: newPresetName,
				positivePrompt: newPresetPositive,
				negativePrompt: newPresetNegative,
			};
			customPresets = [...customPresets, newPreset];
			artStylePresetId = newPreset.id;
			positivePrompt = newPreset.positivePrompt;
			negativePrompt = newPreset.negativePrompt;
		}
		showPresetEditor = false;
		editingPreset = null;
	}

	function handleDeletePreset(id: string) {
		customPresets = customPresets.filter((p) => p.id !== id);
		if (artStylePresetId === id) {
			handlePresetChange('anime');
		}
	}
</script>

<section class="space-y-3">
	<h2 class="text-sm font-medium text-text">Art Style Preset</h2>
	<select
		value={artStylePresetId}
		onchange={(e) => handlePresetChange((e.target as HTMLSelectElement).value)}
		class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
		       focus:outline-none focus:border-mauve"
	>
		<optgroup label="Built-in">
			{#each DEFAULT_ART_PRESETS as preset}
				<option value={preset.id}>{preset.name}</option>
			{/each}
		</optgroup>
		{#if customPresets.length > 0}
			<optgroup label="My Presets">
				{#each customPresets as preset}
					<option value={preset.id}>{preset.name}</option>
				{/each}
			</optgroup>
		{/if}
	</select>

	<div class="flex gap-2">
		<button type="button" onclick={handleNewPreset}
			class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2">
			+ New
		</button>
		{#if customPresets.find((p) => p.id === artStylePresetId)}
			<button type="button" onclick={() => handleEditPreset(artStylePresetId)}
				class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2">
				Edit
			</button>
			<button type="button" onclick={() => handleDeletePreset(artStylePresetId)}
				class="text-xs bg-surface1 text-red px-3 py-1 rounded hover:bg-surface2">
				Delete
			</button>
		{/if}
	</div>

	{#if showPresetEditor}
		<div class="space-y-2 p-3 bg-surface0 rounded-md border border-surface1">
			<input bind:value={newPresetName} placeholder="Preset name"
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve" />
			<textarea bind:value={newPresetPositive} rows={2} placeholder="Positive prompt"
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
			<textarea bind:value={newPresetNegative} rows={2} placeholder="Negative prompt"
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
			<div class="flex gap-2">
				<button type="button" onclick={handleSavePreset}
					class="text-xs bg-mauve text-crust px-3 py-1 rounded hover:opacity-90">
					Save Preset
				</button>
				<button type="button" onclick={() => { showPresetEditor = false; }}
					class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2">
					Cancel
				</button>
			</div>
		</div>
	{/if}
</section>
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editors/ImagePresetManager.svelte
git commit -m "refactor: extract ImagePresetManager component from image-generation settings"
```

---

### Task 14: Extract ImageTestPanel.svelte

**Files:**
- Create: `src/lib/components/editors/ImageTestPanel.svelte`

Handles test prompt input, generate button, and result display.

- [ ] **Step 1: Create the component**

Create `src/lib/components/editors/ImageTestPanel.svelte`:

```svelte
<script lang="ts">
	let {
		testPrompt = $bindable(),
		testGenerating,
		testResult,
		testError,
		testFullPrompt,
		ongenerate,
	}: {
		testPrompt: string;
		testGenerating: boolean;
		testResult: string | null;
		testError: string | null;
		testFullPrompt: string | null;
		ongenerate: () => void;
	} = $props();
</script>

<section class="space-y-3">
	<div>
		<h2 class="text-sm font-medium text-text">Test Image Generation</h2>
		<p class="text-xs text-subtext0">Generate a test image with your current settings to verify everything works.</p>
	</div>

	<div class="space-y-1">
		<label class="text-xs font-medium text-subtext0" for="test-prompt">Test Prompt</label>
		<input id="test-prompt" type="text" bind:value={testPrompt} disabled={testGenerating}
			class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
			       focus:outline-none focus:border-mauve disabled:opacity-50"
			placeholder="1girl, smile, beautiful scenery, detailed" />
	</div>

	<button
		type="button"
		onclick={ongenerate}
		disabled={testGenerating || !testPrompt.trim()}
		class="bg-surface1 text-text rounded-md px-4 py-2 text-sm font-medium
		       hover:bg-surface2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
	>
		{testGenerating ? 'Generating...' : 'Generate Test Image'}
	</button>

	{#if testGenerating}
		<div class="flex items-center gap-2 text-xs text-subtext0">
			<div class="w-3 h-3 border-2 border-mauve border-t-transparent rounded-full animate-spin"></div>
			Generating image... This may take a moment.
		</div>
	{/if}

	{#if testError}
		<div class="p-3 bg-red/10 border border-red/30 rounded-md">
			<p class="text-xs text-red font-medium">Error</p>
			<p class="text-xs text-red mt-1">{testError}</p>
		</div>
	{/if}

	{#if testFullPrompt}
		<div class="p-2 bg-surface0 rounded-md border border-surface1">
			<p class="text-xs text-subtext0 mb-1">Combined prompt sent to provider:</p>
			<p class="text-xs text-text break-all">{testFullPrompt}</p>
		</div>
	{/if}

	{#if testResult}
		<div class="space-y-2">
			<p class="text-xs text-green font-medium">Success!</p>
			<div class="inline-block bg-surface0 rounded-lg border border-surface1 overflow-hidden">
				<img src={testResult} alt="Test generated image" class="max-w-sm max-h-96" />
			</div>
		</div>
	{/if}
</section>
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editors/ImageTestPanel.svelte
git commit -m "refactor: extract ImageTestPanel component from image-generation settings"
```

---

### Task 15: Refactor parent page to compose sub-components

**Files:**
- Modify: `src/routes/settings/image-generation/+page.svelte`

- [ ] **Step 1: Replace the page with the composed version**

Replace the entire `src/routes/settings/image-generation/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { settingsRepo } from '$lib/repositories/settings-repo';
  import { DEFAULT_ART_PRESETS } from '$lib/types';
  import type { ImageGenerationConfig } from '$lib/types';
  import { DEFAULT_IMAGE_CONFIG } from '$lib/types';
  import {
    NOVELAI_MODELS,
    getCompatibleNoiseSchedules,
  } from '$lib/core/image-gen/novelai-constants';
  import type { ArtStylePreset } from '$lib/types/art-style';
  import { getRegistry } from '$lib/core/bootstrap';
  import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
  import ImageProviderConfig from '$lib/components/editors/ImageProviderConfig.svelte';
  import ImagePromptConfig from '$lib/components/editors/ImagePromptConfig.svelte';
  import ImagePresetManager from '$lib/components/editors/ImagePresetManager.svelte';
  import ImageTestPanel from '$lib/components/editors/ImageTestPanel.svelte';

  let loaded = $state(false);

  let provider = $state<string>('none');
  let autoGenerate = $state(false);
  let artStylePresetId = $state('anime');
  let imagePromptInstructions = $state('');
  let positivePrompt = $state('');
  let negativePrompt = $state('');

  let novelaiApiKey = $state('');
  let novelaiModel = $state('');
  let novelaiWidth = $state(832);
  let novelaiHeight = $state(1216);
  let novelaiSteps = $state(28);
  let novelaiScale = $state(5);
  let novelaiSampler = $state('');
  let novelaiNoiseSchedule = $state('karras');

  let comfyuiUrl = $state('');
  let comfyuiWorkflow = $state('');
  let comfyuiTimeout = $state(60);

  let customPresets = $state<ArtStylePreset[]>([]);
  let testPrompt = $state('1girl, smile, beautiful scenery, detailed');
  let testGenerating = $state(false);
  let testResult: string | null = $state(null);
  let testError: string | null = $state(null);
  let testFullPrompt: string | null = $state(null);

  const compatibleSchedules = $derived(getCompatibleNoiseSchedules(novelaiModel, novelaiSampler));

  const modelGroups = $derived(() => {
    const groups: Record<string, typeof NOVELAI_MODELS> = {};
    for (const m of NOVELAI_MODELS) {
      if (!groups[m.group]) groups[m.group] = [];
      groups[m.group].push(m);
    }
    return Object.entries(groups);
  });

  function loadFromStore() {
    const ig = $settingsStore.imageGeneration ?? { ...DEFAULT_IMAGE_CONFIG };
    provider = ig.provider ?? 'none';
    autoGenerate = ig.autoGenerate ?? false;
    artStylePresetId = ig.artStylePresetId ?? 'anime';
    imagePromptInstructions = ig.imagePromptInstructions ?? DEFAULT_IMAGE_CONFIG.imagePromptInstructions;
    novelaiApiKey = ig.novelai?.apiKey ?? '';
    novelaiModel = ig.novelai?.model ?? 'nai-diffusion-4-5-full';
    novelaiWidth = ig.novelai?.width ?? 832;
    novelaiHeight = ig.novelai?.height ?? 1216;
    novelaiSteps = ig.novelai?.steps ?? 28;
    novelaiScale = ig.novelai?.scale ?? 5;
    novelaiSampler = ig.novelai?.sampler ?? 'k_euler_ancestral';
    novelaiNoiseSchedule = ig.novelai?.noiseSchedule ?? 'karras';
    comfyuiUrl = ig.comfyui?.url ?? 'http://localhost:8188';
    comfyuiWorkflow = ig.comfyui?.workflow ?? '';
    comfyuiTimeout = ig.comfyui?.timeout ?? 60;
    customPresets = $settingsStore.customArtStylePresets ?? [];
    const allPresets = [...DEFAULT_ART_PRESETS, ...customPresets];
    const preset = allPresets.find((p) => p.id === artStylePresetId) ?? DEFAULT_ART_PRESETS[0];
    positivePrompt = preset.positivePrompt;
    negativePrompt = preset.negativePrompt;
  }

  function buildConfig(): ImageGenerationConfig {
    return {
      provider: provider as ImageGenerationConfig['provider'],
      autoGenerate,
      artStylePresetId,
      imagePromptInstructions,
      novelai: {
        apiKey: novelaiApiKey,
        model: novelaiModel,
        width: novelaiWidth,
        height: novelaiHeight,
        steps: novelaiSteps,
        scale: novelaiScale,
        sampler: novelaiSampler,
        noiseSchedule: novelaiNoiseSchedule,
      },
      comfyui: {
        url: comfyuiUrl,
        workflow: comfyuiWorkflow,
        timeout: comfyuiTimeout,
      },
    };
  }

  async function handleSave() {
    settingsStore.update({
      imageGeneration: buildConfig(),
      customArtStylePresets: customPresets,
    });
    await settingsRepo.save();
  }

  async function handleTestGenerate() {
    testGenerating = true;
    testResult = null;
    testError = null;
    testFullPrompt = null;

    try {
      const imageConfig = buildConfig();
      if (imageConfig.provider === 'none') {
        testError = 'No image provider selected.';
        return;
      }
      if (imageConfig.provider === 'novelai' && !imageConfig.novelai.apiKey) {
        testError = 'NovelAI API key is required.';
        return;
      }
      const artStyle = resolveArtStyle(artStylePresetId, customPresets);
      const generator = new ImageGenerator(getRegistry());
      const result = await generator.generateDirect(testPrompt, imageConfig, artStyle);
      testResult = result.dataUrl;
      testFullPrompt = result.prompt;
    } catch (e: unknown) {
      testError = e instanceof Error ? e.message : String(e);
    } finally {
      testGenerating = false;
    }
  }

  onMount(async () => {
    await settingsRepo.load();
    loadFromStore();
    loaded = true;
  });
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-8">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-text">Image Generation</h1>
        <a href="/settings" class="text-mauve hover:text-lavender text-sm">&larr; Back to Settings</a>
      </div>

      <ImageProviderConfig
        bind:provider bind:novelaiApiKey bind:novelaiModel bind:novelaiWidth bind:novelaiHeight
        bind:novelaiSteps bind:novelaiScale bind:novelaiSampler bind:novelaiNoiseSchedule
        bind:comfyuiUrl bind:comfyuiWorkflow bind:comfyuiTimeout
        {modelGroups} {compatibleSchedules}
      />

      <ImagePromptConfig
        bind:autoGenerate bind:imagePromptInstructions bind:positivePrompt bind:negativePrompt
      />

      <ImagePresetManager
        bind:artStylePresetId bind:customPresets bind:positivePrompt bind:negativePrompt
      />

      {#if provider !== 'none'}
        <ImageTestPanel
          bind:testPrompt {testGenerating} {testResult} {testError} {testFullPrompt}
          ongenerate={handleTestGenerate}
        />
      {/if}

      <div class="pt-2 pb-6">
        <button type="button" onclick={handleSave}
          class="bg-mauve text-crust rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
          Save Settings
        </button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/image-generation/+page.svelte
git commit -m "refactor: compose image-generation page from extracted sub-components"
```

---

## Section 5: Block System Unification

### Task 16: Delete scratch block system

**Files:**
- Delete: `src/lib/types/scratch-blocks.ts`
- Delete: `src/lib/stores/scratch-script.ts`
- Delete: `src/lib/components/scratch/BlockPalette.svelte`
- Delete: `src/lib/components/scratch/PreviewPanel.svelte`
- Delete: `src/lib/components/scratch/ScratchBlock.svelte`
- Delete: `src/lib/components/scratch/ScratchBuilder.svelte`
- Delete: `src/lib/components/scratch/ScratchCanvas.svelte`
- Delete: `src/lib/components/scratch/SlotRenderer.svelte`
- Delete: `src/lib/blocks/scratch-definitions.ts`
- Delete: `src/lib/blocks/scratch-executor.ts`
- Delete: `tests/components/scratch/ScratchBuilder.test.ts`
- Delete: `tests/components/scratch/PreviewPanel.test.ts`
- Delete: `tests/components/scratch/ScratchCanvas.test.ts`
- Delete: `tests/components/scratch/SlotRenderer.test.ts`
- Delete: `tests/components/scratch/ScratchBlock.test.ts`
- Delete: `tests/components/scratch/BlockPalette.test.ts`
- Delete: `tests/blocks/scratch-executor.test.ts`
- Delete: `tests/stores/scratch-script.test.ts`
- Delete: `tests/types/scratch-blocks.test.ts`

- [ ] **Step 1: Delete all scratch files**

```bash
rm src/lib/types/scratch-blocks.ts
rm src/lib/stores/scratch-script.ts
rm -r src/lib/components/scratch/
rm src/lib/blocks/scratch-definitions.ts
rm src/lib/blocks/scratch-executor.ts
rm -r tests/components/scratch/
rm tests/blocks/scratch-executor.test.ts
rm tests/stores/scratch-script.test.ts
rm tests/types/scratch-blocks.test.ts
```

- [ ] **Step 2: Clean up barrel exports**

In `src/lib/types/index.ts`, remove lines 154-164 (the scratch-blocks re-exports):

Remove:
```ts
// Scratch Blocks
export type {
  ScratchBlock,
  ScratchScript,
  SlotType,
  SlotDefinition,
  BlockDefinition as ScratchBlockDefinition,
  BlockType as ScratchBlockType,
  BlockConfig as ScratchBlockConfig,
} from './scratch-blocks';
export { createBlock, createScript } from './scratch-blocks';
```

- [ ] **Step 3: Check for any remaining scratch imports in route pages**

Search for any remaining imports of scratch components in route files. If found, remove them. The scratch components were never used in production routes (only in their own test files), so this step is verification only.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: Test count drops by ~30+ (scratch tests removed), remaining tests all pass

- [ ] **Step 5: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove scratch block system, keep visual block system as canonical"
```

---

## Final Verification

### Task 17: Full verification pass

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (count will be lower than 867 due to removed plugin-validator and scratch tests)

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error`
Expected: No new errors

- [ ] **Step 3: Verify no `any` types remain in refactored files**

```bash
rg "any" src/lib/storage/db.ts src/lib/storage/world-import.ts src/lib/core/image/generator.ts src/lib/core/agents/agent-runner.ts src/lib/core/agents/character-state-agent.ts src/lib/core/agents/memory-agent.ts src/lib/core/lua/runtime.ts src/lib/core/chat/use-chat-illustration.ts src/lib/repositories/settings-repo.ts
```

Expected: No matches

- [ ] **Step 4: Verify deleted files are gone**

```bash
ls src/lib/plugins/plugin-interface.ts src/lib/plugins/plugin-validator.ts src/lib/types/scratch-blocks.ts src/lib/stores/scratch-script.ts
```

Expected: All files not found

- [ ] **Step 5: Final commit with version bump**

Update `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` version to `0.2.0` (minor bump for refactoring round).

```bash
git add -A
git commit -m "chore: bump version to 0.2.0 for refactoring round"
```
