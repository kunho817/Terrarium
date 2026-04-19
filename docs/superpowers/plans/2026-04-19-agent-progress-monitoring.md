# Agent Progress Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal floating indicator that shows real-time agent pipeline status (pending/running/done/failed) during message generation, plus an LLM generation phase, auto-hiding when complete.

**Architecture:** A Svelte writable store tracks pipeline state. AgentRunner accepts an optional progress callback. The engine wires callbacks to the store. A floating Svelte component subscribes to the store and renders a status pill.

**Tech Stack:** Svelte 5 (runes + stores), TypeScript, Vitest

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/stores/agent-progress.ts` | **New** — pipeline state store (start/update/reset) |
| `src/lib/types/agent.ts` | Add `ProgressCallback` type export |
| `src/lib/core/agents/agent-runner.ts` | Accept `onProgress` callback in `onBeforeSend`, emit per-agent status |
| `src/lib/core/chat/engine.ts` | Wire pipeline start/update/reset around agent + LLM phases |
| `src/lib/components/AgentPipelineIndicator.svelte` | **New** — floating pill UI component |
| `src/routes/chat/[id]/+page.svelte` | Mount indicator in chat area |
| `tests/stores/agent-progress.test.ts` | **New** — store unit tests |
| `tests/agents/agent-runner-progress.test.ts` | **New** — progress callback tests |

---

### Task 1: Pipeline State Store + Tests

**Files:**
- Create: `src/lib/stores/agent-progress.ts`
- Create: `tests/stores/agent-progress.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/stores/agent-progress.test.ts
import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  agentProgress,
  startPipeline,
  updateStep,
  resetPipeline,
} from '$lib/stores/agent-progress';

describe('agent-progress store', () => {
  it('starts with inactive empty state', () => {
    const state = get(agentProgress);
    expect(state.active).toBe(false);
    expect(state.steps).toEqual([]);
  });

  it('startPipeline initializes steps as pending', () => {
    startPipeline([
      { id: 'memory', label: 'Memory' },
      { id: 'director', label: 'Director' },
      { id: 'llm-generation', label: 'Generating' },
    ]);
    const state = get(agentProgress);
    expect(state.active).toBe(true);
    expect(state.steps).toEqual([
      { agentId: 'memory', label: 'Memory', status: 'pending' },
      { agentId: 'director', label: 'Director', status: 'pending' },
      { agentId: 'llm-generation', label: 'Generating', status: 'pending' },
    ]);
    expect(state.startedAt).toBeGreaterThan(0);
    resetPipeline();
  });

  it('updateStep changes a single step status', () => {
    startPipeline([
      { id: 'memory', label: 'Memory' },
      { id: 'director', label: 'Director' },
    ]);
    updateStep('memory', 'running');
    const state = get(agentProgress);
    expect(state.steps[0].status).toBe('running');
    expect(state.steps[1].status).toBe('pending');
    resetPipeline();
  });

  it('updateStep does nothing for unknown agentId', () => {
    startPipeline([{ id: 'memory', label: 'Memory' }]);
    updateStep('nonexistent', 'running');
    const state = get(agentProgress);
    expect(state.steps[0].status).toBe('pending');
    resetPipeline();
  });

  it('resetPipeline clears state', () => {
    startPipeline([{ id: 'memory', label: 'Memory' }]);
    updateStep('memory', 'done');
    resetPipeline();
    const state = get(agentProgress);
    expect(state.active).toBe(false);
    expect(state.steps).toEqual([]);
    expect(state.startedAt).toBe(0);
  });

  it('multiple updates work in sequence', () => {
    startPipeline([
      { id: 'memory', label: 'Memory' },
      { id: 'director', label: 'Director' },
    ]);
    updateStep('memory', 'running');
    updateStep('memory', 'done');
    updateStep('director', 'running');
    updateStep('director', 'failed');
    const state = get(agentProgress);
    expect(state.steps[0].status).toBe('done');
    expect(state.steps[1].status).toBe('failed');
    resetPipeline();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stores/agent-progress.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the store implementation**

```typescript
// src/lib/stores/agent-progress.ts
import { writable, get } from 'svelte/store';

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PipelineStep {
  agentId: string;
  label: string;
  status: PipelineStepStatus;
}

export interface PipelineState {
  active: boolean;
  steps: PipelineStep[];
  startedAt: number;
}

const INITIAL: PipelineState = { active: false, steps: [], startedAt: 0 };

export const agentProgress = writable<PipelineState>(INITIAL);

export function startPipeline(agents: { id: string; label: string }[]): void {
  agentProgress.set({
    active: true,
    steps: agents.map((a) => ({ agentId: a.id, label: a.label, status: 'pending' as PipelineStepStatus })),
    startedAt: Date.now(),
  });
}

export function updateStep(agentId: string, status: PipelineStepStatus): void {
  agentProgress.update((state) => ({
    ...state,
    steps: state.steps.map((s) =>
      s.agentId === agentId ? { ...s, status } : s
    ),
  }));
}

export function resetPipeline(): void {
  agentProgress.set(INITIAL);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/stores/agent-progress.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/agent-progress.ts tests/stores/agent-progress.test.ts
git commit -m "feat: add agent pipeline progress store"
```

---

### Task 2: Progress Callback Type + AgentRunner Integration

**Files:**
- Modify: `src/lib/types/agent.ts`
- Modify: `src/lib/core/agents/agent-runner.ts`
- Create: `tests/agents/agent-runner-progress.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/agents/agent-runner-progress.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { AgentContext, ProgressCallback } from '$lib/types/agent';
import type { Agent, AgentResult } from '$lib/types/agent';
import { makeSessionId, makeCharacterId } from '$lib/types/branded';

function mockCtx(): AgentContext {
  return {
    sessionId: makeSessionId('test'),
    cardId: makeCharacterId('test'),
    cardType: 'character',
    messages: [],
    scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {}, environmentalNotes: '', lastUpdated: 0 },
    turnNumber: 1,
    config: { providerId: 'test', model: 'test' } as any,
  };
}

function stubAgent(id: string, priority: number): Agent {
  return {
    id,
    name: id,
    priority,
    init: vi.fn(),
    onBeforeSend: vi.fn().mockResolvedValue({}),
    onAfterReceive: vi.fn().mockResolvedValue({}),
    shutdown: vi.fn(),
  };
}

describe('AgentRunner progress callback', () => {
  it('calls onProgress with running then done for each agent', async () => {
    const runner = new AgentRunner();
    const agentA = stubAgent('agent-a', 1);
    const agentB = stubAgent('agent-b', 2);
    runner.registerAgent(agentA);
    runner.registerAgent(agentB);

    const calls: Array<{ id: string; status: string }> = [];
    const onProgress: ProgressCallback = (agentId, status) => {
      calls.push({ id: agentId, status });
    };

    await runner.onBeforeSend(mockCtx(), onProgress);

    expect(calls).toEqual([
      { id: 'agent-a', status: 'running' },
      { id: 'agent-a', status: 'done' },
      { id: 'agent-b', status: 'running' },
      { id: 'agent-b', status: 'done' },
    ]);
  });

  it('reports failed when an agent throws', async () => {
    const runner = new AgentRunner();
    const failingAgent: Agent = {
      id: 'fail-agent',
      name: 'Fail',
      priority: 1,
      init: vi.fn(),
      onBeforeSend: vi.fn().mockRejectedValue(new Error('boom')),
      onAfterReceive: vi.fn(),
      shutdown: vi.fn(),
    };
    runner.registerAgent(failingAgent);

    const calls: Array<{ id: string; status: string }> = [];
    const onProgress: ProgressCallback = (agentId, status) => {
      calls.push({ id: agentId, status });
    };

    await runner.onBeforeSend(mockCtx(), onProgress);

    expect(calls).toEqual([
      { id: 'fail-agent', status: 'running' },
      { id: 'fail-agent', status: 'failed' },
    ]);
  });

  it('works without onProgress (backward compatible)', async () => {
    const runner = new AgentRunner();
    const agent = stubAgent('test', 1);
    runner.registerAgent(agent);

    const result = await runner.onBeforeSend(mockCtx());
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/agents/agent-runner-progress.test.ts`
Expected: FAIL — `ProgressCallback` not exported, `onBeforeSend` doesn't accept second arg

- [ ] **Step 3: Add ProgressCallback type to agent types**

Add to `src/lib/types/agent.ts`, after the `AgentResult` interface:

```typescript
export type ProgressCallback = (agentId: string, status: 'running' | 'done' | 'failed') => void;
```

In `src/lib/types/index.ts`, add `ProgressCallback` to the agent re-exports section (find the line with `AgentResult,` and add `ProgressCallback` alongside).

- [ ] **Step 4: Modify AgentRunner.onBeforeSend to accept and use callback**

Replace the `onBeforeSend` method in `src/lib/core/agents/agent-runner.ts` with:

```typescript
	async onBeforeSend(ctx: AgentContext, onProgress?: import('$lib/types/agent').ProgressCallback): Promise<AgentResult> {
		const combined: AgentResult = {};
		const outputs: import('$lib/types/agent').AgentOutputs = {};
		const injectParts: string[] = [];

		for (const agent of this.getAgentsByPriority()) {
			onProgress?.(agent.id, 'running');
			try {
				const result = await agent.onBeforeSend(ctx);
				onProgress?.(agent.id, 'done');
				if (result.injectPrompt) {
					injectParts.push(result.injectPrompt);
					switch (agent.id) {
						case 'memory':
							outputs.memory = result.injectPrompt;
							break;
						case 'director':
							outputs.director = result.injectPrompt;
							break;
						case 'scene-state':
							outputs.sceneState = result.injectPrompt;
							break;
						case 'character-state':
							outputs.characterState = result.injectPrompt;
							break;
					}
				}
				if (result.updatedState) {
					combined.updatedState = {
						...combined.updatedState,
						...result.updatedState
					};
				}
			} catch {
				onProgress?.(agent.id, 'failed');
				console.warn(`[AgentRunner] Agent ${agent.id} onBeforeSend failed`);
			}
		}

		if (injectParts.length) {
			combined.injectPrompt = injectParts.join('\n\n');
		}

		const hasOutputs = outputs.memory || outputs.director || outputs.sceneState || outputs.characterState;
		if (hasOutputs) {
			combined.agentOutputs = outputs;
		}

		return combined;
	}
```

Key changes: added `onProgress?: ProgressCallback` parameter, call `onProgress?.(agent.id, 'running')` before each agent, `onProgress?.(agent.id, 'done')` on success, `onProgress?.(agent.id, 'failed')` on catch.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/agents/agent-runner-progress.test.ts`
Expected: 3 tests PASS

- [ ] **Step 6: Run full test suite to check no regressions**

Run: `npx vitest run`
Expected: All 829 tests pass (823 + 6 new)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/agent.ts src/lib/types/index.ts src/lib/core/agents/agent-runner.ts tests/agents/agent-runner-progress.test.ts
git commit -m "feat: add progress callback to AgentRunner.onBeforeSend"
```

---

### Task 3: Engine Integration

**Files:**
- Modify: `src/lib/core/chat/engine.ts`

This task wires the pipeline store into the engine so that:
1. When `send()` starts, it begins the pipeline with all agents + an `llm-generation` step
2. The progress callback updates each agent step
3. The LLM generation step is updated during streaming
4. Pipeline resets when streaming finishes

- [ ] **Step 1: Add imports to engine.ts**

At the top of `src/lib/core/chat/engine.ts`, add these imports after the existing ones:

```typescript
import {
  startPipeline,
  updateStep,
  resetPipeline,
} from '$lib/stores/agent-progress';
```

- [ ] **Step 2: Wire pipeline into the send method**

In `engine.ts`, find the comment `// 6b. Run agent runner (memory, future agents)` and the code block below it. Replace the entire section from `// 6b.` through the line `if (agentResult.injectPrompt) { ... }` (ending at the closing brace of that if-block) with:

```typescript
    // 6b. Run agent runner (memory, future agents)
    const pipelineAgents = this.agentRunner.getAgentsByPriority().map((a) => ({
      id: a.id,
      label: a.name,
    }));
    pipelineAgents.push({ id: 'llm-generation', label: 'Generating' });
    startPipeline(pipelineAgents);

    const agentResult = await this.agentRunner.onBeforeSend(
      {
        sessionId: makeSessionId(options.characterId || ''),
        cardId: makeCharacterId(options.characterId || ''),
        cardType: options.worldCard ? 'world' : 'character',
        messages: allMessages,
        scene: triggerScene,
        turnNumber: allMessages.filter(m => m.role === 'user').length,
        config: options.config,
      },
      (agentId, status) => updateStep(agentId, status),
    );
    if (agentResult.agentOutputs) {
      ctx.agentOutputs = agentResult.agentOutputs;
    }
    if (agentResult.injectPrompt) {
      ctx.additionalPrompt = (ctx.additionalPrompt || '') + '\n\n' + agentResult.injectPrompt;
    }
```

- [ ] **Step 3: Mark LLM generation as running when streaming starts**

Inside the `tokenStream` generator function, find `const provider = self.registry.getProvider(...)` and add the pipeline update immediately after the `try {` line that starts the `for await` loop:

Find:
```typescript
      try {
        for await (const token of provider.chat(assembled, capturedConfig, metadata)) {
```

Add before the `try`:
```typescript
      updateStep('llm-generation', 'running');
```

So it becomes:
```typescript
      updateStep('llm-generation', 'running');
      try {
        for await (const token of provider.chat(assembled, capturedConfig, metadata)) {
```

- [ ] **Step 4: Mark LLM generation done and reset pipeline after streaming**

Find the line where `resolveComplete(assistantMessage)` is called inside `tokenStream`. After that line, add:

```typescript
      updateStep('llm-generation', 'done');
      setTimeout(resetPipeline, 300);
```

This gives the user 300ms to see the final ✓ before the indicator hides.

- [ ] **Step 5: Handle abort case — reset pipeline**

Find `self.aborted = true` in the `abort` method. After `this.aborted = true;` in the `send` method's abort closure, add a `resetPipeline()` call. Find the `abort` return:

```typescript
      abort: () => {
        self.aborted = true;
      },
```

Change to:

```typescript
      abort: () => {
        self.aborted = true;
        resetPipeline();
      },
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/chat/engine.ts
git commit -m "feat: wire agent pipeline progress into chat engine"
```

---

### Task 4: AgentPipelineIndicator Component

**Files:**
- Create: `src/lib/components/AgentPipelineIndicator.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  import { agentProgress } from '$lib/stores/agent-progress';

  const statusIcon: Record<string, string> = {
    pending: '○',
    running: '●',
    done: '✓',
    failed: '✗',
  };

  let state = $derived($agentProgress);
</script>

{#if state.active}
  <div class="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-surface0/90 backdrop-blur-sm text-text text-xs px-3 py-2 rounded-full border border-surface1 shadow-lg animate-in">
    {#each state.steps as step}
      <span class="flex items-center gap-1 whitespace-nowrap">
        {#if step.status === 'running'}
          <span class="animate-pulse">{statusIcon[step.status]}</span>
        {:else}
          {statusIcon[step.status]}
        {/if}
        <span class="text-subtext0">{step.label}</span>
      </span>
    {/each}
  </div>
{/if}

<style>
  .animate-in {
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/AgentPipelineIndicator.svelte
git commit -m "feat: add AgentPipelineIndicator floating component"
```

---

### Task 5: Wire Indicator into Chat Page

**Files:**
- Modify: `src/routes/chat/[id]/+page.svelte`

- [ ] **Step 1: Add import**

Add after the existing `import SessionPanel` line:

```typescript
  import AgentPipelineIndicator from '$lib/components/AgentPipelineIndicator.svelte';
```

- [ ] **Step 2: Add component to template**

Find the `{/if}` that closes the `{#if showSessionPanel}` block (the SessionPanel rendering). After that `{/if}` and before `{:else}`, add:

```svelte
  <AgentPipelineIndicator />
```

The surrounding context should look like:

```svelte
  {/if}
  <AgentPipelineIndicator />
{:else}
  <div class="flex-1 flex items-center justify-center text-subtext0">
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/routes/chat/[id]/+page.svelte
git commit -m "feat: mount AgentPipelineIndicator in chat page"
```

---

### Task 6: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, 5 pre-existing sql.js WASM errors are acceptable

- [ ] **Step 2: Verify all files are committed**

Run: `git status`
Expected: Clean working tree
