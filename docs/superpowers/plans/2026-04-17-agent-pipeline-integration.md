# Agent-Pipeline Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect agents to the prompt assembly pipeline so agent outputs appear at configurable positions in the prompt preset.

**Architecture:** Agents run before prompt assembly (pre-computed), outputs collected by AgentRunner into `AgentOutputs`, passed to `AssemblyContext`, and new PromptItem types (`memory`, `director`, `sceneState`, `characterState`) read from stored outputs. State updates auto-persist to sceneStore.

**Tech Stack:** TypeScript, Vitest, Svelte stores

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types/agent.ts` | Modify | Add `AgentOutputs` interface, extend `AgentResult` |
| `src/lib/types/prompt-preset.ts` | Modify | Add 4 new `PromptItemType` values |
| `src/lib/core/agents/agent-runner.ts` | Modify | Collect individual agent outputs, auto-persist state |
| `src/lib/core/chat/engine.ts` | Modify | Pass `agentOutputs` to assembler context |
| `src/lib/core/chat/prompt-assembler.ts` | Modify | Handle new agent PromptItem types |
| `src/lib/core/presets/defaults.ts` | Modify | Add agent items to default preset |
| `tests/agents/agent-prompt-integration.test.ts` | Create | Integration tests for agent → prompt flow |

---

### Task 1: Add AgentOutputs Interface and Extend AgentResult

**Files:**
- Modify: `src/lib/types/agent.ts`

- [ ] **Step 1: Write the failing test**

Create test in `tests/types/agent-outputs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { AgentOutputs, AgentResult } from '$lib/types/agent';

describe('AgentOutputs type', () => {
  it('accepts all agent output fields', () => {
    const outputs: AgentOutputs = {
      memory: '[Memory]\n- fact (trait)',
      director: '[Director]\nScene Mandate: test',
      sceneState: '[Scene]\nLocation: test',
      characterState: '[Character States]\nElara: alert',
    };
    expect(outputs.memory).toBeDefined();
    expect(outputs.director).toBeDefined();
    expect(outputs.sceneState).toBeDefined();
    expect(outputs.characterState).toBeDefined();
  });

  it('accepts partial outputs', () => {
    const outputs: AgentOutputs = {
      memory: '[Memory]\n- fact',
    };
    expect(outputs.director).toBeUndefined();
  });
});

describe('AgentResult with agentOutputs', () => {
  it('accepts agentOutputs field', () => {
    const result: AgentResult = {
      agentOutputs: {
        memory: '[Memory]\n- fact',
      },
    };
    expect(result.agentOutputs?.memory).toBe('[Memory]\n- fact');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types/agent-outputs.test.ts`
Expected: FAIL — `AgentOutputs` is not exported

- [ ] **Step 3: Write minimal implementation**

In `src/lib/types/agent.ts`, add the `AgentOutputs` interface before `AgentResult` and extend `AgentResult`:

```ts
export interface AgentOutputs {
  memory?: string;
  director?: string;
  sceneState?: string;
  characterState?: string;
}
```

Then add `agentOutputs` field to `AgentResult`:

```ts
export interface AgentResult {
  injectPrompt?: string;
  updatedMemories?: MemoryRecord[];
  summaries?: SessionSummary[];
  updatedState?: StateUpdate;
  agentOutputs?: AgentOutputs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types/agent-outputs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/agent.ts tests/types/agent-outputs.test.ts
git commit -m "feat: add AgentOutputs interface and extend AgentResult"
```

---

### Task 2: Add New PromptItemType Values

**Files:**
- Modify: `src/lib/types/prompt-preset.ts`

- [ ] **Step 1: Write the failing test**

Create test in `tests/types/prompt-item-agent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { PromptItem } from '$lib/types/prompt-preset';

describe('Agent PromptItem types', () => {
  it('accepts memory type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'memory',
      name: 'Memory',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('memory');
  });

  it('accepts director type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'director',
      name: 'Director',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('director');
  });

  it('accepts sceneState type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'sceneState',
      name: 'Scene State',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('sceneState');
  });

  it('accepts characterState type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'characterState',
      name: 'Character State',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('characterState');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types/prompt-item-agent.test.ts`
Expected: FAIL — type `'memory'` is not assignable to `PromptItemType`

- [ ] **Step 3: Write minimal implementation**

In `src/lib/types/prompt-preset.ts`, extend the `PromptItemType` union:

Change:
```ts
export type PromptItemType =
  | 'system' | 'description' | 'persona' | 'personality' | 'scenario'
  | 'exampleMessages' | 'chatHistory' | 'lorebook' | 'authornote'
  | 'postHistoryInstructions' | 'depthPrompt' | 'jailbreak' | 'prefill' | 'plain';
```

To:
```ts
export type PromptItemType =
  | 'system' | 'description' | 'persona' | 'personality' | 'scenario'
  | 'exampleMessages' | 'chatHistory' | 'lorebook' | 'authornote'
  | 'postHistoryInstructions' | 'depthPrompt' | 'jailbreak' | 'prefill' | 'plain'
  | 'memory' | 'director' | 'sceneState' | 'characterState';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types/prompt-item-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/prompt-preset.ts tests/types/prompt-item-agent.test.ts
git commit -m "feat: add memory, director, sceneState, characterState PromptItem types"
```

---

### Task 3: Add Agent resolveItem Cases to PromptAssembler

**Files:**
- Modify: `src/lib/core/chat/prompt-assembler.ts`

- [ ] **Step 1: Write the failing tests**

Create test in `tests/core/chat/prompt-assembler-agent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { PromptItem } from '$lib/types/prompt-preset';
import type { AssemblyContext } from '$lib/core/chat/prompt-assembler';
import { resolveItem } from '$lib/core/chat/prompt-assembler';
import type { AgentOutputs } from '$lib/types/agent';

function makeContext(agentOutputs?: AgentOutputs): AssemblyContext {
  return {
    card: {
      name: 'Test',
      description: 'A test character',
      personality: '',
      scenario: '',
      firstMessage: '',
      alternateGreetings: [],
      exampleMessages: '',
      systemPrompt: '',
      postHistoryInstructions: '',
      depthPrompt: null,
      defaultPersonaId: '',
      creator: '',
      characterVersion: '',
      tags: [],
      creatorNotes: '',
      license: '',
      lorebook: [],
      loreSettings: { scanDepth: 1, tokenBudget: 1000 },
      regexScripts: [],
      triggers: [],
    },
    scene: {
      location: '',
      time: '',
      mood: '',
      participatingCharacters: [],
      variables: {},
    },
    messages: [],
    lorebookMatches: [],
    agentOutputs,
  };
}

describe('resolveItem agent types', () => {
  const baseItem = {
    id: 'test',
    enabled: true,
    role: 'system' as const,
    content: '',
  };

  it('returns null for memory item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'memory', name: 'Memory' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for memory item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'memory', name: 'Memory' };
    const result = resolveItem(item, makeContext({
      memory: '[Memory]\n- Elara is afraid of fire (trait)',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Memory]\n- Elara is afraid of fire (trait)',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for director item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'director', name: 'Director' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for director item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'director', name: 'Director' };
    const result = resolveItem(item, makeContext({
      director: '[Director]\nScene Mandate: Test mandate',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Director]\nScene Mandate: Test mandate',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for sceneState item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'sceneState', name: 'Scene State' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for sceneState item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'sceneState', name: 'Scene State' };
    const result = resolveItem(item, makeContext({
      sceneState: '[Scene]\nLocation: The Rusty Tankard',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Scene]\nLocation: The Rusty Tankard',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for characterState item with no agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'characterState', name: 'Character State' };
    const result = resolveItem(item, makeContext());
    expect(result).toBeNull();
  });

  it('returns system message for characterState item with agent output', () => {
    const item: PromptItem = { ...baseItem, type: 'characterState', name: 'Character State' };
    const result = resolveItem(item, makeContext({
      characterState: '[Character States]\nElara: alert',
    }));
    expect(result).not.toBeNull();
    expect(result).toEqual({
      role: 'system',
      content: '[Character States]\nElara: alert',
      type: 'system',
      timestamp: 0,
    });
  });

  it('returns null for disabled agent item', () => {
    const item: PromptItem = { ...baseItem, type: 'memory', name: 'Memory', enabled: false };
    const result = resolveItem(item, makeContext({
      memory: '[Memory]\n- fact',
    }));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/chat/prompt-assembler-agent.test.ts`
Expected: FAIL — `resolveItem` returns `null` for unknown types

- [ ] **Step 3: Write minimal implementation**

In `src/lib/core/chat/prompt-assembler.ts`:

First, add `AgentOutputs` import at the top:
```ts
import type { AgentOutputs } from '$lib/types/agent';
```

Add `agentOutputs` field to `AssemblyContext`:
```ts
export interface AssemblyContext {
  card: CharacterCard;
  scene: SceneState;
  messages: Message[];
  lorebookMatches: LorebookEntry[];
  persona?: UserPersona;
  worldCard?: WorldCard;
  additionalPrompt?: string;
  outputLanguage?: string;
  agentOutputs?: AgentOutputs;
}
```

Add 4 new cases to the `switch` in `resolveItem`, before the `default:` case:

```ts
    case 'memory': {
      const output = ctx.agentOutputs?.memory;
      if (!output) return null;
      return sysMsg(output);
    }

    case 'director': {
      const output = ctx.agentOutputs?.director;
      if (!output) return null;
      return sysMsg(output);
    }

    case 'sceneState': {
      const output = ctx.agentOutputs?.sceneState;
      if (!output) return null;
      return sysMsg(output);
    }

    case 'characterState': {
      const output = ctx.agentOutputs?.characterState;
      if (!output) return null;
      return sysMsg(output);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/chat/prompt-assembler-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing prompt-assembler tests to verify no regression**

Run: `npx vitest run tests/core/chat/prompt-assembler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/chat/prompt-assembler.ts tests/core/chat/prompt-assembler-agent.test.ts
git commit -m "feat: add agent resolveItem cases to PromptAssembler"
```

---

### Task 4: Update AgentRunner to Collect Individual Outputs

**Files:**
- Modify: `src/lib/core/agents/agent-runner.ts`

- [ ] **Step 1: Write the failing tests**

Create test in `tests/agents/agent-runner-outputs.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

function mockAgent(id: string, result: AgentResult): Agent {
  return {
    id,
    name: id,
    priority: parseInt(id.split('-')[1]) || 50,
    init: vi.fn().mockResolvedValue(undefined),
    onBeforeSend: vi.fn().mockResolvedValue(result),
    onAfterReceive: vi.fn().mockResolvedValue({}),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

function mockContext(): AgentContext {
  return {
    sessionId: 'test-session',
    cardId: 'test-card',
    cardType: 'character',
    messages: [],
    scene: {
      location: '',
      time: '',
      mood: '',
      participatingCharacters: [],
      variables: {},
    },
    turnNumber: 1,
    config: {
      providerId: 'test',
      model: 'test-model',
    },
  };
}

describe('AgentRunner output collection', () => {
  it('maps memory agent injectPrompt to agentOutputs.memory', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    runner.registerAgent(mockAgent('memory', {
      injectPrompt: '[Memory]\n- fact (trait)',
    }));

    const result = await runner.onBeforeSend(mockContext());
    expect(result.agentOutputs?.memory).toBe('[Memory]\n- fact (trait)');
  });

  it('maps director agent injectPrompt to agentOutputs.director', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    runner.registerAgent(mockAgent('director', {
      injectPrompt: '[Director]\nScene Mandate: test',
    }));

    const result = await runner.onBeforeSend(mockContext());
    expect(result.agentOutputs?.director).toBe('[Director]\nScene Mandate: test');
  });

  it('maps scene-state agent injectPrompt to agentOutputs.sceneState', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    runner.registerAgent(mockAgent('scene-state', {
      injectPrompt: '[Scene]\nLocation: test',
    }));

    const result = await runner.onBeforeSend(mockContext());
    expect(result.agentOutputs?.sceneState).toBe('[Scene]\nLocation: test');
  });

  it('maps character-state agent injectPrompt to agentOutputs.characterState', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    runner.registerAgent(mockAgent('character-state', {
      injectPrompt: '[Character States]\nElara: alert',
    }));

    const result = await runner.onBeforeSend(mockContext());
    expect(result.agentOutputs?.characterState).toBe('[Character States]\nElara: alert');
  });

  it('collects outputs from multiple agents', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    const memAgent = mockAgent('memory', {
      injectPrompt: '[Memory]\n- fact',
    });
    memAgent.priority = 10;
    const dirAgent = mockAgent('director', {
      injectPrompt: '[Director]\nMandate: test',
    });
    dirAgent.priority = 20;

    runner.registerAgent(memAgent);
    runner.registerAgent(dirAgent);

    const result = await runner.onBeforeSend(mockContext());
    expect(result.agentOutputs?.memory).toBe('[Memory]\n- fact');
    expect(result.agentOutputs?.director).toBe('[Director]\nMandate: test');
  });

  it('does not set agentOutputs when no agents return injectPrompt', async () => {
    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    runner.registerAgent(mockAgent('memory', {}));

    const result = await runner.onBeforeSend(mockContext());
    expect(result.agentOutputs?.memory).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agents/agent-runner-outputs.test.ts`
Expected: FAIL — `agentOutputs` is undefined on result

- [ ] **Step 3: Write minimal implementation**

In `src/lib/core/agents/agent-runner.ts`, replace the `onBeforeSend` method:

```ts
	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const combined: AgentResult = {};
		const outputs: import('$lib/types/agent').AgentOutputs = {};

		for (const agent of this.getAgentsByPriority()) {
			try {
				const result = await agent.onBeforeSend(ctx);
				if (result.injectPrompt) {
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
				console.warn(`[AgentRunner] Agent ${agent.id} onBeforeSend failed`);
			}
		}

		const hasOutputs = outputs.memory || outputs.director || outputs.sceneState || outputs.characterState;
		if (hasOutputs) {
			combined.agentOutputs = outputs;
		}

		return combined;
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agents/agent-runner-outputs.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing agent-runner tests to verify no regression**

Run: `npx vitest run tests/agents/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/agents/agent-runner.ts tests/agents/agent-runner-outputs.test.ts
git commit -m "feat: update AgentRunner to collect individual agent outputs"
```

---

### Task 5: Update ChatEngine to Pass agentOutputs to Assembler

**Files:**
- Modify: `src/lib/core/chat/engine.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/integration/agent-pipeline.test.ts` or create `tests/agents/agent-engine-outputs.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

describe('ChatEngine agent output passthrough', () => {
  it('passes agentOutputs to assembleWithPreset context', () => {
    const ctx: Record<string, unknown> = {};
    
    const agentResult = {
      agentOutputs: {
        memory: '[Memory]\n- fact',
        director: '[Director]\nMandate: test',
        sceneState: '[Scene]\nLocation: Inn',
        characterState: '[Character States]\nElara: alert',
      },
    };

    if (agentResult.agentOutputs) {
      ctx.agentOutputs = agentResult.agentOutputs;
    }

    expect(ctx.agentOutputs).toEqual({
      memory: '[Memory]\n- fact',
      director: '[Director]\nMandate: test',
      sceneState: '[Scene]\nLocation: Inn',
      characterState: '[Character States]\nElara: alert',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes (logic test)**

Run: `npx vitest run tests/agents/agent-engine-outputs.test.ts`
Expected: PASS (pure logic test, verifies pattern)

- [ ] **Step 3: Update ChatEngine implementation**

In `src/lib/core/chat/engine.ts`, find the block at approximately line 157-163 that reads:

```ts
		// 6b. Run agent runner (memory, future agents)
		const agentResult = await this.agentRunner.onBeforeSend({
			sessionId: options.characterId || '',
			cardId: options.characterId || '',
			cardType: options.worldCard ? 'world' : 'character',
			messages: allMessages,
			scene: triggerScene,
			turnNumber: allMessages.filter(m => m.role === 'user').length,
			config: options.config,
		});
		if (agentResult.injectPrompt) {
			ctx.additionalPrompt = (ctx.additionalPrompt || '') + '\n\n' + agentResult.injectPrompt;
		}
```

Replace with:

```ts
		// 6b. Run agent runner (memory, future agents)
		const agentResult = await this.agentRunner.onBeforeSend({
			sessionId: options.characterId || '',
			cardId: options.characterId || '',
			cardType: options.worldCard ? 'world' : 'character',
			messages: allMessages,
			scene: triggerScene,
			turnNumber: allMessages.filter(m => m.role === 'user').length,
			config: options.config,
		});
		if (agentResult.agentOutputs) {
			ctx.agentOutputs = agentResult.agentOutputs;
		}
```

Then, in the section where `assembleWithPreset` is called (approximately line 175-186), update the call to pass `agentOutputs`:

Find:
```ts
		const result = assembleWithPreset(options.preset, {
			card: ctx.card,
			scene: ctx.scene,
			messages: ctx.messages,
			lorebookMatches: ctx.lorebookMatches,
			persona: options.persona,
			worldCard: options.worldCard,
			additionalPrompt: ctx.additionalPrompt,
			outputLanguage: get(settingsStore).outputLanguage || '',
		});
```

Verify this already passes through `ctx.agentOutputs` — if not, add it:

```ts
		const result = assembleWithPreset(options.preset, {
			card: ctx.card,
			scene: ctx.scene,
			messages: ctx.messages,
			lorebookMatches: ctx.lorebookMatches,
			persona: options.persona,
			worldCard: options.worldCard,
			additionalPrompt: ctx.additionalPrompt,
			outputLanguage: get(settingsStore).outputLanguage || '',
			agentOutputs: ctx.agentOutputs,
		});
```

Also, add `agentOutputs` to the `ChatContext` interface in `src/lib/types/plugin.ts`:

```ts
export interface ChatContext {
  messages: Message[];
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  additionalPrompt?: string;
  lorebookMatches: LorebookEntry[];
  agentOutputs?: import('$lib/types/agent').AgentOutputs;
}
```

- [ ] **Step 4: Run test to verify**

Run: `npx vitest run tests/agents/agent-engine-outputs.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing tests to verify no regression**

Run: `npx vitest run tests/`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/chat/engine.ts tests/agents/agent-engine-outputs.test.ts
git commit -m "feat: pass agentOutputs from ChatEngine to prompt assembler"
```

---

### Task 6: Add Agent Items to Default Preset

**Files:**
- Modify: `src/lib/core/presets/defaults.ts`

- [ ] **Step 1: Write the failing test**

Create test in `tests/core/presets/agent-preset-items.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDefaultPreset } from '$lib/core/presets/defaults';

describe('Default preset agent items', () => {
  const preset = createDefaultPreset();

  it('includes memory item', () => {
    const item = preset.items.find(i => i.type === 'memory');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('includes director item', () => {
    const item = preset.items.find(i => i.type === 'director');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('includes sceneState item', () => {
    const item = preset.items.find(i => i.type === 'sceneState');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('includes characterState item', () => {
    const item = preset.items.find(i => i.type === 'characterState');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('positions agent items between scenario and exampleMessages', () => {
    const types = preset.items.map(i => i.type);
    const scenarioIdx = types.lastIndexOf('scenario');
    const memoryIdx = types.indexOf('memory');
    const directorIdx = types.indexOf('director');
    const sceneIdx = types.indexOf('sceneState');
    const charIdx = types.indexOf('characterState');
    const exampleIdx = types.indexOf('exampleMessages');

    expect(memoryIdx).toBeGreaterThan(scenarioIdx);
    expect(directorIdx).toBeGreaterThan(memoryIdx);
    expect(sceneIdx).toBeGreaterThan(directorIdx);
    expect(charIdx).toBeGreaterThan(sceneIdx);
    expect(exampleIdx).toBeGreaterThan(charIdx);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/presets/agent-preset-items.test.ts`
Expected: FAIL — agent items not found in preset

- [ ] **Step 3: Write minimal implementation**

In `src/lib/core/presets/defaults.ts`, add 4 new items to the `items` array in `createDefaultPreset()`. Insert them after the `scenario` item and before the `exampleMessages` item:

```ts
    {
      id: uid(),
      type: 'memory',
      name: 'Memory',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'director',
      name: 'Director',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'sceneState',
      name: 'Scene State',
      enabled: true,
      role: 'system',
      content: '',
    },
    {
      id: uid(),
      type: 'characterState',
      name: 'Character State',
      enabled: true,
      role: 'system',
      content: '',
    },
```

Position: After the `scenario` item (index 6) and before the `exampleMessages` item (index 7).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/presets/agent-preset-items.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing preset tests to verify no regression**

Run: `npx vitest run tests/core/presets/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/presets/defaults.ts tests/core/presets/agent-preset-items.test.ts
git commit -m "feat: add agent items to default prompt preset"
```

---

### Task 7: Add Agent State Persistence in AgentRunner.onAfterReceive

**Files:**
- Modify: `src/lib/core/agents/agent-runner.ts`

- [ ] **Step 1: Write the failing test**

Create test in `tests/agents/agent-state-persist.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

describe('AgentRunner state persistence', () => {
  it('persists scene state updates to sceneStore', async () => {
    const mockUpdate = vi.fn();
    vi.doMock('$lib/stores/scene', () => ({
      sceneStore: { update: mockUpdate },
    }));

    const { AgentRunner } = await import('$lib/core/agents/agent-runner');

    const runner = new AgentRunner();
    runner.unregisterAgent('memory');
    runner.unregisterAgent('director');
    runner.unregisterAgent('scene-state');
    runner.unregisterAgent('character-state');

    const sceneAgent: Agent = {
      id: 'scene-state',
      name: 'Scene State',
      priority: 30,
      init: vi.fn().mockResolvedValue(undefined),
      onBeforeSend: vi.fn().mockResolvedValue({}),
      onAfterReceive: vi.fn().mockResolvedValue({
        updatedState: {
          scene: {
            location: 'The Rusty Tankard',
            atmosphere: 'Tense',
            timeOfDay: 'Late evening',
          },
        },
      }),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    runner.registerAgent(sceneAgent);

    const ctx: AgentContext = {
      sessionId: 'test-session',
      cardId: 'test-card',
      cardType: 'character',
      messages: [],
      scene: {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
      },
      turnNumber: 1,
      config: { providerId: 'test', model: 'test' },
    };

    await runner.onAfterReceive(ctx, 'AI response');

    expect(mockUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agents/agent-state-persist.test.ts`
Expected: FAIL — `sceneStore.update` not called

- [ ] **Step 3: Write minimal implementation**

In `src/lib/core/agents/agent-runner.ts`, update the `onAfterReceive` method. After collecting all `updatedState` from agents, add state persistence:

```ts
	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const combined: AgentResult = {};
		const allMemories: import('$lib/types/memory').MemoryRecord[] = [];

		for (const agent of this.getAgentsByPriority()) {
			try {
				const result = await agent.onAfterReceive(ctx, response);
				if (result.updatedMemories) {
					allMemories.push(...result.updatedMemories);
				}
				if (result.updatedState) {
					combined.updatedState = {
						...combined.updatedState,
						...result.updatedState
					};
				}
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} onAfterReceive failed`);
			}
		}

		if (allMemories.length) {
			combined.updatedMemories = allMemories;
		}

		if (combined.updatedState?.scene) {
			try {
				const { sceneStore } = await import('$lib/stores/scene');
				const agentScene = combined.updatedState.scene;
				sceneStore.update((state: Record<string, unknown>) => ({
					...state,
					location: agentScene.location || state.location,
					mood: agentScene.atmosphere || state.mood,
					time: agentScene.timeOfDay || state.time,
					participatingCharacters: agentScene.characters || state.participatingCharacters,
				}));
			} catch {
				console.warn('[AgentRunner] Failed to persist scene state to sceneStore');
			}
		}

		return combined;
	}
```

Note: The mapping from agent `SceneState` (agent-state.ts) to scene store `SceneState` (scene.ts):
- `agentScene.location` → `state.location`
- `agentScene.atmosphere` → `state.mood`
- `agentScene.timeOfDay` → `state.time`
- `agentScene.characters` → `state.participatingCharacters`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agents/agent-state-persist.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing agent-runner tests**

Run: `npx vitest run tests/agents/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/agents/agent-runner.ts tests/agents/agent-state-persist.test.ts
git commit -m "feat: auto-persist agent scene state to sceneStore"
```

---

### Task 8: Full Integration Test

**Files:**
- Create: `tests/integration/agent-prompt-integration.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect } from 'vitest';
import { assembleWithPreset, type AssemblyContext } from '$lib/core/chat/prompt-assembler';
import type { PromptPreset, PromptItem } from '$lib/types/prompt-preset';
import type { AgentOutputs } from '$lib/types/agent';

function uid(): string {
  return crypto.randomUUID();
}

function makeMinimalCard(): AssemblyContext['card'] {
  return {
    name: 'TestChar',
    description: 'A test character',
    personality: 'brave',
    scenario: 'A test scenario',
    firstMessage: '',
    alternateGreetings: [],
    exampleMessages: '',
    systemPrompt: 'You are TestChar.',
    postHistoryInstructions: '',
    depthPrompt: null,
    defaultPersonaId: '',
    creator: '',
    characterVersion: '',
    tags: [],
    creatorNotes: '',
    license: '',
    lorebook: [],
    loreSettings: { scanDepth: 1, tokenBudget: 1000 },
    regexScripts: [],
    triggers: [],
  };
}

describe('Agent → Prompt integration', () => {
  it('agent outputs appear in assembled messages at correct positions', () => {
    const agentOutputs: AgentOutputs = {
      memory: '[Memory]\n- Elara is afraid of fire (trait)',
      director: '[Director]\nScene Mandate: Test mandate',
      sceneState: '[Scene]\nLocation: The Rusty Tankard',
      characterState: '[Character States]\nElara: alert',
    };

    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'system', name: 'System', enabled: true, role: 'system', content: 'You are TestChar.' },
        { id: uid(), type: 'description', name: 'Desc', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'memory', name: 'Memory', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'sceneState', name: 'Scene', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'characterState', name: 'Chars', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'chatHistory', name: 'History', enabled: true, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: {
        location: '',
        time: '',
        mood: '',
        participatingCharacters: [],
        variables: {},
      },
      messages: [
        { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 1 },
        { role: 'assistant', content: 'Hi there', type: 'dialogue', timestamp: 2 },
      ],
      lorebookMatches: [],
      agentOutputs,
    };

    const result = assembleWithPreset(preset, ctx);

    const types = result.messages.map(m => {
      if (m.content.startsWith('[Memory]')) return 'memory';
      if (m.content.startsWith('[Director]')) return 'director';
      if (m.content.startsWith('[Scene]')) return 'sceneState';
      if (m.content.startsWith('[Character States]')) return 'characterState';
      if (m.content.startsWith('You are')) return 'system';
      return 'other';
    });

    const memoryIdx = types.indexOf('memory');
    const directorIdx = types.indexOf('director');
    const sceneIdx = types.indexOf('sceneState');
    const charIdx = types.indexOf('characterState');
    const historyIdx = result.messages.findIndex(m => m.role === 'user');

    expect(memoryIdx).toBeGreaterThan(-1);
    expect(directorIdx).toBeGreaterThan(-1);
    expect(sceneIdx).toBeGreaterThan(-1);
    expect(charIdx).toBeGreaterThan(-1);

    expect(directorIdx).toBeGreaterThan(memoryIdx);
    expect(sceneIdx).toBeGreaterThan(directorIdx);
    expect(charIdx).toBeGreaterThan(sceneIdx);
    expect(historyIdx).toBeGreaterThan(charIdx);
  });

  it('disabled agent items produce no output', () => {
    const agentOutputs: AgentOutputs = {
      memory: '[Memory]\n- fact',
      director: '[Director]\nMandate',
      sceneState: '[Scene]\nLocation: test',
      characterState: '[Character States]\nElara: alert',
    };

    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'memory', name: 'Memory', enabled: false, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: false, role: 'system', content: '' },
        { id: uid(), type: 'sceneState', name: 'Scene', enabled: false, role: 'system', content: '' },
        { id: uid(), type: 'characterState', name: 'Chars', enabled: false, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {} },
      messages: [],
      lorebookMatches: [],
      agentOutputs,
    };

    const result = assembleWithPreset(preset, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('no agentOutputs produces no agent messages', () => {
    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'memory', name: 'Memory', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: true, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {} },
      messages: [],
      lorebookMatches: [],
    };

    const result = assembleWithPreset(preset, ctx);
    expect(result.messages).toHaveLength(0);
  });

  it('partial agentOutputs only produce messages for available agents', () => {
    const agentOutputs: AgentOutputs = {
      memory: '[Memory]\n- fact',
    };

    const preset: PromptPreset = {
      id: uid(),
      name: 'Test',
      items: [
        { id: uid(), type: 'memory', name: 'Memory', enabled: true, role: 'system', content: '' },
        { id: uid(), type: 'director', name: 'Director', enabled: true, role: 'system', content: '' },
      ],
      assistantPrefill: '',
    };

    const ctx: AssemblyContext = {
      card: makeMinimalCard(),
      scene: { location: '', time: '', mood: '', participatingCharacters: [], variables: {} },
      messages: [],
      lorebookMatches: [],
      agentOutputs,
    };

    const result = assembleWithPreset(preset, ctx);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain('[Memory]');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/integration/agent-prompt-integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-prompt-integration.test.ts
git commit -m "test: add agent-prompt integration tests"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx svelte-check --tsconfig ./tsconfig.json`
Expected: No new errors (pre-existing errors may exist)

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address integration issues from final verification"
```
