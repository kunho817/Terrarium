# Follow-Up: Section World, Image Reconnection, Skill Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dormant Section World injection into the agent pipeline for world mode, reconnect image generation to pipeline state via AgentImageContext, and update the terrarium-analyze skill to reflect the new agent pipeline architecture.

**Architecture:** Section World runs after Turn Maintenance in `runBeforeGeneration`, only when `cardType === 'world'` and `worldMode.sectionWorldInjection` is enabled. Image generation reads the persisted session state (already saved by `runAfterGeneration`) to build `AgentImageContext`. The terrarium-analyze skill gets its frozen architecture map and domain table refreshed.

**Tech Stack:** TypeScript, SvelteKit 2, Svelte 5, Vitest 3

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/core/agents/section-world.ts` | Section World runner (LLM call + JSON parse) |
| `tests/core/agents/section-world.test.ts` | Tests for section world runner |

### Modified files
| File | Change |
|------|--------|
| `src/lib/core/agents/types.ts` | Add `SectionWorldOutput` type |
| `src/lib/core/agents/injection.ts` | Add `formatSectionWorldInjection`, `buildAgentImageContext` |
| `src/lib/core/agents/agent-pipeline.ts` | Add section-world step, wire into `runBeforeGeneration` |
| `src/lib/core/agents/index.ts` | Re-export new symbols |
| `src/lib/core/chat/use-chat-illustration.ts` | Load session state, build and pass `AgentImageContext` |
| `tests/core/agents/injection.test.ts` | Tests for new injection formatters |
| `tests/core/agents/agent-pipeline.test.ts` | Tests for section world step in pipeline |
| `.claude/skills/terrarium-analyze/SKILL.md` | Update architecture map, domain table, read guides |

---

### Task 1: Add SectionWorldOutput Type

**Files:**
- Modify: `src/lib/core/agents/types.ts`

- [ ] **Step 1: Add SectionWorldOutput interface to types.ts**

Add after the `TurnMaintenanceOutput` interface (around line 82):

```typescript
export interface SectionWorldOutput {
  sectionTitle: string;
  prompt: string;
  activeRules: string[];
  scenePressures: string[];
}
```

Also add `lastSectionWorld` field to `SessionAgentState`:

```typescript
export interface SessionAgentState {
  sessionId: string;
  lastExtraction: ExtractionSnapshot | null;
  lastTurnMaintenance: TurnMaintenanceOutput | null;
  lastSectionWorld: SectionWorldOutput | null;
  entities: Record<string, EntityRecord>;
  relations: RelationRecord[];
  worldFacts: WorldFactRecord[];
  turnHistory: TurnSnapshot[];
  narrativeState: NarrativeState;
}
```

- [ ] **Step 2: Run typecheck to verify**

Run: `npm run check`
Expected: 0 errors

---

### Task 2: Section World Runner

**Files:**
- Create: `src/lib/core/agents/section-world.ts`
- Test: `tests/core/agents/section-world.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/agents/section-world.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSectionWorld, parseSectionWorldJson } from '$lib/core/agents/section-world';
import type { SessionAgentState } from '$lib/core/agents/types';

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => {
      fn({ modelSlots: {}, agentSettings: { enabled: true, turnMaintenance: { enabled: true }, extraction: { enabled: true }, director: { mode: 'light' } } });
      return vi.fn();
    }),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

function makeState(): SessionAgentState {
  return {
    sessionId: 'sess-1',
    lastExtraction: {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: 'Dark Forest', characters: ['Alice'], atmosphere: 'eerie', timeOfDay: 'night', environmentalNotes: 'fog' },
      characters: {
        Alice: { name: 'Alice', emotion: 'nervous', location: 'forest clearing', inventory: [], health: 'healthy', notes: '' },
      },
      events: ['Entered the forest'],
      newFacts: ['The forest is enchanted'],
      changed: [],
    },
    lastTurnMaintenance: null,
    lastSectionWorld: null,
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 1 },
  };
}

describe('parseSectionWorldJson', () => {
  it('parses valid section world JSON', () => {
    const json = JSON.stringify({
      sectionTitle: 'Enchanted Forest',
      prompt: 'The dark forest hums with ancient magic...',
      activeRules: ['Magic is unstable here', 'Time flows differently'],
      scenePressures: ['Encroaching darkness', 'Unseen watchers'],
    });
    const result = parseSectionWorldJson(json);
    expect(result).not.toBeNull();
    expect(result!.sectionTitle).toBe('Enchanted Forest');
    expect(result!.activeRules).toHaveLength(2);
    expect(result!.scenePressures).toHaveLength(2);
  });

  it('returns null for invalid JSON', () => {
    expect(parseSectionWorldJson('not json')).toBeNull();
    expect(parseSectionWorldJson('{}')).toBeNull();
    expect(parseSectionWorldJson('{"sectionTitle": ""}')).toBeNull();
  });
});

describe('runSectionWorld', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns section world output on success', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      sectionTitle: 'Forest Clearing',
      prompt: 'A moonlit clearing surrounded by ancient oaks.',
      activeRules: ['Spirits wander at night'],
      scenePressures: ['Growing cold'],
    }));

    const result = await runSectionWorld(
      makeState(),
      { providerId: 'openai', apiKey: 'test', model: 'gpt-4' },
    );

    expect(result).not.toBeNull();
    expect(result!.sectionTitle).toBe('Forest Clearing');
    expect(result!.activeRules).toHaveLength(1);
  });

  it('returns null when LLM call fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('timeout'));

    const result = await runSectionWorld(
      makeState(),
      { providerId: 'openai', apiKey: 'test', model: 'gpt-4' },
    );

    expect(result).toBeNull();
  });

  it('returns null when no extraction exists', async () => {
    const state = makeState();
    state.lastExtraction = null;

    const result = await runSectionWorld(
      state,
      { providerId: 'openai', apiKey: 'test', model: 'gpt-4' },
    );

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/agents/section-world.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement section-world.ts**

Create `src/lib/core/agents/section-world.ts`:

```typescript
import { callAgentLLM } from './agent-llm';
import { PROMPTS } from './prompts';
import type { SectionWorldOutput, SessionAgentState } from './types';
import type { UserConfig } from '$lib/types/config';

export function parseSectionWorldJson(content: string): SectionWorldOutput | null {
  if (typeof content !== 'string') return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.sectionTitle !== 'string' || !parsed.sectionTitle) return null;
    if (typeof parsed.prompt !== 'string' || !parsed.prompt) return null;

    return {
      sectionTitle: parsed.sectionTitle,
      prompt: parsed.prompt,
      activeRules: Array.isArray(parsed.activeRules)
        ? parsed.activeRules.filter((r: unknown) => typeof r === 'string')
        : [],
      scenePressures: Array.isArray(parsed.scenePressures)
        ? parsed.scenePressures.filter((p: unknown) => typeof p === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export function buildSectionWorldUserContent(state: SessionAgentState): string {
  const parts: string[] = [];

  if (state.lastExtraction) {
    const ext = state.lastExtraction;
    parts.push('=== Current Scene ===');
    parts.push(`Location: ${ext.scene.location}`);
    parts.push(`Characters Present: ${ext.scene.characters.join(', ')}`);
    parts.push(`Atmosphere: ${ext.scene.atmosphere}`);
    parts.push(`Time: ${ext.scene.timeOfDay}`);
    parts.push(`Environmental Notes: ${ext.scene.environmentalNotes}`);
    if (ext.events.length) parts.push(`Recent Events: ${ext.events.join('; ')}`);
  }

  if (state.narrativeState.currentArc || state.narrativeState.activeTensions.length) {
    parts.push('\n=== Narrative State ===');
    if (state.narrativeState.currentArc) parts.push(`Current Arc: ${state.narrativeState.currentArc}`);
    if (state.narrativeState.activeTensions.length) parts.push(`Active Tensions: ${state.narrativeState.activeTensions.join('; ')}`);
  }

  const entityList = Object.values(state.entities);
  if (entityList.length) {
    parts.push('\n=== Known Entities ===');
    for (const e of entityList) {
      parts.push(`${e.name} (${e.type}): ${e.description}`);
    }
  }

  if (state.worldFacts.length) {
    parts.push('\n=== World Facts ===');
    for (const f of state.worldFacts.slice(0, 10)) {
      parts.push(`- ${f.content}`);
    }
  }

  return parts.join('\n');
}

export async function runSectionWorld(
  state: SessionAgentState,
  chatConfig: Partial<UserConfig>,
): Promise<SectionWorldOutput | null> {
  if (!state.lastExtraction) {
    return null;
  }

  const providerId = chatConfig.providerId || '';
  const apiKey = chatConfig.apiKey || '';
  const model = chatConfig.model || '';

  if (!providerId || !apiKey || !model) {
    console.warn('[SectionWorld] No model configured');
    return null;
  }

  const systemPrompt = PROMPTS.get('SECTION_WORLD_SYSTEM');
  const userContent = buildSectionWorldUserContent(state);

  let rawContent: string;
  try {
    rawContent = await callAgentLLM(systemPrompt, userContent, {
      providerId,
      apiKey,
      model,
      baseUrl: chatConfig.baseUrl,
      temperature: 0.5,
      maxTokens: 1024,
    });
  } catch (err) {
    console.warn('[SectionWorld] LLM call failed:', err);
    return null;
  }

  const result = parseSectionWorldJson(rawContent);

  if (!result) {
    console.warn('[SectionWorld] JSON parse failed');
    try {
      const repairedContent = await callAgentLLM(
        'Repair this JSON. Return only valid JSON with keys: sectionTitle, prompt, activeRules, scenePressures.',
        rawContent,
        {
          providerId,
          apiKey,
          model,
          baseUrl: chatConfig.baseUrl,
          temperature: 0.1,
          maxTokens: 512,
        },
      );
      return parseSectionWorldJson(repairedContent);
    } catch {
      return null;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/agents/section-world.test.ts`
Expected: All tests PASS

---

### Task 3: Injection Formatters (Section World + AgentImageContext)

**Files:**
- Modify: `src/lib/core/agents/injection.ts`
- Modify: `tests/core/agents/injection.test.ts`

- [ ] **Step 1: Write failing tests for formatSectionWorldInjection and buildAgentImageContext**

Add to `tests/core/agents/injection.test.ts`:

```typescript
import { formatSectionWorldInjection, buildAgentImageContext } from '$lib/core/agents/injection';
import type { SectionWorldOutput, SessionAgentState } from '$lib/core/agents/types';
```

Add these test blocks:

```typescript
describe('formatSectionWorldInjection', () => {
  it('formats section world output', () => {
    const sw: SectionWorldOutput = {
      sectionTitle: 'Enchanted Forest',
      prompt: 'The trees whisper ancient secrets.',
      activeRules: ['Magic is unstable'],
      scenePressures: ['Darkness encroaches'],
    };
    const result = formatSectionWorldInjection(sw);
    expect(result).toContain('[Section World: Enchanted Forest]');
    expect(result).toContain('The trees whisper ancient secrets');
    expect(result).toContain('Active Rules');
    expect(result).toContain('Magic is unstable');
    expect(result).toContain('Scene Pressures');
    expect(result).toContain('Darkness encroaches');
  });

  it('omits empty rules and pressures', () => {
    const sw: SectionWorldOutput = {
      sectionTitle: 'Village',
      prompt: 'A quiet village.',
      activeRules: [],
      scenePressures: [],
    };
    const result = formatSectionWorldInjection(sw);
    expect(result).toContain('[Section World: Village]');
    expect(result).not.toContain('Active Rules');
    expect(result).not.toContain('Scene Pressures');
  });
});

describe('buildAgentImageContext', () => {
  it('builds context from session state', () => {
    const state: SessionAgentState = {
      sessionId: 'sess-1',
      lastExtraction: {
        turnNumber: 1,
        timestamp: Date.now(),
        scene: { location: 'Forest', characters: [], atmosphere: 'eerie', timeOfDay: 'night', environmentalNotes: '' },
        characters: {
          Alice: { name: 'Alice', emotion: 'nervous', location: 'Forest', inventory: [], health: 'healthy', notes: '' },
        },
        events: [],
        newFacts: [],
        changed: [],
      },
      lastTurnMaintenance: {
        narrativeBrief: 'Test',
        correction: { shouldCorrect: false, reasons: [] },
        storyAuthor: { currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [], guardrails: [], focusCharacters: [], recentDecisions: [] },
        director: { sceneMandate: 'Build tension', requiredOutcomes: [], forbiddenMoves: [], emphasis: ['shadows'], targetPacing: 'slow', pressureLevel: 'medium', focusCharacters: [] },
      },
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 1 },
    };
    const ctx = buildAgentImageContext(state);
    expect(ctx.sceneLocation).toBe('Forest');
    expect(ctx.sceneTime).toBe('night');
    expect(ctx.sceneMood).toBe('eerie');
    expect(ctx.directorMandate).toBe('Build tension');
    expect(ctx.directorEmphasis).toEqual(['shadows']);
    expect(ctx.characterEmotions).toEqual({ Alice: 'nervous' });
  });

  it('returns empty context when state has no data', () => {
    const state: SessionAgentState = {
      sessionId: 'sess-1',
      lastExtraction: null,
      lastTurnMaintenance: null,
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 0 },
    };
    const ctx = buildAgentImageContext(state);
    expect(ctx.sceneLocation).toBeUndefined();
    expect(ctx.directorMandate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/agents/injection.test.ts`
Expected: FAIL — imports not found

- [ ] **Step 3: Implement formatSectionWorldInjection and buildAgentImageContext**

Add to `src/lib/core/agents/injection.ts`:

At the top, add import:
```typescript
import type { SectionWorldOutput, SessionAgentState } from './types';
import type { AgentImageContext } from '$lib/core/image/generator';
```

Add these functions after `formatMemoryInjection`:

```typescript
export function formatSectionWorldInjection(sw: SectionWorldOutput): string {
  const parts: string[] = [`[Section World: ${sw.sectionTitle}]`];
  parts.push(sw.prompt);
  if (sw.activeRules.length > 0) {
    parts.push(`Active Rules: ${sw.activeRules.join(', ')}`);
  }
  if (sw.scenePressures.length > 0) {
    parts.push(`Scene Pressures: ${sw.scenePressures.join(', ')}`);
  }
  return parts.join('\n');
}

export function buildAgentImageContext(state: SessionAgentState): AgentImageContext {
  const ctx: AgentImageContext = {};

  if (state.lastExtraction) {
    const ext = state.lastExtraction;
    if (ext.scene.location) ctx.sceneLocation = ext.scene.location;
    if (ext.scene.timeOfDay) ctx.sceneTime = ext.scene.timeOfDay;
    if (ext.scene.atmosphere) ctx.sceneMood = ext.scene.atmosphere;

    const emotions: Record<string, string> = {};
    for (const [name, cs] of Object.entries(ext.characters)) {
      if (cs.emotion) emotions[name] = cs.emotion;
    }
    if (Object.keys(emotions).length > 0) ctx.characterEmotions = emotions;
  }

  if (state.lastTurnMaintenance) {
    const tmo = state.lastTurnMaintenance;
    if (tmo.director.sceneMandate) ctx.directorMandate = tmo.director.sceneMandate;
    if (tmo.director.emphasis.length > 0) ctx.directorEmphasis = tmo.director.emphasis;
  }

  return ctx;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/agents/injection.test.ts`
Expected: All tests PASS

---

### Task 4: Wire Section World into Pipeline

**Files:**
- Modify: `src/lib/core/agents/agent-pipeline.ts`
- Modify: `src/lib/core/agents/index.ts`
- Modify: `tests/core/agents/agent-pipeline.test.ts`

- [ ] **Step 1: Write failing test for section world in pipeline**

Add to `tests/core/agents/agent-pipeline.test.ts`:

```typescript
it('runs section world step for world mode', async () => {
  const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
  vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
    narrativeBrief: 'World brief',
    correction: { shouldCorrect: false, reasons: [] },
    storyAuthor: { currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [], guardrails: [], focusCharacters: [], recentDecisions: [] },
    director: { sceneMandate: '', requiredOutcomes: [], forbiddenMoves: [], emphasis: [], targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [] },
  }));
  vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
    sectionTitle: 'Dark Realm',
    prompt: 'Shadows dance across the land.',
    activeRules: ['Dark magic prevails'],
    scenePressures: ['The sun is dying'],
  }));

  const pipeline = new AgentPipeline();
  const ctx = { ...makeContext(), cardType: 'world' as const };
  const result = await pipeline.runBeforeGeneration(ctx);

  expect(result!.injection).toContain('[Section World: Dark Realm]');
  expect(result!.injection).toContain('Shadows dance across the land');
});

it('skips section world for character mode', async () => {
  const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
  vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
    narrativeBrief: 'Brief',
    correction: { shouldCorrect: false, reasons: [] },
    storyAuthor: { currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [], guardrails: [], focusCharacters: [], recentDecisions: [] },
    director: { sceneMandate: '', requiredOutcomes: [], forbiddenMoves: [], emphasis: [], targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [] },
  }));

  const pipeline = new AgentPipeline();
  const ctx = makeContext();
  const result = await pipeline.runBeforeGeneration(ctx);

  expect(result!.injection).not.toContain('[Section World:');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/agents/agent-pipeline.test.ts`
Expected: FAIL — section world injection not present in output

- [ ] **Step 3: Update pipeline to run section world**

In `src/lib/core/agents/agent-pipeline.ts`:

Add import:
```typescript
import { runSectionWorld } from './section-world';
import { formatTurnMaintenanceInjection, formatExtractionInjection, formatReliabilityGuard, formatMemoryInjection, formatSectionWorldInjection } from './injection';
```

Update `getSteps()` to add section-world step:
```typescript
getSteps(): Array<{ id: string; label: string }> {
  return [
    { id: 'memory-retrieval', label: 'Memory' },
    { id: 'turn-maintenance', label: 'Planning' },
    { id: 'section-world', label: 'World' },
    { id: 'generation', label: 'Generating' },
    { id: 'extraction', label: 'Extracting' },
  ];
}
```

In `runBeforeGeneration`, after the turn maintenance block (after `onProgress?.('turn-maintenance', ...)` and before `await saveSessionState(state)`), add:

```typescript
    if (ctx.cardType === 'world') {
      onProgress?.('section-world', 'running');
      const sectionWorld = await runSectionWorld(state, ctx.config);
      if (sectionWorld) {
        state.lastSectionWorld = sectionWorld;
        parts.push(formatSectionWorldInjection(sectionWorld));
        onProgress?.('section-world', 'done');
      } else {
        onProgress?.('section-world', 'skipped');
      }
    } else {
      onProgress?.('section-world', 'skipped');
    }
```

Also update the `ensureState` default to include `lastSectionWorld: null`:
```typescript
this.state = {
  sessionId: ctx.sessionId,
  lastExtraction: null,
  lastTurnMaintenance: null,
  lastSectionWorld: null,
  entities: {},
  relations: [],
  worldFacts: [],
  turnHistory: [],
  narrativeState: {
    currentArc: '',
    activeTensions: [],
    recentDecisions: [],
    nextBeats: [],
    turnNumber: 0,
  },
};
```

- [ ] **Step 4: Update index.ts exports**

In `src/lib/core/agents/index.ts`, add:

```typescript
export { runSectionWorld, parseSectionWorldJson } from './section-world';
export type { SectionWorldOutput } from './types';
export { formatSectionWorldInjection, buildAgentImageContext } from './injection';
```

- [ ] **Step 5: Update session-agent-state storage to handle new field**

In `src/lib/storage/session-agent-state.ts`, check if `loadSessionState` needs to handle the new `lastSectionWorld` field. If it loads from SQL, ensure the JSON column includes it (it should since it serializes the whole state object). If there's a default merge, add `lastSectionWorld: null` as a default.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/core/agents/agent-pipeline.test.ts`
Expected: All tests PASS

---

### Task 5: Reconnect Image Generation to Pipeline State

**Files:**
- Modify: `src/lib/core/chat/use-chat-illustration.ts`
- Modify: `tests/core/agents/injection.test.ts` (already updated in Task 3)

- [ ] **Step 1: Update generateAndInsertIllustrations to use AgentImageContext**

In `src/lib/core/chat/use-chat-illustration.ts`:

Add imports:
```typescript
import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { loadSessionState } from '$lib/storage/session-agent-state';
import { buildAgentImageContext } from '$lib/core/agents/injection';
import { ImageGenerator, resolveArtStyle, type AgentImageContext } from '$lib/core/image/generator';
```

Remove the existing duplicate `get` import from `svelte/store` if present. Remove the existing `ImageGenerator, resolveArtStyle` import and replace with the one above.

Update `generateAndInsertIllustrations` to load session state and build context:

```typescript
export async function generateAndInsertIllustrations(
	assistantMessage: Message,
	config: Record<string, unknown>,
	imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
): Promise<void> {
	try {
		const artStyle = resolveArtStyle(imageConfig.artStylePresetId, customPresets);
		const generator = new ImageGenerator(getRegistry());

		const chatState = get(chatStore);
		const sessionId = chatState.sessionId;
		let agentContext: AgentImageContext | undefined;
		if (sessionId) {
			try {
				const sessionState = await loadSessionState(sessionId as any);
				if (sessionState) {
					agentContext = buildAgentImageContext(sessionState);
				}
			} catch {
			}
		}

		const plannerContent = assistantMessage.content;

		const plans = await generator.planIllustrations(plannerContent, config as UserConfig);
		if (plans.length === 0) return;

		const results = new Map<number, { dataUrl: string; prompt: string }>();

		for (const plan of plans) {
			try {
				const imgResult = await generator.generateIllustration(plan.prompt, imageConfig, artStyle);
				if (imgResult) {
					results.set(plan.afterParagraph, imgResult);
				}
			} catch (e) {
				console.error(`[Illust] Image generation failed for paragraph ${plan.afterParagraph}:`, e);
			}
		}

		if (results.size === 0) return;

		const segments = generator.buildSegments(assistantMessage.content, plans, results);
		assistantMessage.segments = segments;
		assistantMessage.revision = (assistantMessage.revision ?? 0) + 1;

		chatStore.updateLastMessage(assistantMessage);
		await chatRepo.saveMessages();
	} catch (e) {
		console.error('[Illust] Illustration planning failed:', e);
	}
}
```

Note: The `AgentImageContext` is now built and available, but `planIllustrations` and `generateIllustration` don't currently accept it. The context was already used in `generateImagePrompt()` via `this.agentContext`. To actually USE it, we need to call `generator.generateForChat()` which DOES accept it, OR set `generator.agentContext = agentContext` before calling. Since the current flow uses `planIllustrations` + `generateIllustration` (separate calls), the simplest approach is to set it on the generator instance before planning:

After creating the generator, add:
```typescript
		generator.agentContext = agentContext;
```

This makes `this.agentContext` available in `generateImagePrompt()`, which is called when generating prompts. However, `planIllustrations` doesn't use `generateImagePrompt`. The context is most valuable for `generateForChat`. For the illustration flow, the context enriches the prompt when generating images.

Actually, looking at the code flow more carefully: `planIllustrations` determines WHERE to place images. Then `generateIllustration` generates the actual image from the plan's prompt. The plan prompts are tag-style (e.g., "1girl, forest, golden sunlight"). The agent context would be most useful for enriching these prompts.

The cleanest integration: set `generator.agentContext = agentContext` before calling `generateForChat` or use it in the planning step. Since the current flow uses `planIllustrations` + `generateIllustration` (not `generateForChat`), and the agent context is already used in `generateImagePrompt` (which `generateForChat` calls), we should either:

1. Just set `generator.agentContext = agentContext` — it will be available for `generateImagePrompt` if someone uses `generateForChat` later
2. Enrich the plan prompts with agent context info

Option 1 is minimal and correct. The agent context will be used when `generateForChat` is called (which is the correct entry point for context-aware generation). The current `planIllustrations` + `generateIllustration` flow is simpler and doesn't need agent context for tag-style prompts.

So the implementation is: just build the context, set it on the generator. This makes it available without changing the existing flow.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors

---

### Task 6: Update Terrarium-Analyze Skill

**Files:**
- Modify: `.claude/skills/terrarium-analyze/SKILL.md`

- [ ] **Step 1: Add agents to architecture map**

In the architecture map under `src/lib/core/`, add between `chat/` and `image/`:

```
│   ├── agents/              # Agent pipeline (LIBRA-inspired)
│   │   ├── agent-pipeline.ts   # Pipeline orchestrator
│   │   ├── agent-llm.ts        # Shared LLM call utility
│   │   ├── extraction.ts       # Memory extraction phase
│   │   ├── turn-maintenance.ts # Turn maintenance phase
│   │   ├── section-world.ts    # Section World Composer (world mode)
│   │   ├── injection.ts        # Injection formatting utilities
│   │   ├── prompts.ts          # Centralized prompt registry
│   │   ├── types.ts            # Pipeline type definitions
│   │   └── index.ts            # Re-exports
│   │
```

Also add to `storage/`:
```
│   ├── session-agent-state.ts  # Agent session state persistence
```

And to `stores/`:
```
│   ├── agent-progress.ts       # Agent pipeline progress tracking
```

- [ ] **Step 2: Add Agent Pipeline domain to classification table**

Add a new row:

| Agent Pipeline | `core/agents/agent-pipeline.ts`, `core/agents/extraction.ts`, `core/agents/turn-maintenance.ts`, `core/agents/section-world.ts`, `core/agents/injection.ts` | `components/AgentPipelineIndicator.svelte`, `routes/settings/agents/+page.svelte` | `storage/session-agent-state.ts` | `tests/core/agents/` |

- [ ] **Step 3: Add Agent Pipeline to Domain Read Guides table**

Add a new row:

| Agent Pipeline | `src/lib/core/agents/agent-pipeline.ts`, `src/lib/core/agents/types.ts`, `src/lib/core/agents/extraction.ts`, `src/lib/core/agents/turn-maintenance.ts`, `src/lib/core/agents/prompts.ts` |

- [ ] **Step 4: Verify skill file is valid YAML frontmatter + markdown**

Read back the file and confirm no formatting issues.

---

### Task 7: Final Verification

- [ ] **Step 1: Run full type check**

Run: `npm run check`
Expected: 0 errors, 0 warnings

- [ ] **Step 2: Run full test suite**

Run: `npm run test`
Expected: All tests pass (should be ~750+ tests)

- [ ] **Step 3: Commit all changes**

```bash
git add -A
git commit -m "feat: wire section world injection, reconnect image generation, update skill"
```
