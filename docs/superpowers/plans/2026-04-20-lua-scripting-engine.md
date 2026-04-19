# World Chat Improvements — Sub-Project 3: Lua Scripting Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sandboxed Lua scripting engine (wasmoon) with trigger evaluation, variable persistence, and a bridge API for world chat scripts.

**Architecture:** A `LuaRuntime` class wraps wasmoon's `LuaEngine`. It lazily initializes the WASM factory, hydrates variables from `scene.variables` into the Lua global state, and exposes a sandboxed API (get_var, set_var, get_scene, etc.). A `TriggerExecutor` evaluates trigger conditions and executes actions using the runtime. Variables are persisted back to `scene.variables` after execution.

**Tech Stack:** `wasmoon` v1.16.0 (Lua 5.4 via WASM), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-20-world-chat-improvements-design.md` (Sections 3.1-3.6)

---

## File Structure

### New files
- `src/lib/core/lua/runtime.ts` — LuaRuntime class (lifecycle, factory, variable hydration)
- `src/lib/core/lua/sandbox.ts` — Sandboxed stdlib configuration, blocked globals list
- `src/lib/core/lua/api-bridge.ts` — Exposed Lua API functions (get_var, set_var, etc.)
- `src/lib/core/lua/trigger-executor.ts` — Trigger evaluation + execution logic
- `tests/core/lua/runtime.test.ts` — Runtime tests
- `tests/core/lua/trigger-executor.test.ts` — Trigger executor tests

### Modified files
- `package.json` — add wasmoon dependency
- `src/lib/core/chat/engine.ts` — integrate trigger execution at event points
- `src/routes/worlds/[id]/edit/+page.svelte` — add Lua script editor in scripts tab

---

### Task 1: Install wasmoon and Verify Bundle

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install wasmoon**

Run: `npm install wasmoon`

- [ ] **Step 2: Verify wasmoon loads in Node**

Run: `node -e "const { LuaFactory } = require('wasmoon'); console.log('wasmoon loaded')" 2>&1`
Expected: "wasmoon loaded"

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add wasmoon dependency for Lua scripting engine"
```

---

### Task 2: Create Sandboxed Environment

**Files:**
- Create: `src/lib/core/lua/sandbox.ts`
- Create: `tests/core/lua/runtime.test.ts` (partial — sandbox test)

- [ ] **Step 1: Write the failing test for sandbox**

Create `tests/core/lua/runtime.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LuaRuntime } from '$lib/core/lua/runtime';

describe('LuaRuntime', () => {
	describe('sandbox', () => {
		it('blocks io library', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			await expect(runtime.doString('io.open("test.txt", "r")')).rejects.toThrow();
			await runtime.close();
		});

		it('blocks os.execute', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			await expect(runtime.doString('os.execute("ls")')).rejects.toThrow();
			await runtime.close();
		});

		it('allows math, string, table', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			await expect(runtime.doString('math.abs(-1)')).resolves.toBeDefined();
			await expect(runtime.doString('string.len("hello")')).resolves.toBeDefined();
			await expect(runtime.doString('table.insert({}, 1)')).resolves.toBeDefined();
			await runtime.close();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/lua/runtime.test.ts`
Expected: FAIL

- [ ] **Step 3: Create sandbox.ts**

Create `src/lib/core/lua/sandbox.ts`:

```typescript
const BLOCKED_GLOBALS = [
	'io',
	'os.execute',
	'os.getenv',
	'os.exit',
	'os.clock',
	'os.date',
	'os.time',
	'os.difftime',
	'os.remove',
	'os.rename',
	'os.tmpname',
	'debug',
	'require',
	'dofile',
	'loadfile',
	'module',
	'package',
];

export function applySandbox(engine: { global: { set: (key: string, value: unknown) => void } }): void {
	for (const key of BLOCKED_GLOBALS) {
		if (key.includes('.')) {
			const [table, field] = key.split('.');
			engine.global.set(`${table}_${field}`, undefined);
		} else {
			engine.global.set(key, undefined);
		}
	}
}
```

Note: For nested globals like `os.execute`, we'll replace the entire parent table. This is refined in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/lua/sandbox.ts
git commit -m "feat: add Lua sandbox with blocked globals list"
```

---

### Task 3: Create LuaRuntime Class

**Files:**
- Create: `src/lib/core/lua/runtime.ts`
- Modify: `tests/core/lua/runtime.test.ts`

This is the core task. The runtime wraps wasmoon, handles lifecycle, sandboxing, variable hydration, and API bridge exposure.

- [ ] **Step 1: Write additional tests**

Add to `tests/core/lua/runtime.test.ts`:

```typescript
describe('variable hydration', () => {
	it('hydrates variables from scene state', async () => {
		const runtime = new LuaRuntime();
		await runtime.init({
			reputation: 50,
			chapter: 1,
			player_name: 'Alice',
		});
		const result = await runtime.doString('return get_var("reputation")');
		expect(result).toBe(50);
		await runtime.close();
	});

	it('persists variables back to extractable state', async () => {
		const runtime = new LuaRuntime();
		await runtime.init({ count: 0 });
		await runtime.doString('set_var("count", 42)');
		const vars = runtime.extractVariables();
		expect(vars.count).toBe(42);
		await runtime.close();
	});
});

describe('API bridge functions', () => {
	it('get_var returns nil for undefined variables', async () => {
		const runtime = new LuaRuntime();
		await runtime.init({});
		const result = await runtime.doString('return get_var("nonexistent")');
		expect(result).toBeNull();
		await runtime.close();
	});

	it('has_var returns boolean', async () => {
		const runtime = new LuaRuntime();
		await runtime.init({ foo: 'bar' });
		const result = await runtime.doString('return has_var("foo")');
		expect(result).toBe(true);
		await runtime.close();
	});

	it('set_var creates new variables', async () => {
		const runtime = new LuaRuntime();
		await runtime.init({});
		await runtime.doString('set_var("new_var", "hello")');
		expect(runtime.extractVariables().new_var).toBe('hello');
		await runtime.close();
	});
});

describe('doString', () => {
	it('evaluates simple expressions', async () => {
		const runtime = new LuaRuntime();
		await runtime.init();
		const result = await runtime.doString('return 1 + 1');
		expect(result).toBe(2);
		await runtime.close();
	});

	it('handles Lua errors gracefully', async () => {
		const runtime = new LuaRuntime();
		await runtime.init();
		await expect(runtime.doString('error("test error")')).rejects.toThrow();
		await runtime.close();
	});
});
```

- [ ] **Step 2: Create runtime.ts**

Create `src/lib/core/lua/runtime.ts`:

```typescript
import { LuaFactory } from 'wasmoon';
import type { VariableStore } from '$lib/types';
import { applySandbox } from './sandbox';
import { createApiBridge, type LuaApiContext } from './api-bridge';

let factoryPromise: Promise<LuaFactory> | null = null;

async function getFactory(): Promise<LuaFactory> {
	if (!factoryPromise) {
		factoryPromise = (async () => {
			const f = new LuaFactory();
			return f;
		})();
	}
	return factoryPromise;
}

export class LuaRuntime {
	private engine: Awaited<ReturnType<LuaFactory['createEngine']>> | null = null;
	private variables: VariableStore = {};

	async init(variables?: VariableStore): Promise<void> {
		const factory = await getFactory();
		this.engine = await factory.createEngine();
		this.variables = { ...variables };

		applySandbox(this.engine);

		const ctx: LuaApiContext = {
			getVar: (name: string) => this.variables[name] ?? null,
			setVar: (name: string, value: unknown) => { this.variables[name] = value as any; },
			hasVar: (name: string) => name in this.variables,
		};

		const bridge = createApiBridge(ctx);
		for (const [key, fn] of Object.entries(bridge)) {
			this.engine.global.set(key, fn);
		}
	}

	async doString(code: string): Promise<unknown> {
		if (!this.engine) throw new Error('LuaRuntime not initialized');
		return this.engine.doString(code);
	}

	extractVariables(): VariableStore {
		return { ...this.variables };
	}

	async close(): Promise<void> {
		if (this.engine) {
			this.engine.global.close();
			this.engine = null;
		}
	}
}
```

- [ ] **Step 3: Create api-bridge.ts**

Create `src/lib/core/lua/api-bridge.ts`:

```typescript
export interface LuaApiContext {
	getVar: (name: string) => unknown;
	setVar: (name: string, value: unknown) => void;
	hasVar: (name: string) => boolean;
}

export function createApiBridge(ctx: LuaApiContext): Record<string, (...args: unknown[]) => unknown> {
	return {
		get_var: (name: unknown) => ctx.getVar(String(name)),
		set_var: (name: unknown, value: unknown) => ctx.setVar(String(name), value),
		has_var: (name: unknown) => ctx.hasVar(String(name)),
	};
}
```

- [ ] **Step 4: Update sandbox to properly block globals**

Update `src/lib/core/lua/sandbox.ts` to use a Lua script that nils out blocked globals instead of trying to set them from JS:

```typescript
const SANDBOOT_SCRIPT = `
io = nil
os.execute = nil
os.getenv = nil
os.exit = nil
os.remove = nil
os.rename = nil
os.tmpname = nil
debug = nil
require = nil
dofile = nil
loadfile = nil
module = nil
package = nil
`;

export async function applySandbox(engine: { doString: (code: string) => Promise<unknown> }): Promise<void> {
	await engine.doString(SANDBOOT_SCRIPT);
}
```

Update `runtime.ts` to call `await applySandbox(this.engine)` instead of the sync version.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/core/lua/runtime.test.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/lua/runtime.ts src/lib/core/lua/api-bridge.ts src/lib/core/lua/sandbox.ts tests/core/lua/runtime.test.ts
git commit -m "feat: add LuaRuntime with sandbox, API bridge, variable hydration"
```

---

### Task 4: Create TriggerExecutor

**Files:**
- Create: `src/lib/core/lua/trigger-executor.ts`
- Create: `tests/core/lua/trigger-executor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/lua/trigger-executor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TriggerExecutor } from '$lib/core/lua/trigger-executor';
import type { Trigger } from '$lib/types';

describe('TriggerExecutor', () => {
	const triggers: Trigger[] = [
		{
			id: 't1',
			name: 'High rep',
			enabled: true,
			event: 'on_user_message',
			script: 'if get_var("reputation") > 50 then set_var("chapter", 2) end',
		},
		{
			id: 't2',
			name: 'Low rep',
			enabled: true,
			event: 'on_user_message',
			script: 'if get_var("reputation") < 10 then set_var("chapter", 0) end',
		},
		{
			id: 't3',
			name: 'Disabled',
			enabled: false,
			event: 'on_user_message',
			script: 'set_var("never", true)',
		},
	];

	it('executes matching triggers by priority', async () => {
		const executor = new TriggerExecutor(triggers, { reputation: 60 });
		const result = await executor.execute('on_user_message');
		expect(result.variables.reputation).toBe(60);
		expect(result.variables.chapter).toBe(2);
		expect(result.errors).toHaveLength(0);
	});

	it('skips disabled triggers', async () => {
		const executor = new TriggerExecutor(triggers, { reputation: 60 });
		const result = await executor.execute('on_user_message');
		expect(result.variables.never).toBeUndefined();
	});

	it('skips triggers that do not match event', async () => {
		const executor = new TriggerExecutor(triggers, { reputation: 60 });
		const result = await executor.execute('on_ai_message');
		expect(result.variables.chapter).toBeUndefined();
	});

	it('collects errors without crashing', async () => {
		const badTriggers: Trigger[] = [
			{
				id: 'bad',
				name: 'Bad trigger',
				enabled: true,
				event: 'on_message',
				script: 'error("boom")',
			},
		];
		const executor = new TriggerExecutor(badTriggers, {});
		const result = await executor.execute('on_message');
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it('returns empty result when no triggers match', async () => {
		const executor = new TriggerExecutor([], {});
		const result = await executor.execute('on_user_message');
		expect(result.variables).toEqual({});
		expect(result.errors).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/lua/trigger-executor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement TriggerExecutor**

Create `src/lib/core/lua/trigger-executor.ts`:

```typescript
import { LuaRuntime } from './runtime';
import type { Trigger, TriggerEvent, VariableStore } from '$lib/types';
import { logger } from '$lib/utils/logger';

const log = logger.scope('TriggerExecutor');

export interface TriggerResult {
	variables: VariableStore;
	errors: Array<{ triggerId: string; error: Error }>;
}

export class TriggerExecutor {
	private triggers: Trigger[];
	private variables: VariableStore;

	constructor(triggers: Trigger[], variables: VariableStore) {
		this.triggers = triggers;
		this.variables = { ...variables };
	}

	async execute(event: TriggerEvent): Promise<TriggerResult> {
		const matching = this.triggers
			.filter((t) => t.enabled && t.event === event);

		if (matching.length === 0) {
			return { variables: this.variables, errors: [] };
		}

		const runtime = new LuaRuntime();
		const errors: Array<{ triggerId: string; error: Error }> = [];

		try {
			await runtime.init(this.variables);

			for (const trigger of matching) {
				try {
					if (!trigger.script) continue;
					await runtime.doString(trigger.script);
					this.variables = runtime.extractVariables();
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					log.warn(`Trigger "${trigger.name}" (${trigger.id}) failed:`, error.message);
					errors.push({ triggerId: trigger.id, error });
				}
			}
		} finally {
			await runtime.close();
		}

		return { variables: this.variables, errors };
	}
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/lua/trigger-executor.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/lua/trigger-executor.ts tests/core/lua/trigger-executor.test.ts
git commit -m "feat: add TriggerExecutor for evaluating and running Lua triggers"
```

---

### Task 5: Integrate Trigger Execution into Chat Engine

**Files:**
- Modify: `src/lib/core/chat/engine.ts`

- [ ] **Step 1: Add import**

Add at top of `src/lib/core/chat/engine.ts`:

```typescript
import { TriggerExecutor } from '../lua/trigger-executor';
```

- [ ] **Step 2: Add trigger execution at on_user_message point**

In the `send` method, after `applyRegexScripts` on user input (around step 1), add trigger execution for `on_user_message`:

```typescript
    // 1b. Run on_user_message triggers
    let triggerVariables = options.card.triggers.length > 0
      ? (await new TriggerExecutor(options.card.triggers, options.scene.variables)
          .execute('on_user_message')).variables
      : options.scene.variables;
```

Use `triggerVariables` in the scene state going forward.

- [ ] **Step 3: Add trigger execution for on_ai_message**

After the AI response is finalized (in the `tokenStream` function, after step 11), add `on_ai_message` trigger execution:

```typescript
      // 11c. Run on_ai_message triggers
      if (capturedCtx.card.triggers.length > 0) {
        try {
          const executor = new TriggerExecutor(capturedCtx.card.triggers, capturedCtx.scene.variables);
          await executor.execute('on_ai_message');
        } catch {
          // Non-blocking
        }
      }
```

- [ ] **Step 4: Verify tests still pass**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/engine.ts
git commit -m "feat: integrate Lua trigger execution into chat engine pipeline"
```

---

### Task 6: Add Lua Script Editor to World Editor Scripts Tab

**Files:**
- Modify: `src/routes/worlds/[id]/edit/+page.svelte`

- [ ] **Step 1: Add virtual script editor to scripts tab**

In the scripts tab section of the editor page, after the existing RegexEditor and TriggerEditor, add a virtual script editor:

Add a new section with a textarea for the `virtualScript` field (single large Lua script attached to the world card):

```svelte
          <div class="border-t border-surface0 pt-4">
            <h3 class="text-sm font-medium text-text mb-2">Lua Script</h3>
            <p class="text-xs text-subtext0 mb-2">Main Lua script executed for this world. Runs before triggers.</p>
            <textarea
              bind:value={card.virtualScript}
              rows={8}
              class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1
                     focus:outline-none focus:border-mauve resize-y font-mono"
              placeholder="-- Write your world's Lua script here&#10;-- function on_init()&#10;--   set_var('chapter', 1)&#10;-- end"
            ></textarea>
          </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/worlds/[id]/edit/+page.svelte
git commit -m "feat: add Lua script editor to world editor scripts tab"
```

---

### Task 7: Full Test Suite and Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify svelte-check**

Run: `npx svelte-check --threshold error`
Expected: No new errors

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: address issues from Lua scripting engine integration"
```
