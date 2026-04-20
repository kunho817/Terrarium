# Agent → Image Generation Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thread agent outputs (director guidance, fresh scene state) into image prompt generation for contextually appropriate images.

**Architecture:** Add `AgentImageContext` type. Build it from `onBeforeSend` results in `engine.send()`. Thread through `streamAndFinalize()` → `generateAndInsertIllustrations()` → `generateImagePrompt()`. Also read fresh scene state from `sceneStore` (already updated by agents by the time image generation runs).

**Tech Stack:** TypeScript, SvelteKit, Vitest

**Test command:** `npx vitest run` (784 tests must pass after every task)

---

### Task 1: Add AgentImageContext type and update ImageGenContext

**Files:**
- Modify: `src/lib/core/image/generator.ts`

- [ ] **Step 1: Add AgentImageContext interface**

In `src/lib/core/image/generator.ts`, add this interface after the `ImageGenContext` interface (after line 34):

```ts
export interface AgentImageContext {
	sceneLocation?: string;
	sceneTime?: string;
	sceneMood?: string;
	directorMandate?: string;
	directorEmphasis?: string[];
}
```

- [ ] **Step 2: Add agentContext to ImageGenContext**

Add `agentContext?: AgentImageContext;` to the `ImageGenContext` interface:

```ts
export interface ImageGenContext {
  messages: Message[];
  artStyle: ArtStylePreset;
  imageConfig: ImageGenerationConfig;
  config: UserConfig;
  cardDescription?: string;
  cardName?: string;
  scene?: SceneState;
  personaName?: string;
  agentContext?: AgentImageContext;
}
```

- [ ] **Step 3: Update generateImagePrompt to use agent context**

In the `generateImagePrompt()` method, after the persona name block (after line `if (this.personaName) { ... }`), add:

```ts
    if (this.agentContext) {
      if (this.agentContext.directorMandate) {
        contextParts.push(`Director Scene Mandate: ${this.agentContext.directorMandate}`);
      }
      if (this.agentContext.directorEmphasis?.length) {
        contextParts.push(`Director Emphasis: ${this.agentContext.directorEmphasis.join(', ')}`);
      }
    }
```

Also update `generateForChat()` to capture the agent context from `ctx`. After line `this.personaName = ctx.personaName;` (line 135), add:

```ts
    this.agentContext = ctx.agentContext;
```

And add the field to the class (after `personaName?: string;` on line 40):

```ts
  agentContext?: AgentImageContext;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: 784 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/image/generator.ts
git commit -m "feat: add AgentImageContext type and use in image prompt generation"
```

---

### Task 2: Build AgentImageContext in engine and add to SendResult

**Files:**
- Modify: `src/lib/core/chat/engine.ts`

- [ ] **Step 1: Import AgentImageContext**

Add to the imports at the top of `engine.ts`:

```ts
import type { AgentImageContext } from '../image/generator';
```

- [ ] **Step 2: Add agentContext to SendResult**

Change the `SendResult` interface from:

```ts
export interface SendResult {
  userMessage: Message;
  stream: AsyncGenerator<string>;
  onComplete: Promise<Message>;
  abort: () => void;
}
```

To:

```ts
export interface SendResult {
  userMessage: Message;
  stream: AsyncGenerator<string>;
  onComplete: Promise<Message>;
  abort: () => void;
  agentContext?: AgentImageContext;
}
```

- [ ] **Step 3: Build AgentImageContext from agent results**

After the `agentRunner.onBeforeSend()` call (after line 234 where `agentResult.injectPrompt` is used), add:

```ts
    const agentImgContext: AgentImageContext = {};
    if (agentResult.updatedState?.scene) {
      const s = agentResult.updatedState.scene;
      agentImgContext.sceneLocation = s.location;
      agentImgContext.sceneTime = s.time;
      agentImgContext.sceneMood = s.mood;
    }
    if (agentResult.updatedState?.directorGuidance) {
      const dg = agentResult.updatedState.directorGuidance;
      agentImgContext.directorMandate = dg.sceneMandate;
      agentImgContext.directorEmphasis = dg.emphasis;
    }
```

Note: `directorGuidance` is a `DirectorGuidance` type from `$lib/types/agent-state`. Check that `updatedState` on `AgentResult` allows this. Looking at `types/agent-state.ts`, `StateUpdate` has `scene` and potentially `directorGuidance`. Check the actual type — if `StateUpdate` doesn't have `directorGuidance`, it may need to be added, or the Director Agent's `updatedState` may use a different path.

Actually, looking at `director-agent.ts:144-147`:
```ts
return {
  injectPrompt: formatDirectorPrompt(guidance),
  updatedState: { directorGuidance: guidance }
};
```

And `StateUpdate` in `types/agent-state.ts` needs to be checked. Read the file and add `directorGuidance` if not present.

- [ ] **Step 4: Add agentContext to the return value**

Change the return statement at the end of `send()` (around line 377) from:

```ts
    return {
      userMessage,
      stream: tokenStream(),
      abort: () => {
        self.aborted = true;
        resetPipeline();
      },
      onComplete,
    };
```

To:

```ts
    return {
      userMessage,
      stream: tokenStream(),
      abort: () => {
        self.aborted = true;
        resetPipeline();
      },
      onComplete,
      agentContext: Object.keys(agentImgContext).length > 0 ? agentImgContext : undefined,
    };
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: 784 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/chat/engine.ts
git commit -m "feat: build AgentImageContext in engine and add to SendResult"
```

---

### Task 3: Thread AgentImageContext through streamAndFinalize

**Files:**
- Modify: `src/lib/core/chat/use-chat-streaming.ts`
- Modify: `src/lib/core/chat/use-chat.ts`
- Modify: `src/lib/core/chat/use-chat-illustration.ts`

- [ ] **Step 1: Update streamAndFinalize signature**

In `src/lib/core/chat/use-chat-streaming.ts`, add the `agentContext` parameter:

```ts
export async function streamAndFinalize(
	stream: AsyncGenerator<string, void, unknown>,
	onComplete: Promise<Message>,
	config: Record<string, unknown>,
	imageConfig: import('$lib/types/image-config').ImageGenerationConfig | undefined,
	imageAutoGenerate: boolean,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
	agentContext?: import('$lib/core/image/generator').AgentImageContext,
): Promise<void> {
```

And update the call to `generateAndInsertIllustrations` at the bottom:

```ts
	if (imageAutoGenerate && assistantMessage.content.length > 0 && imageConfig) {
		generateAndInsertIllustrations(assistantMessage, config, imageConfig, customPresets, agentContext);
	}
```

- [ ] **Step 2: Update use-chat.ts callers**

In `src/lib/core/chat/use-chat.ts`, update both `sendMessage` and `rerollFromMessage` to pass `agentContext`:

In `sendMessage`, change:
```ts
	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
```
To:
```ts
	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets, result.agentContext);
```

In `rerollFromMessage`, same change:
```ts
	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets, result.agentContext);
```

- [ ] **Step 3: Update generateAndInsertIllustrations signature**

In `src/lib/core/chat/use-chat-illustration.ts`, add the parameter and pass it to `ImageGenContext`:

Change the function signature from:
```ts
export async function generateAndInsertIllustrations(
	assistantMessage: Message,
	config: Record<string, unknown>,
	imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
): Promise<void> {
```
To:
```ts
export async function generateAndInsertIllustrations(
	assistantMessage: Message,
	config: Record<string, unknown>,
	imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
	agentContext?: import('$lib/core/image/generator').AgentImageContext,
): Promise<void> {
```

And update the `ImageGenerator.generateForChat` call to pass `agentContext`. Find where the `ImageGenContext` object is built (it's not explicit — `generateForChat` takes `ctx: ImageGenContext`). Look at how the fields are set before the call. Add `agentContext` to the context.

Actually, looking at the code, `generateAndInsertIllustrations` doesn't call `generateForChat` — it calls `planIllustrations` then `generateIllustration` separately. The agent context affects the image PROMPT, which is used in `generateForChat` for chat-based generation. But `generateAndInsertIllustrations` uses the planner approach.

The agent context should influence the planner. Update the `planIllustrations` call to include agent context in the system prompt or conversation. 

Actually, looking more carefully: the planner decides WHERE to insert images. The actual image prompt is built from the plan's `prompt` field. The agent context should influence the planner so it generates better prompts.

The simplest approach: pass `agentContext` into the planner's conversation as additional context about the scene. Modify the `PLAN_SYSTEM_PROMPT` or add context to the user message sent to the planner.

Update `generateAndInsertIllustrations` — instead of building a full `ImageGenContext`, just add agent context info to the planner. After `const generator = new ImageGenerator(getRegistry());`, before calling `planIllustrations`, modify the approach:

Actually, looking at the code flow again:
1. `planIllustrations(assistantMessage.content, config)` — LLM decides image placements
2. For each plan, `generateIllustration(plan.prompt, imageConfig, artStyle)` — generates image from the plan's prompt

The plan's prompt is generated by the LLM planner. The agent context should help the planner write better prompts. The cleanest way: pass `agentContext` into `planIllustrations` so it can include scene context in the planning request.

But that would change the `planIllustrations` signature. Let me take a simpler approach:

Just inject agent context into the assistant message content that gets passed to the planner. Build a context prefix:

```ts
	let plannerContent = assistantMessage.content;
	if (agentContext) {
		const contextLines: string[] = [];
		if (agentContext.directorMandate) {
			contextLines.push(`Director emphasis: ${agentContext.directorMandate}`);
		}
		if (agentContext.directorEmphasis?.length) {
			contextLines.push(`Focus areas: ${agentContext.directorEmphasis.join(', ')}`);
		}
		if (agentContext.sceneLocation) {
			contextLines.push(`Scene: ${agentContext.sceneLocation}, ${agentContext.sceneMood || ''} ${agentContext.sceneTime || ''}`.trim());
		}
		if (contextLines.length) {
			plannerContent = `[Scene Context: ${contextLines.join('; ')}]\n\n${plannerContent}`;
		}
	}
```

Then call `planIllustrations(plannerContent, config)` instead of `planIllustrations(assistantMessage.content, config)`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: 784 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/use-chat-streaming.ts src/lib/core/chat/use-chat.ts src/lib/core/chat/use-chat-illustration.ts
git commit -m "feat: thread AgentImageContext through pipeline to image generation"
```

---

### Task 4: Ensure StateUpdate supports directorGuidance

**Files:**
- Modify: `src/lib/types/agent-state.ts`

- [ ] **Step 1: Check and update StateUpdate type**

Read `src/lib/types/agent-state.ts`. If `StateUpdate` doesn't already have `directorGuidance`, add it:

```ts
export interface StateUpdate {
  scene?: SceneState;
  directorGuidance?: DirectorGuidance;
}
```

If `DirectorGuidance` isn't imported, add the import.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: 784 tests pass

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add src/lib/types/agent-state.ts
git commit -m "feat: add directorGuidance to StateUpdate for agent→image integration"
```

If no changes were needed, skip this commit.

---

## Final Verification

### Task 5: Verify integration works end-to-end

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify typecheck**

Run: `npx svelte-check --threshold error`
Expected: No new errors

- [ ] **Step 3: Commit and version bump**

```bash
git add -A
git commit -m "chore: bump version to 0.2.1 for agent→image integration"
```
