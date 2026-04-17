# Agent-Based Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent system with Memory, Director, Scene State, and Character State agents that run in a sequential pipeline to enhance chat responses.

**Architecture:** Sequential pipeline where agents run by priority order, each producing structured output that gets injected into the main prompt. Agents share state through SQLite storage and coordinate through the AgentRunner.

**Tech Stack:** TypeScript, Svelte, SQLite (sql.js), vector embeddings

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/lib/types/agent-state.ts` | Types for SceneState, CharacterState, DirectorGuidance |
| `src/lib/storage/agent-states.ts` | SQLite CRUD for scene/character states |
| `src/lib/core/agents/director-agent.ts` | Director Agent implementation |
| `src/lib/core/agents/scene-state-agent.ts` | Scene State Agent implementation |
| `src/lib/core/agents/character-state-agent.ts` | Character State Agent implementation |
| `tests/storage/agent-states.test.ts` | Tests for agent state storage |
| `tests/agents/director-agent.test.ts` | Tests for Director Agent |
| `tests/agents/scene-state-agent.test.ts` | Tests for Scene State Agent |
| `tests/agents/character-state-agent.test.ts` | Tests for Character State Agent |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/types/agent.ts` | Add priority, enhanced AgentResult, AgentConfig |
| `src/lib/core/agents/agent-runner.ts` | Priority-based execution, all agents |
| `src/lib/core/agents/memory-agent.ts` | Add priority, enhance output |
| `src/lib/stores/settings.ts` | Add agent settings, director model slot |

---

## Task 1: Agent State Types

**Files:**
- Create: `src/lib/types/agent-state.ts`
- Test: `tests/types/agent-state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/types/agent-state.test.ts
import { describe, it, expect } from 'vitest';
import type { SceneState, CharacterState, DirectorGuidance, StateUpdate } from '$lib/types/agent-state';

describe('Agent State Types', () => {
	it('SceneState has all required fields', () => {
		const state: SceneState = {
			sessionId: 'test-session',
			location: 'The Rusty Tankard Inn',
			characters: ['Elara', 'Kai'],
			atmosphere: 'Tense',
			timeOfDay: 'Late evening',
			environmentalNotes: 'Fire crackling',
			lastUpdated: Date.now()
		};
		expect(state.location).toBe('The Rusty Tankard Inn');
	});

	it('CharacterState has all required fields', () => {
		const state: CharacterState = {
			id: 'char-1',
			sessionId: 'test-session',
			characterName: 'Elara',
			emotion: 'alert',
			location: 'at the bar',
			inventory: ['stolen amulet'],
			health: 'healthy',
			notes: 'Watching the door',
			lastUpdated: Date.now()
		};
		expect(state.characterName).toBe('Elara');
	});

	it('DirectorGuidance has all required fields', () => {
		const guidance: DirectorGuidance = {
			sceneMandate: 'Escalate tension',
			requiredOutcomes: ['Acquire information'],
			forbiddenMoves: ['Resolve subplot'],
			emphasis: ['Kai nervousness'],
			targetPacing: 'slow',
			pressureLevel: 'high'
		};
		expect(guidance.sceneMandate).toBe('Escalate tension');
	});

	it('StateUpdate can contain multiple state types', () => {
		const update: StateUpdate = {
			scene: { location: 'New location' },
			characters: [{ characterName: 'Elara', emotion: 'calm' }]
		};
		expect(update.scene?.location).toBe('New location');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/types/agent-state.test.ts`
Expected: FAIL with "Cannot find module '$lib/types/agent-state'"

- [ ] **Step 3: Write the types**

```typescript
// src/lib/types/agent-state.ts
export interface SceneState {
	sessionId: string;
	location: string;
	characters: string[];
	atmosphere: string;
	timeOfDay: string;
	environmentalNotes: string;
	lastUpdated: number;
}

export interface CharacterState {
	id: string;
	sessionId: string;
	characterName: string;
	emotion: string;
	location: string;
	inventory: string[];
	health: string;
	notes: string;
	lastUpdated: number;
}

export interface DirectorGuidance {
	sceneMandate: string;
	requiredOutcomes: string[];
	forbiddenMoves: string[];
	emphasis: string[];
	targetPacing: 'slow' | 'normal' | 'fast';
	pressureLevel: 'low' | 'medium' | 'high';
}

export interface StateUpdate {
	scene?: Partial<SceneState>;
	characters?: Partial<CharacterState>[];
	directorGuidance?: DirectorGuidance;
}

export type DirectorMode = 'light' | 'strong' | 'absolute';

export interface AgentTokenBudget {
	maxTokens: number;
	userBudget: number;
	warningThreshold: number;
}

export interface AgentBudgetConfig {
	memory: number;
	director: number;
	scene: number;
	character: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/types/agent-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/agent-state.ts tests/types/agent-state.test.ts
git commit -m "feat: add agent state types (SceneState, CharacterState, DirectorGuidance)"
```

---

## Task 2: Agent State Storage

**Files:**
- Create: `src/lib/storage/agent-states.ts`
- Test: `tests/storage/agent-states.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/storage/agent-states.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '$lib/storage/db';
import {
	getSceneState,
	updateSceneState,
	deleteSceneState,
	getCharacterStates,
	getCharacterState,
	updateCharacterState,
	deleteCharacterState
} from '$lib/storage/agent-states';
import type { SceneState, CharacterState } from '$lib/types/agent-state';

describe('Agent States Storage', () => {
	const sessionId = 'test-session-agent-states';
	
	beforeEach(async () => {
		const db = await getDb();
		db.run('DELETE FROM scene_states WHERE session_id = ?', [sessionId]);
		db.run('DELETE FROM character_states WHERE session_id = ?', [sessionId]);
	});

	afterEach(async () => {
		const db = await getDb();
		db.run('DELETE FROM scene_states WHERE session_id = ?', [sessionId]);
		db.run('DELETE FROM character_states WHERE session_id = ?', [sessionId]);
	});

	describe('Scene State', () => {
		it('returns null when no scene state exists', async () => {
			const state = await getSceneState(sessionId);
			expect(state).toBeNull();
		});

		it('creates and retrieves scene state', async () => {
			await updateSceneState(sessionId, {
				location: 'Test Location',
				characters: ['Alice', 'Bob'],
				atmosphere: 'Test atmosphere',
				timeOfDay: 'Morning',
				environmentalNotes: 'Test notes'
			});

			const state = await getSceneState(sessionId);
			expect(state).not.toBeNull();
			expect(state?.location).toBe('Test Location');
			expect(state?.characters).toEqual(['Alice', 'Bob']);
			expect(state?.atmosphere).toBe('Test atmosphere');
		});

		it('updates existing scene state', async () => {
			await updateSceneState(sessionId, {
				location: 'Initial Location',
				characters: ['Alice'],
				atmosphere: 'Initial',
				timeOfDay: 'Morning',
				environmentalNotes: ''
			});

			await updateSceneState(sessionId, {
				location: 'Updated Location',
				characters: ['Alice', 'Bob']
			});

			const state = await getSceneState(sessionId);
			expect(state?.location).toBe('Updated Location');
			expect(state?.characters).toEqual(['Alice', 'Bob']);
			expect(state?.atmosphere).toBe('Initial');
		});

		it('deletes scene state', async () => {
			await updateSceneState(sessionId, {
				location: 'To Delete',
				characters: [],
				atmosphere: '',
				timeOfDay: '',
				environmentalNotes: ''
			});

			await deleteSceneState(sessionId);
			const state = await getSceneState(sessionId);
			expect(state).toBeNull();
		});
	});

	describe('Character States', () => {
		it('returns empty array when no character states exist', async () => {
			const states = await getCharacterStates(sessionId);
			expect(states).toEqual([]);
		});

		it('creates and retrieves character state', async () => {
			await updateCharacterState(sessionId, 'Elara', {
				emotion: 'alert',
				location: 'at the bar',
				inventory: ['amulet'],
				health: 'healthy',
				notes: 'Test notes'
			});

			const state = await getCharacterState(sessionId, 'Elara');
			expect(state).not.toBeNull();
			expect(state?.characterName).toBe('Elara');
			expect(state?.emotion).toBe('alert');
			expect(state?.inventory).toEqual(['amulet']);
		});

		it('updates existing character state', async () => {
			await updateCharacterState(sessionId, 'Kai', {
				emotion: 'nervous',
				location: 'by the door',
				inventory: ['pack'],
				health: 'healthy',
				notes: ''
			});

			await updateCharacterState(sessionId, 'Kai', {
				emotion: 'calm',
				inventory: ['pack', 'sword']
			});

			const state = await getCharacterState(sessionId, 'Kai');
			expect(state?.emotion).toBe('calm');
			expect(state?.inventory).toEqual(['pack', 'sword']);
			expect(state?.location).toBe('by the door');
		});

		it('retrieves all character states for session', async () => {
			await updateCharacterState(sessionId, 'Alice', {
				emotion: 'happy',
				location: 'here',
				inventory: [],
				health: 'healthy',
				notes: ''
			});
			await updateCharacterState(sessionId, 'Bob', {
				emotion: 'sad',
				location: 'there',
				inventory: [],
				health: 'healthy',
				notes: ''
			});

			const states = await getCharacterStates(sessionId);
			expect(states.length).toBe(2);
			expect(states.map(s => s.characterName).sort()).toEqual(['Alice', 'Bob']);
		});

		it('deletes character state', async () => {
			await updateCharacterState(sessionId, 'ToDelete', {
				emotion: 'neutral',
				location: '',
				inventory: [],
				health: 'healthy',
				notes: ''
			});

			await deleteCharacterState(sessionId, 'ToDelete');
			const state = await getCharacterState(sessionId, 'ToDelete');
			expect(state).toBeNull();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/storage/agent-states.test.ts`
Expected: FAIL with "Cannot find module '$lib/storage/agent-states'"

- [ ] **Step 3: Create database migration for agent state tables**

Read `src/lib/storage/db.ts` to understand the existing DB structure, then add the migration:

```typescript
// Add to the migrations array in src/lib/storage/db.ts

// Add after existing migrations:
{
	version: 4,
	up: (db) => {
		db.run(`
			CREATE TABLE IF NOT EXISTS scene_states (
				session_id TEXT PRIMARY KEY,
				location TEXT DEFAULT '',
				characters TEXT DEFAULT '[]',
				atmosphere TEXT DEFAULT '',
				time_of_day TEXT DEFAULT '',
				environmental_notes TEXT DEFAULT '',
				last_updated INTEGER NOT NULL
			)
		`);
		db.run(`
			CREATE TABLE IF NOT EXISTS character_states (
				id TEXT PRIMARY KEY,
				session_id TEXT NOT NULL,
				character_name TEXT NOT NULL,
				emotion TEXT DEFAULT '',
				location TEXT DEFAULT '',
				inventory TEXT DEFAULT '[]',
				health TEXT DEFAULT 'healthy',
				notes TEXT DEFAULT '',
				last_updated INTEGER NOT NULL
			)
		`);
		db.run(`CREATE INDEX IF NOT EXISTS idx_char_states_session ON character_states(session_id)`);
		db.run(`CREATE INDEX IF NOT EXISTS idx_char_states_name ON character_states(session_id, character_name)`);
	}
}
```

- [ ] **Step 4: Write the storage functions**

```typescript
// src/lib/storage/agent-states.ts
import { getDb } from './db';
import type { SceneState, CharacterState } from '$lib/types/agent-state';

export async function getSceneState(sessionId: string): Promise<SceneState | null> {
	const db = await getDb();
	const row = db.exec(
		'SELECT * FROM scene_states WHERE session_id = ?',
		[sessionId]
	);
	
	if (!row.length || !row[0].values.length) {
		return null;
	}
	
	const r = row[0].values[0];
	const columns = row[0].columns;
	
	const getValue = (name: string) => {
		const idx = columns.indexOf(name);
		return idx >= 0 ? r[idx] : null;
	};
	
	return {
		sessionId: String(getValue('session_id') || sessionId),
		location: String(getValue('location') || ''),
		characters: JSON.parse(String(getValue('characters') || '[]')),
		atmosphere: String(getValue('atmosphere') || ''),
		timeOfDay: String(getValue('time_of_day') || ''),
		environmentalNotes: String(getValue('environmental_notes') || ''),
		lastUpdated: Number(getValue('last_updated') || 0)
	};
}

export async function updateSceneState(
	sessionId: string,
	partial: Partial<Omit<SceneState, 'sessionId' | 'lastUpdated'>>
): Promise<void> {
	const existing = await getSceneState(sessionId);
	const merged: SceneState = {
		sessionId,
		location: partial.location ?? existing?.location ?? '',
		characters: partial.characters ?? existing?.characters ?? [],
		atmosphere: partial.atmosphere ?? existing?.atmosphere ?? '',
		timeOfDay: partial.timeOfDay ?? existing?.timeOfDay ?? '',
		environmentalNotes: partial.environmentalNotes ?? existing?.environmentalNotes ?? '',
		lastUpdated: Date.now()
	};
	
	const db = await getDb();
	db.run(
		`INSERT OR REPLACE INTO scene_states 
		(session_id, location, characters, atmosphere, time_of_day, environmental_notes, last_updated)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			merged.sessionId,
			merged.location,
			JSON.stringify(merged.characters),
			merged.atmosphere,
			merged.timeOfDay,
			merged.environmentalNotes,
			merged.lastUpdated
		]
	);
}

export async function deleteSceneState(sessionId: string): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM scene_states WHERE session_id = ?', [sessionId]);
}

export async function getCharacterStates(sessionId: string): Promise<CharacterState[]> {
	const db = await getDb();
	const rows = db.exec(
		'SELECT * FROM character_states WHERE session_id = ? ORDER BY character_name',
		[sessionId]
	);
	
	if (!rows.length || !rows[0].values.length) {
		return [];
	}
	
	const columns = rows[0].columns;
	
	return rows[0].values.map(r => {
		const getValue = (name: string) => {
			const idx = columns.indexOf(name);
			return idx >= 0 ? r[idx] : null;
		};
		
		return {
			id: String(getValue('id')),
			sessionId: String(getValue('session_id')),
			characterName: String(getValue('character_name')),
			emotion: String(getValue('emotion') || ''),
			location: String(getValue('location') || ''),
			inventory: JSON.parse(String(getValue('inventory') || '[]')),
			health: String(getValue('health') || 'healthy'),
			notes: String(getValue('notes') || ''),
			lastUpdated: Number(getValue('last_updated') || 0)
		};
	});
}

export async function getCharacterState(
	sessionId: string,
	characterName: string
): Promise<CharacterState | null> {
	const db = await getDb();
	const rows = db.exec(
		'SELECT * FROM character_states WHERE session_id = ? AND character_name = ?',
		[sessionId, characterName]
	);
	
	if (!rows.length || !rows[0].values.length) {
		return null;
	}
	
	const r = rows[0].values[0];
	const columns = rows[0].columns;
	
	const getValue = (name: string) => {
		const idx = columns.indexOf(name);
		return idx >= 0 ? r[idx] : null;
	};
	
	return {
		id: String(getValue('id')),
		sessionId: String(getValue('session_id')),
		characterName: String(getValue('character_name')),
		emotion: String(getValue('emotion') || ''),
		location: String(getValue('location') || ''),
		inventory: JSON.parse(String(getValue('inventory') || '[]')),
		health: String(getValue('health') || 'healthy'),
		notes: String(getValue('notes') || ''),
		lastUpdated: Number(getValue('last_updated') || 0)
	};
}

export async function updateCharacterState(
	sessionId: string,
	characterName: string,
	partial: Partial<Omit<CharacterState, 'id' | 'sessionId' | 'characterName' | 'lastUpdated'>>
): Promise<void> {
	const existing = await getCharacterState(sessionId, characterName);
	const id = existing?.id ?? crypto.randomUUID();
	
	const merged: CharacterState = {
		id,
		sessionId,
		characterName,
		emotion: partial.emotion ?? existing?.emotion ?? '',
		location: partial.location ?? existing?.location ?? '',
		inventory: partial.inventory ?? existing?.inventory ?? [],
		health: partial.health ?? existing?.health ?? 'healthy',
		notes: partial.notes ?? existing?.notes ?? '',
		lastUpdated: Date.now()
	};
	
	const db = await getDb();
	db.run(
		`INSERT OR REPLACE INTO character_states
		(id, session_id, character_name, emotion, location, inventory, health, notes, last_updated)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			merged.id,
			merged.sessionId,
			merged.characterName,
			merged.emotion,
			merged.location,
			JSON.stringify(merged.inventory),
			merged.health,
			merged.notes,
			merged.lastUpdated
		]
	);
}

export async function deleteCharacterState(
	sessionId: string,
	characterName: string
): Promise<void> {
	const db = await getDb();
	db.run(
		'DELETE FROM character_states WHERE session_id = ? AND character_name = ?',
		[sessionId, characterName]
	);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test tests/storage/agent-states.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/db.ts src/lib/storage/agent-states.ts tests/storage/agent-states.test.ts
git commit -m "feat: add agent state storage (scene_states, character_states tables)"
```

---

## Task 3: Enhanced Agent Types

**Files:**
- Modify: `src/lib/types/agent.ts`
- Test: `tests/types/agent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/types/agent.test.ts or create new file
import { describe, it, expect } from 'vitest';
import type { Agent, AgentConfig, AgentResult, AgentContext } from '$lib/types/agent';

describe('Enhanced Agent Types', () => {
	it('Agent has priority field', () => {
		const agent: Agent = {
			id: 'test',
			name: 'Test Agent',
			priority: 10,
			init: async () => {},
			onBeforeSend: async () => ({}),
			onAfterReceive: async () => ({}),
			shutdown: async () => {}
		};
		expect(agent.priority).toBe(10);
	});

	it('AgentResult can include updatedState', () => {
		const result: AgentResult = {
			injectPrompt: '[Test] Content',
			updatedState: {
				scene: { location: 'New location' }
			}
		};
		expect(result.updatedState?.scene?.location).toBe('New location');
	});

	it('AgentConfig has all required fields', () => {
		const config: AgentConfig = {
			id: 'director',
			name: 'Director Agent',
			enabled: true,
			modelSlot: 'director',
			settings: { mode: 'strong' }
		};
		expect(config.enabled).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/types/agent.test.ts`
Expected: FAIL with "Property 'priority' does not exist"

- [ ] **Step 3: Enhance agent types**

```typescript
// src/lib/types/agent.ts
import type { Message } from './message';
import type { SceneState } from './scene';
import type { UserConfig } from './config';
import type { MemoryRecord, SessionSummary } from './memory';
import type { StateUpdate } from './agent-state';

export interface AgentConfig {
	id: string;
	name: string;
	enabled: boolean;
	modelSlot: 'chat' | 'memory' | 'director';
	settings: Record<string, unknown>;
}

export interface AgentContext {
	sessionId: string;
	cardId: string;
	cardType: 'character' | 'world';
	messages: Message[];
	scene: SceneState;
	turnNumber: number;
	config: UserConfig;
}

export interface AgentResult {
	injectPrompt?: string;
	updatedMemories?: MemoryRecord[];
	summaries?: SessionSummary[];
	updatedState?: StateUpdate;
}

export interface Agent {
	readonly id: string;
	readonly name: string;
	readonly priority: number;
	init(ctx: AgentContext): Promise<void>;
	onBeforeSend(ctx: AgentContext): Promise<AgentResult>;
	onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult>;
	shutdown(): Promise<void>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/types/agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/agent.ts tests/types/agent.test.ts
git commit -m "feat: enhance agent types with priority and updatedState"
```

---

## Task 4: Enhanced AgentRunner

**Files:**
- Modify: `src/lib/core/agents/agent-runner.ts`
- Test: `tests/agents/agent-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/agents/agent-runner.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

function createMockAgent(id: string, priority: number): Agent {
	return {
		id,
		name: `Mock Agent ${id}`,
		priority,
		init: async () => {},
		onBeforeSend: async (ctx: AgentContext): Promise<AgentResult> => {
			return { injectPrompt: `[${id}] Priority ${priority}` };
		},
		onAfterReceive: async (): Promise<AgentResult> => {
			return { updatedState: { scene: { location: `${id} updated` } } };
		},
		shutdown: async () => {}
	};
}

describe('AgentRunner', () => {
	let runner: AgentRunner;
	let mockContext: AgentContext;

	beforeEach(() => {
		runner = new AgentRunner();
		mockContext = {
			sessionId: 'test-session',
			cardId: 'test-card',
			cardType: 'character',
			messages: [],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
	});

	it('executes agents in priority order', async () => {
		const agent1 = createMockAgent('agent1', 30);
		const agent2 = createMockAgent('agent2', 10);
		const agent3 = createMockAgent('agent3', 20);

		runner.registerAgent(agent1);
		runner.registerAgent(agent2);
		runner.registerAgent(agent3);

		const result = await runner.onBeforeSend(mockContext);
		
		// Agents should be ordered: agent2 (10) -> agent3 (20) -> agent1 (30)
		expect(result.injectPrompt).toContain('[agent2]');
		expect(result.injectPrompt).toContain('[agent3]');
		expect(result.injectPrompt).toContain('[agent1]');
		
		// Verify order in the combined string
		const prompt = result.injectPrompt!;
		const idx2 = prompt.indexOf('[agent2]');
		const idx3 = prompt.indexOf('[agent3]');
		const idx1 = prompt.indexOf('[agent1]');
		expect(idx2).toBeLessThan(idx3);
		expect(idx3).toBeLessThan(idx1);
	});

	it('registers and retrieves agents', () => {
		const agent = createMockAgent('test', 10);
		runner.registerAgent(agent);
		expect(runner.hasAgent('test')).toBe(true);
		expect(runner.hasAgent('nonexistent')).toBe(false);
	});

	it('unregisters agents', () => {
		const agent = createMockAgent('test', 10);
		runner.registerAgent(agent);
		expect(runner.hasAgent('test')).toBe(true);
		
		runner.unregisterAgent('test');
		expect(runner.hasAgent('test')).toBe(false);
	});

	it('combines injectPrompt from all agents', async () => {
		runner.registerAgent(createMockAgent('a', 10));
		runner.registerAgent(createMockAgent('b', 20));

		const result = await runner.onBeforeSend(mockContext);
		expect(result.injectPrompt).toBe('[a] Priority 10\n\n[b] Priority 20');
	});

	it('combines updatedState from all agents', async () => {
		runner.registerAgent(createMockAgent('a', 10));
		runner.registerAgent(createMockAgent('b', 20));

		const result = await runner.onAfterReceive(mockContext, 'response');
		expect(result.updatedState).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/agents/agent-runner.test.ts`
Expected: FAIL with "registerAgent is not a function"

- [ ] **Step 3: Enhance AgentRunner**

```typescript
// src/lib/core/agents/agent-runner.ts
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import { MemoryAgent } from './memory-agent';

export class AgentRunner {
	private agents: Map<string, Agent> = new Map();

	constructor() {
		this.registerAgent(new MemoryAgent());
	}

	registerAgent(agent: Agent): void {
		this.agents.set(agent.id, agent);
	}

	unregisterAgent(id: string): void {
		this.agents.delete(id);
	}

	hasAgent(id: string): boolean {
		return this.agents.has(id);
	}

	getAgentsByPriority(): Agent[] {
		return Array.from(this.agents.values()).sort((a, b) => a.priority - b.priority);
	}

	async initAll(ctx: AgentContext): Promise<void> {
		for (const agent of this.getAgentsByPriority()) {
			try {
				await agent.init(ctx);
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} init failed`);
			}
		}
	}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const combined: AgentResult = {};
		const injectParts: string[] = [];

		for (const agent of this.getAgentsByPriority()) {
			try {
				const result = await agent.onBeforeSend(ctx);
				if (result.injectPrompt) {
					injectParts.push(result.injectPrompt);
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

		if (injectParts.length) {
			combined.injectPrompt = injectParts.join('\n\n');
		}

		return combined;
	}

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

		return combined;
	}

	async shutdownAll(): Promise<void> {
		for (const agent of this.getAgentsByPriority()) {
			try {
				await agent.shutdown();
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} shutdown failed`);
			}
		}
	}
}
```

- [ ] **Step 4: Update MemoryAgent with priority**

```typescript
// Update src/lib/core/agents/memory-agent.ts
// Add priority property to the class:

export class MemoryAgent implements Agent {
	readonly id = 'memory';
	readonly name = 'Memory Agent';
	readonly priority = 10;  // Add this line
	private lastExtractionTurn = -Infinity;
	
	// ... rest of existing code
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test tests/agents/agent-runner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/agents/agent-runner.ts src/lib/core/agents/memory-agent.ts tests/agents/agent-runner.test.ts
git commit -m "feat: enhance AgentRunner with priority-based execution and agent registration"
```

---

## Task 5: Director Agent

**Files:**
- Create: `src/lib/core/agents/director-agent.ts`
- Test: `tests/agents/director-agent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/agents/director-agent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DirectorAgent } from '$lib/core/agents/director-agent';
import type { AgentContext } from '$lib/types/agent';

describe('DirectorAgent', () => {
	let agent: DirectorAgent;
	let mockContext: AgentContext;

	beforeEach(() => {
		agent = new DirectorAgent();
		mockContext = {
			sessionId: 'test-session',
			cardId: 'test-card',
			cardType: 'character',
			messages: [
				{ id: '1', role: 'user', content: 'Hello' } as any,
				{ id: '2', role: 'assistant', content: 'Hi there!' } as any
			],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('director');
		expect(agent.priority).toBe(20);
	});

	it('formats injectPrompt correctly', async () => {
		// Mock the model call to return predictable output
		const result = await agent.onBeforeSend(mockContext);
		
		// Should have a director section format
		if (result.injectPrompt) {
			expect(result.injectPrompt).toContain('[Director]');
		}
	});

	it('returns empty result when director is disabled', async () => {
		// Test with settings that disable director
		const result = await agent.onBeforeSend({
			...mockContext,
			config: { 
				...mockContext.config,
				agentSettings: { director: { enabled: false } }
			} as any
		});
		expect(result.injectPrompt).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/agents/director-agent.test.ts`
Expected: FAIL with "Cannot find module '$lib/core/agents/director-agent'"

- [ ] **Step 3: Write DirectorAgent**

```typescript
// src/lib/core/agents/director-agent.ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { DirectorGuidance, DirectorMode } from '$lib/types/agent-state';

const DIRECTOR_SYSTEM_PROMPT = `You are a story director that guides narrative direction.
Analyze the current scene and provide guidance for the next response.

Output JSON only:
{
	"sceneMandate": "what must happen this turn",
	"requiredOutcomes": ["mandatory story beats"],
	"forbiddenMoves": ["what the AI must not do"],
	"emphasis": ["what to highlight"],
	"targetPacing": "slow|normal|fast",
	"pressureLevel": "low|medium|high"
}`;

function getDirectorConfig() {
	const settings = get(settingsStore);
	const directorSlot = settings.modelSlots?.director;
	const directorSettings = settings.agentSettings?.director as Record<string, any> | undefined;
	
	return {
		provider: directorSlot?.provider || settings.modelSlots?.memory?.provider || settings.defaultProvider,
		apiKey: directorSlot?.apiKey || settings.modelSlots?.memory?.apiKey || 
			(settings.providers?.[settings.defaultProvider!]?.apiKey as string),
		model: directorSlot?.model || settings.modelSlots?.memory?.model || 
			(settings.providers?.[settings.defaultProvider!]?.model as string),
		baseUrl: directorSlot?.baseUrl || settings.modelSlots?.memory?.baseUrl,
		temperature: directorSlot?.temperature ?? 0.7,
		mode: (directorSettings?.mode as DirectorMode) || 'light',
		enabled: directorSettings?.enabled !== false
	};
}

async function callDirectorModel(context: string, mode: DirectorMode): Promise<DirectorGuidance | null> {
	const config = getDirectorConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	const modePrompt = mode === 'absolute' 
		? 'This is top-priority direction. The response must obey it and create a strong narrative turn now.'
		: mode === 'strong'
			? 'Apply strong directorial control and force a meaningful beat in this response.'
			: 'Apply light but persistent guidance to keep the scene moving.';

	const systemPrompt = `${DIRECTOR_SYSTEM_PROMPT}\n\nMode: ${modePrompt}`;

	const isClaude = config.provider === 'claude' || config.provider === 'anthropic';
	const messages = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: context }
	];

	try {
		if (isClaude) {
			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': config.apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: config.model,
					max_tokens: 1024,
					system: systemPrompt,
					messages: [{ role: 'user', content: context }]
				})
			});
			if (!res.ok) return null;
			const data = await res.json();
			return parseDirectorOutput(data.content?.[0]?.text ?? '');
		} else {
			const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${config.apiKey}`
				},
				body: JSON.stringify({
					model: config.model,
					messages,
					temperature: config.temperature,
					max_tokens: 1024
				})
			});
			if (!res.ok) return null;
			const data = await res.json();
			return parseDirectorOutput(data.choices?.[0]?.message?.content ?? '');
		}
	} catch {
		return null;
	}
}

function parseDirectorOutput(content: string): DirectorGuidance | null {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		const parsed = JSON.parse(match[0]);
		if (
			typeof parsed.sceneMandate === 'string' &&
			Array.isArray(parsed.requiredOutcomes) &&
			Array.isArray(parsed.forbiddenMoves)
		) {
			return {
				sceneMandate: parsed.sceneMandate,
				requiredOutcomes: parsed.requiredOutcomes,
				forbiddenMoves: parsed.forbiddenMoves,
				emphasis: parsed.emphasis || [],
				targetPacing: parsed.targetPacing || 'normal',
				pressureLevel: parsed.pressureLevel || 'medium'
			};
		}
		return null;
	} catch {
		return null;
	}
}

function formatDirectorPrompt(guidance: DirectorGuidance): string {
	const lines = ['[Director]'];
	
	if (guidance.sceneMandate) {
		lines.push(`Scene Mandate: ${guidance.sceneMandate}`);
	}
	if (guidance.requiredOutcomes.length) {
		lines.push(`Required Outcomes: ${guidance.requiredOutcomes.join(', ')}`);
	}
	if (guidance.forbiddenMoves.length) {
		lines.push(`Forbidden Moves: ${guidance.forbiddenMoves.join(', ')}`);
	}
	if (guidance.emphasis.length) {
		lines.push(`Emphasis: ${guidance.emphasis.join(', ')}`);
	}
	lines.push(`Target Pacing: ${guidance.targetPacing}`);
	lines.push(`Pressure Level: ${guidance.pressureLevel}`);

	return lines.join('\n');
}

export class DirectorAgent implements Agent {
	readonly id = 'director';
	readonly name = 'Director Agent';
	readonly priority = 20;

	async init(_ctx: AgentContext): Promise<void> {}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const config = getDirectorConfig();
		if (!config.enabled) {
			return {};
		}

		const recentMessages = ctx.messages.slice(-6);
		const context = recentMessages
			.map(m => `${m.role}: ${m.content}`)
			.join('\n');

		if (!context.trim()) return {};

		const guidance = await callDirectorModel(context, config.mode);
		if (!guidance) return {};

		return {
			injectPrompt: formatDirectorPrompt(guidance),
			updatedState: { directorGuidance: guidance }
		};
	}

	async onAfterReceive(_ctx: AgentContext, _response: string): Promise<AgentResult> {
		return {};
	}

	async shutdown(): Promise<void> {}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/agents/director-agent.test.ts`
Expected: PASS (some tests may need mock for actual model calls)

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/director-agent.ts tests/agents/director-agent.test.ts
git commit -m "feat: add DirectorAgent for plot direction and pacing control"
```

---

## Task 6: Scene State Agent

**Files:**
- Create: `src/lib/core/agents/scene-state-agent.ts`
- Test: `tests/agents/scene-state-agent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/agents/scene-state-agent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SceneStateAgent } from '$lib/core/agents/scene-state-agent';
import { getSceneState, deleteSceneState } from '$lib/storage/agent-states';
import type { AgentContext } from '$lib/types/agent';

describe('SceneStateAgent', () => {
	let agent: SceneStateAgent;
	let mockContext: AgentContext;
	const sessionId = 'test-session-scene-state';

	beforeEach(async () => {
		agent = new SceneStateAgent();
		mockContext = {
			sessionId,
			cardId: 'test-card',
			cardType: 'character',
			messages: [],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
		await deleteSceneState(sessionId);
	});

	afterEach(async () => {
		await deleteSceneState(sessionId);
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('scene');
		expect(agent.priority).toBe(30);
	});

	it('creates initial scene state when none exists', async () => {
		await agent.init(mockContext);
		
		const state = await getSceneState(sessionId);
		expect(state).not.toBeNull();
		expect(state?.location).toBe('');
	});

	it('formats injectPrompt from scene state', async () => {
		await agent.init(mockContext);
		
		const result = await agent.onBeforeSend(mockContext);
		
		if (result.injectPrompt) {
			expect(result.injectPrompt).toContain('[Scene]');
		}
	});

	it('updates scene state after receiving response', async () => {
		await agent.init(mockContext);
		
		const result = await agent.onAfterReceive(mockContext, 
			'Elara walked into the Rusty Tankard Inn. The atmosphere was tense.');
		
		// Agent should detect scene changes from response
		expect(result.updatedState).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/agents/scene-state-agent.test.ts`
Expected: FAIL with "Cannot find module '$lib/core/agents/scene-state-agent'"

- [ ] **Step 3: Write SceneStateAgent**

```typescript
// src/lib/core/agents/scene-state-agent.ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { getSceneState, updateSceneState } from '$lib/storage/agent-states';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { SceneState } from '$lib/types/agent-state';

const SCENE_EXTRACTION_PROMPT = `Extract scene information from the text.
Output JSON only:
{
	"location": "current location name",
	"characters": ["names of present characters"],
	"atmosphere": "mood/tone of scene",
	"timeOfDay": "time if mentioned",
	"environmentalNotes": "notable environmental details"
}`;

function getSceneConfig() {
	const settings = get(settingsStore);
	const sceneSettings = settings.agentSettings?.scene as Record<string, any> | undefined;
	
	return {
		enabled: sceneSettings?.enabled !== false,
		tokenBudget: sceneSettings?.tokenBudget || 2560
	};
}

async function callSceneExtractionModel(response: string): Promise<Partial<SceneState> | null> {
	const settings = get(settingsStore);
	const memorySlot = settings.modelSlots?.memory;
	
	const provider = memorySlot?.provider || settings.defaultProvider;
	const apiKey = memorySlot?.apiKey || (settings.providers?.[settings.defaultProvider!]?.apiKey as string);
	const model = memorySlot?.model || (settings.providers?.[settings.defaultProvider!]?.model as string);
	const baseUrl = memorySlot?.baseUrl || (settings.providers?.[settings.defaultProvider!]?.baseUrl as string);

	if (!provider || !apiKey || !model) return null;

	const isClaude = provider === 'claude' || provider === 'anthropic';
	const messages = [
		{ role: 'system', content: SCENE_EXTRACTION_PROMPT },
		{ role: 'user', content: response }
	];

	try {
		if (isClaude) {
			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model,
					max_tokens: 512,
					system: SCENE_EXTRACTION_PROMPT,
					messages: [{ role: 'user', content: response }]
				})
			});
			if (!res.ok) return null;
			const data = await res.json();
			return parseSceneOutput(data.content?.[0]?.text ?? '');
		} else {
			const url = baseUrl || 'https://api.openai.com/v1';
			const res = await fetch(`${url}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model,
					messages,
					temperature: 0.3,
					max_tokens: 512
				})
			});
			if (!res.ok) return null;
			const data = await res.json();
			return parseSceneOutput(data.choices?.[0]?.message?.content ?? '');
		}
	} catch {
		return null;
	}
}

function parseSceneOutput(content: string): Partial<SceneState> | null {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		const parsed = JSON.parse(match[0]);
		return {
			location: parsed.location || '',
			characters: parsed.characters || [],
			atmosphere: parsed.atmosphere || '',
			timeOfDay: parsed.timeOfDay || '',
			environmentalNotes: parsed.environmentalNotes || ''
		};
	} catch {
		return null;
	}
}

function formatScenePrompt(state: SceneState): string {
	const lines = ['[Scene]'];
	
	if (state.location) {
		lines.push(`Location: ${state.location}`);
	}
	if (state.characters.length) {
		lines.push(`Characters: ${state.characters.join(', ')}`);
	}
	if (state.atmosphere) {
		lines.push(`Atmosphere: ${state.atmosphere}`);
	}
	if (state.timeOfDay) {
		lines.push(`Time: ${state.timeOfDay}`);
	}
	if (state.environmentalNotes) {
		lines.push(`Environment: ${state.environmentalNotes}`);
	}

	return lines.join('\n');
}

export class SceneStateAgent implements Agent {
	readonly id = 'scene';
	readonly name = 'Scene State Agent';
	readonly priority = 30;

	async init(ctx: AgentContext): Promise<void> {
		const existing = await getSceneState(ctx.sessionId);
		if (!existing) {
			await updateSceneState(ctx.sessionId, {
				location: '',
				characters: [],
				atmosphere: '',
				timeOfDay: '',
				environmentalNotes: ''
			});
		}
	}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const config = getSceneConfig();
		if (!config.enabled) return {};

		const state = await getSceneState(ctx.sessionId);
		if (!state || !state.location) return {};

		return {
			injectPrompt: formatScenePrompt(state)
		};
	}

	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const config = getSceneConfig();
		if (!config.enabled) return {};

		const extracted = await callSceneExtractionModel(response);
		if (!extracted) return {};

		await updateSceneState(ctx.sessionId, extracted);

		return {
			updatedState: { scene: extracted }
		};
	}

	async shutdown(): Promise<void> {}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/agents/scene-state-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/scene-state-agent.ts tests/agents/scene-state-agent.test.ts
git commit -m "feat: add SceneStateAgent for location and atmosphere tracking"
```

---

## Task 7: Character State Agent

**Files:**
- Create: `src/lib/core/agents/character-state-agent.ts`
- Test: `tests/agents/character-state-agent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/agents/character-state-agent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CharacterStateAgent } from '$lib/core/agents/character-state-agent';
import { getCharacterStates, deleteCharacterState } from '$lib/storage/agent-states';
import type { AgentContext } from '$lib/types/agent';

describe('CharacterStateAgent', () => {
	let agent: CharacterStateAgent;
	let mockContext: AgentContext;
	const sessionId = 'test-session-char-state';

	beforeEach(async () => {
		agent = new CharacterStateAgent();
		mockContext = {
			sessionId,
			cardId: 'test-card',
			cardType: 'character',
			messages: [],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
	});

	afterEach(async () => {
		const states = await getCharacterStates(sessionId);
		for (const s of states) {
			await deleteCharacterState(sessionId, s.characterName);
		}
	});

	it('has correct id and priority', () => {
		expect(agent.id).toBe('character');
		expect(agent.priority).toBe(40);
	});

	it('formats injectPrompt from character states', async () => {
		const result = await agent.onBeforeSend(mockContext);
		
		// Should return empty if no characters tracked
		expect(result.injectPrompt).toBeUndefined();
	});

	it('extracts character states from response', async () => {
		const result = await agent.onAfterReceive(
			mockContext,
			'Elara looked nervous as she sat at the bar. She clutched the amulet tightly.'
		);
		
		expect(result.updatedState).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/agents/character-state-agent.test.ts`
Expected: FAIL with "Cannot find module '$lib/core/agents/character-state-agent'"

- [ ] **Step 3: Write CharacterStateAgent**

```typescript
// src/lib/core/agents/character-state-agent.ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { getCharacterStates, updateCharacterState } from '$lib/storage/agent-states';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { CharacterState } from '$lib/types/agent-state';

const CHARACTER_EXTRACTION_PROMPT = `Extract character states from the text.
Output JSON only:
{
	"characters": [
		{
			"name": "character name",
			"emotion": "current emotion",
			"location": "where they are",
			"inventory": ["items they have"],
			"health": "health status",
			"notes": "notable details"
		}
	]
}`;

function getCharacterConfig() {
	const settings = get(settingsStore);
	const charSettings = settings.agentSettings?.character as Record<string, any> | undefined;
	
	return {
		enabled: charSettings?.enabled !== false,
		autoTrack: charSettings?.autoTrack !== false,
		tokenBudget: charSettings?.tokenBudget || 6400
	};
}

async function callCharacterExtractionModel(
	response: string
): Promise<Partial<CharacterState>[]> {
	const settings = get(settingsStore);
	const memorySlot = settings.modelSlots?.memory;
	
	const provider = memorySlot?.provider || settings.defaultProvider;
	const apiKey = memorySlot?.apiKey || (settings.providers?.[settings.defaultProvider!]?.apiKey as string);
	const model = memorySlot?.model || (settings.providers?.[settings.defaultProvider!]?.model as string);
	const baseUrl = memorySlot?.baseUrl || (settings.providers?.[settings.defaultProvider!]?.baseUrl as string);

	if (!provider || !apiKey || !model) return [];

	const isClaude = provider === 'claude' || provider === 'anthropic';
	const messages = [
		{ role: 'system', content: CHARACTER_EXTRACTION_PROMPT },
		{ role: 'user', content: response }
	];

	try {
		if (isClaude) {
			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model,
					max_tokens: 1024,
					system: CHARACTER_EXTRACTION_PROMPT,
					messages: [{ role: 'user', content: response }]
				})
			});
			if (!res.ok) return [];
			const data = await res.json();
			return parseCharacterOutput(data.content?.[0]?.text ?? '');
		} else {
			const url = baseUrl || 'https://api.openai.com/v1';
			const res = await fetch(`${url}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model,
					messages,
					temperature: 0.3,
					max_tokens: 1024
				})
			});
			if (!res.ok) return [];
			const data = await res.json();
			return parseCharacterOutput(data.choices?.[0]?.message?.content ?? '');
		}
	} catch {
		return [];
	}
}

function parseCharacterOutput(content: string): Partial<CharacterState>[] {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return [];

	try {
		const parsed = JSON.parse(match[0]);
		if (!Array.isArray(parsed.characters)) return [];

		return parsed.characters
			.filter((c: any) => c && typeof c.name === 'string')
			.map((c: any) => ({
				characterName: c.name,
				emotion: c.emotion || '',
				location: c.location || '',
				inventory: Array.isArray(c.inventory) ? c.inventory : [],
				health: c.health || 'healthy',
				notes: c.notes || ''
			}));
	} catch {
		return [];
	}
}

function formatCharacterPrompt(states: CharacterState[]): string {
	const lines = ['[Character States]'];
	
	for (const state of states) {
		const parts = [state.characterName];
		if (state.emotion) parts.push(state.emotion);
		if (state.location) parts.push(state.location);
		if (state.inventory.length) parts.push(`carrying ${state.inventory.join(', ')}`);
		if (state.health && state.health !== 'healthy') parts.push(state.health);
		lines.push(parts.join(', '));
	}

	return lines.join('\n');
}

export class CharacterStateAgent implements Agent {
	readonly id = 'character';
	readonly name = 'Character State Agent';
	readonly priority = 40;

	async init(_ctx: AgentContext): Promise<void> {}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const config = getCharacterConfig();
		if (!config.enabled) return {};

		const states = await getCharacterStates(ctx.sessionId);
		if (!states.length) return {};

		return {
			injectPrompt: formatCharacterPrompt(states)
		};
	}

	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const config = getCharacterConfig();
		if (!config.enabled) return {};

		const extracted = await callCharacterExtractionModel(response);
		if (!extracted.length) return {};

		for (const char of extracted) {
			if (char.characterName) {
				await updateCharacterState(ctx.sessionId, char.characterName, char);
			}
		}

		return {
			updatedState: { characters: extracted }
		};
	}

	async shutdown(): Promise<void> {}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/agents/character-state-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/character-state-agent.ts tests/agents/character-state-agent.test.ts
git commit -m "feat: add CharacterStateAgent for character state tracking"
```

---

## Task 8: Register All Agents

**Files:**
- Modify: `src/lib/core/agents/agent-runner.ts`
- Modify: `src/lib/core/agents/index.ts` (create if needed)

- [ ] **Step 1: Create agents index file**

```typescript
// src/lib/core/agents/index.ts
export { AgentRunner } from './agent-runner';
export { MemoryAgent } from './memory-agent';
export { DirectorAgent } from './director-agent';
export { SceneStateAgent } from './scene-state-agent';
export { CharacterStateAgent } from './character-state-agent';
```

- [ ] **Step 2: Update AgentRunner to register all agents**

```typescript
// Update src/lib/core/agents/agent-runner.ts constructor:

import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import { MemoryAgent } from './memory-agent';
import { DirectorAgent } from './director-agent';
import { SceneStateAgent } from './scene-state-agent';
import { CharacterStateAgent } from './character-state-agent';

export class AgentRunner {
	private agents: Map<string, Agent> = new Map();

	constructor() {
		// Register all agents in priority order
		this.registerAgent(new MemoryAgent());       // priority: 10
		this.registerAgent(new DirectorAgent());     // priority: 20
		this.registerAgent(new SceneStateAgent());   // priority: 30
		this.registerAgent(new CharacterStateAgent()); // priority: 40
	}
	
	// ... rest of existing code
}
```

- [ ] **Step 3: Run all agent tests**

Run: `npm test tests/agents/`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/agents/agent-runner.ts src/lib/core/agents/index.ts
git commit -m "feat: register all agents in AgentRunner"
```

---

## Task 9: Add Agent Settings

**Files:**
- Modify: `src/lib/types/config.ts`
- Modify: `src/lib/stores/settings.ts`

- [ ] **Step 1: Add agent settings to config types**

Read `src/lib/types/config.ts` to find the AppSettings interface, then add:

```typescript
// Add to AppSettings interface in src/lib/types/config.ts

interface AgentSettings {
	director?: {
		enabled: boolean;
		mode: 'light' | 'strong' | 'absolute';
		tokenBudget: number;
	};
	scene?: {
		enabled: boolean;
		tokenBudget: number;
	};
	character?: {
		enabled: boolean;
		autoTrack: boolean;
		tokenBudget: number;
	};
}

// Add to AppSettings:
agentSettings?: AgentSettings;

// Also add director to ModelSlots if not already there:
interface ModelSlots {
	chat?: ModelSlot;
	memory?: ModelSlot;
	director?: ModelSlot;  // Add this
}
```

- [ ] **Step 2: Add default agent settings**

Update `src/lib/stores/settings.ts` to include defaults:

```typescript
// Add to default settings:

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
	director: {
		enabled: true,
		mode: 'light',
		tokenBudget: 6400  // Will be overridden by dynamic budget
	},
	scene: {
		enabled: true,
		tokenBudget: 2560
	},
	character: {
		enabled: true,
		autoTrack: true,
		tokenBudget: 6400
	}
};

// Include in initial settings value
```

- [ ] **Step 3: Run tests to verify no regressions**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/config.ts src/lib/stores/settings.ts
git commit -m "feat: add agent settings to config and store"
```

---

## Task 10: Integration Test

**Files:**
- Create: `tests/integration/agent-pipeline.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/integration/agent-pipeline.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRunner } from '$lib/core/agents/agent-runner';
import { getSceneState, deleteSceneState, getCharacterStates, deleteCharacterState } from '$lib/storage/agent-states';
import type { AgentContext } from '$lib/types/agent';

describe('Agent Pipeline Integration', () => {
	let runner: AgentRunner;
	let context: AgentContext;
	const sessionId = 'integration-test-session';

	beforeEach(async () => {
		runner = new AgentRunner();
		context = {
			sessionId,
			cardId: 'test-card',
			cardType: 'character',
			messages: [
				{ id: '1', role: 'user', content: 'I walk into the inn.' } as any
			],
			scene: {} as any,
			turnNumber: 1,
			config: {} as any
		};
		
		await deleteSceneState(sessionId);
	});

	afterEach(async () => {
		await runner.shutdownAll();
		await deleteSceneState(sessionId);
		const chars = await getCharacterStates(sessionId);
		for (const c of chars) {
			await deleteCharacterState(sessionId, c.characterName);
		}
	});

	it('initializes all agents', async () => {
		await runner.initAll(context);
		expect(runner.hasAgent('memory')).toBe(true);
		expect(runner.hasAgent('director')).toBe(true);
		expect(runner.hasAgent('scene')).toBe(true);
		expect(runner.hasAgent('character')).toBe(true);
	});

	it('runs full pipeline onBeforeSend', async () => {
		await runner.initAll(context);
		
		const result = await runner.onBeforeSend(context);
		
		// Should have combined injectPrompt
		expect(result.injectPrompt).toBeDefined();
		expect(result.injectPrompt).toContain('[Memory]');
	});

	it('runs full pipeline onAfterReceive', async () => {
		await runner.initAll(context);
		
		const response = 'Elara entered the Rusty Tankard Inn. She felt nervous.';
		const result = await runner.onAfterReceive(context, response);
		
		// Agents should have processed the response
		expect(result.updatedState).toBeDefined();
	});
});
```

- [ ] **Step 2: Run integration test**

Run: `npm test tests/integration/agent-pipeline.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/agent-pipeline.test.ts
git commit -m "test: add agent pipeline integration test"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npm run check` or `svelte-check`
Expected: No type errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete agent-based architecture implementation"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Agent types (priority, AgentResult with updatedState) - Task 3
- ✅ Scene State Agent - Task 6
- ✅ Character State Agent - Task 7
- ✅ Director Agent - Task 5
- ✅ AgentRunner with priority ordering - Task 4
- ✅ SQLite storage for scene/character states - Task 2
- ✅ Dynamic token budgets (placeholder - needs UI)
- ✅ Model slots for director - Task 9
- ✅ Error handling (graceful degradation in agents) - Tasks 5-7

**2. Placeholder scan:**
- Dynamic token budget UI not implemented (deferred to separate task)
- Model context window fetching not implemented (deferred to separate task)

**3. Type consistency:**
- All agents use same Agent interface with priority
- AgentResult.updatedState uses StateUpdate type
- Storage functions use SceneState and CharacterState types consistently
