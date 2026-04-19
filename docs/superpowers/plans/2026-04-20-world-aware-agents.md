# World Chat Improvements — Sub-Project 4: World-Aware Agents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the scene agent for multi-character tracking, add fact/event memory classification, and create a narrative consistency agent.

**Architecture:** Three changes to the agent layer: (1) SceneStateAgent gets world-aware character tracking that populates `CharacterState` in SQLite when `trackState: true` characters are detected, (2) MemoryAgent's extraction prompt adds world_fact/personal_event/general classification, with the MemoryType updated, (3) A new NarrativeConsistencyAgent runs between scene-state and director to check for contradictions.

**Tech Stack:** TypeScript, Vitest, existing agent infrastructure.

**Spec:** `docs/superpowers/specs/2026-04-20-world-chat-improvements-design.md` (Section 4)

---

## File Structure

### New files
- `src/lib/core/agents/narrative-consistency-agent.ts` — new agent
- `tests/agents/narrative-consistency-agent.test.ts` — tests

### Modified files
- `src/lib/types/memory.ts` — add 'world_fact', 'personal_event', 'general' to MemoryType
- `src/lib/core/agents/scene-state-agent.ts` — add world character tracking
- `src/lib/core/agents/memory-agent.ts` — update extraction prompt for new types
- `src/lib/core/agents/agent-runner.ts` — register narrative-consistency agent

---

### Task 1: Update MemoryType for Fact/Event Classification

**Files:**
- Modify: `src/lib/types/memory.ts`
- Modify: `tests/core/lua/runtime.test.ts` or any test that imports MemoryType

- [ ] **Step 1: Update MemoryType**

In `src/lib/types/memory.ts`, change:

```typescript
export type MemoryType = 'event' | 'trait' | 'relationship' | 'location' | 'state' | 'world_fact' | 'personal_event' | 'general';
```

Add the new types to `MEMORY_WRITE_MODES`:

```typescript
export const MEMORY_WRITE_MODES: Record<MemoryType, WriteMode> = {
  event: 'append',
  trait: 'overwrite',
  relationship: 'overwrite',
  location: 'overwrite',
  state: 'overwrite',
  world_fact: 'overwrite',
  personal_event: 'append',
  general: 'append',
};
```

- [ ] **Step 2: Update DEFAULT_EXTRACTION_PROMPT**

In the same file, update the extraction prompt to include the new types. Change the type description from:

```
- type: One of "event" (things that happened), "trait" (character qualities), "relationship" (how characters relate), "location" (place knowledge), "state" (current situation)
```

to:

```
- type: One of "event" (things that happened), "trait" (character qualities), "relationship" (how characters relate), "location" (place knowledge), "state" (current situation), "world_fact" (permanent world knowledge like "the capital is in the north"), "personal_event" (events involving the user like "user helped Alice"), "general" (anything else)
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass (new types are additive, existing code uses the old types)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/memory.ts
git commit -m "feat: add world_fact, personal_event, general to MemoryType"
```

---

### Task 2: Update SceneStateAgent for World Character Tracking

**Files:**
- Modify: `src/lib/core/agents/scene-state-agent.ts`

- [ ] **Step 1: Add world character tracking to onAfterReceive**

The scene state agent already extracts `characters: string[]` from the AI response. When running in a world chat context, it should also update `CharacterState` for characters that have `trackState: true`.

Add imports:
```typescript
import { updateCharacterState } from '$lib/storage/agent-states';
```

In `onAfterReceive`, after `await updateSceneState(ctx.sessionId, mapped)`, add world character tracking:

```typescript
		if (ctx.cardType === 'world' && extraction.characters.length > 0) {
			for (const charName of extraction.characters) {
				try {
					await updateCharacterState(ctx.sessionId, charName, {
						location: extraction.location,
						emotion: extraction.atmosphere,
					});
				} catch {
					// Non-blocking
				}
			}
		}
```

- [ ] **Step 2: Verify tests pass**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/core/agents/scene-state-agent.ts
git commit -m "feat: scene agent updates CharacterState for world chat characters"
```

---

### Task 3: Create NarrativeConsistencyAgent

**Files:**
- Create: `src/lib/core/agents/narrative-consistency-agent.ts`
- Create: `tests/agents/narrative-consistency-agent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agents/narrative-consistency-agent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NarrativeConsistencyAgent, buildConsistencyPrompt } from '$lib/core/agents/narrative-consistency-agent';

describe('NarrativeConsistencyAgent', () => {
	const agent = new NarrativeConsistencyAgent();

	it('has correct id and priority', () => {
		expect(agent.id).toBe('narrative-consistency');
		expect(agent.priority).toBe(15);
	});

	it('returns empty result for non-world chats', async () => {
		const result = await agent.onBeforeSend({
			sessionId: 'test' as any,
			cardId: 'test' as any,
			cardType: 'character',
			messages: [],
			scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
			turnNumber: 1,
			config: {} as any,
		});
		expect(result.injectPrompt).toBeUndefined();
	});
});

describe('buildConsistencyPrompt', () => {
	it('returns undefined when no scene or memories', () => {
		const result = buildConsistencyPrompt(
			{ location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
			[],
		);
		expect(result).toBeUndefined();
	});

	it('builds prompt from scene and memories', () => {
		const result = buildConsistencyPrompt(
			{ location: 'Tavern', time: 'evening', mood: 'cheerful', participatingCharacters: ['Alice', 'Bob'], variables: {}, environmentalNotes: '', lastUpdated: 0 },
			[
				{ content: 'Alice is in the forest', type: 'world_fact' },
				{ content: 'Bob hates alcohol', type: 'trait' },
			],
		);
		expect(result).toContain('Tavern');
		expect(result).toContain('Alice');
		expect(result).toContain('forest');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agents/narrative-consistency-agent.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement NarrativeConsistencyAgent**

Create `src/lib/core/agents/narrative-consistency-agent.ts`:

```typescript
import { getSceneState } from '$lib/storage/agent-states';
import { getMemoriesForSession } from '$lib/storage/memories';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { SceneState, MemoryRecord } from '$lib/types';

export function buildConsistencyPrompt(
	scene: SceneState,
	memories: Pick<MemoryRecord, 'content' | 'type'>[],
): string | undefined {
	const hasScene = scene.location || scene.participatingCharacters.length > 0;
	const hasMemories = memories.length > 0;

	if (!hasScene && !hasMemories) return undefined;

	const lines: string[] = ['[Consistency Check]'];
	lines.push('Verify the AI response is consistent with established facts:');

	if (scene.location) {
		lines.push(`Current location: ${scene.location}`);
	}
	if (scene.participatingCharacters.length > 0) {
		lines.push(`Characters present: ${scene.participatingCharacters.join(', ')}`);
	}
	if (scene.time) {
		lines.push(`Time: ${scene.time}`);
	}

	if (memories.length > 0) {
		lines.push('Established facts:');
		for (const mem of memories.slice(0, 10)) {
			lines.push(`- ${mem.content} (${mem.type})`);
		}
	}

	return lines.join('\n');
}

export class NarrativeConsistencyAgent implements Agent {
	readonly id = 'narrative-consistency';
	readonly name = 'Narrative Consistency Agent';
	readonly priority = 15;

	async init(_ctx: AgentContext): Promise<void> {}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		if (ctx.cardType !== 'world') return {};

		const scene = await getSceneState(ctx.sessionId);
		if (!scene) return {};

		let memories: Pick<MemoryRecord, 'content' | 'type'>[] = [];
		try {
			const allMemories = await getMemoriesForSession(ctx.sessionId);
			memories = allMemories
				.filter((m) => m.type === 'world_fact' || m.type === 'trait' || m.type === 'location')
				.slice(0, 10);
		} catch {
			// Non-blocking
		}

		const injectPrompt = buildConsistencyPrompt(scene, memories);
		if (!injectPrompt) return {};

		return { injectPrompt };
	}

	async onAfterReceive(_ctx: AgentContext, _response: string): Promise<AgentResult> {
		return {};
	}

	async shutdown(): Promise<void> {}
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/agents/narrative-consistency-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/narrative-consistency-agent.ts tests/agents/narrative-consistency-agent.test.ts
git commit -m "feat: add NarrativeConsistencyAgent for world chat fact checking"
```

---

### Task 4: Register NarrativeConsistencyAgent in AgentRunner

**Files:**
- Modify: `src/lib/core/agents/agent-runner.ts`

- [ ] **Step 1: Read current agent-runner.ts**

Read the file to find where agents are registered (likely a constructor or `getAgentsByPriority` method).

- [ ] **Step 2: Add import and register**

Add import:
```typescript
import { NarrativeConsistencyAgent } from './narrative-consistency-agent';
```

Find where agents are registered/listed. Add `NarrativeConsistencyAgent` to the list. It should run at priority 15 (between scene-state at 10 and director at 20).

If agents are instantiated in a list/array, add:
```typescript
new NarrativeConsistencyAgent(),
```

- [ ] **Step 3: Verify tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/agents/agent-runner.ts
git commit -m "feat: register NarrativeConsistencyAgent in agent pipeline"
```

---

### Task 5: Full Test Suite and Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 2: Verify svelte-check**

Run: `npx svelte-check --threshold error`
Expected: No new errors

- [ ] **Step 3: Final cleanup if needed**

```bash
git add -A
git commit -m "chore: cleanup after world-aware agents implementation"
```
