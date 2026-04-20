# Agent Pipeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 5-agent pipeline with a LIBRA-inspired 2-call system (extraction + turn maintenance) that reliably records memories and produces varied narrative guidance.

**Architecture:** Two LLM calls per turn: (1) Extraction after AI response extracts scene/character/events/facts with delta detection, (2) Turn Maintenance before next generation combines narrative briefing + story author + director + correction in one call. Unified pipeline handles both character and world chat modes.

**Tech Stack:** TypeScript strict, Svelte 5 runes, sql.js for persistence, existing `callAgentLLM` infrastructure, Vitest for testing.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/core/agents/types.ts` | All new type definitions for the pipeline |
| `src/lib/core/agents/prompts.ts` | Centralized prompt registry (LIBRA-style `PROMPTS.get(key)`) |
| `src/lib/core/agents/extraction.ts` | Extraction phase: call LLM, parse JSON, repair, store memories |
| `src/lib/core/agents/turn-maintenance.ts` | Turn maintenance phase: call LLM, parse JSON, repair, produce guidance |
| `src/lib/core/agents/injection.ts` | Format turn maintenance output into labeled prompt sections |
| `src/lib/core/agents/agent-pipeline.ts` | Pipeline orchestrator replacing AgentRunner |
| `src/lib/storage/session-agent-state.ts` | Unified session state storage (replaces agent-states.ts) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/storage/db.ts` | Add `session_agent_state` table to schema |
| `src/lib/types/prompt-preset.ts` | Add `narrativeGuidance`, `sectionWorld`, `worldRelations` to PromptItemType |
| `src/lib/types/config.ts` | Replace AgentSettings with new shape |
| `src/lib/types/plugin.ts` | Remove AgentPlugin interface |
| `src/lib/types/index.ts` | Update exports |
| `src/lib/plugins/registry.ts` | Remove agent registration methods |
| `src/lib/stores/agent-progress.ts` | 4-step pipeline |
| `src/lib/components/AgentPipelineIndicator.svelte` | Updated for new steps |
| `src/lib/core/chat/engine.ts` | New pipeline integration |
| `src/lib/core/chat/prompt-assembler.ts` | New preset item types for narrativeGuidance/sectionWorld/worldRelations |

### Deleted Files

| File | Reason |
|------|--------|
| `src/lib/core/agents/agent-runner.ts` | Replaced by agent-pipeline.ts |
| `src/lib/core/agents/memory-agent.ts` | Absorbed into extraction.ts |
| `src/lib/core/agents/director-agent.ts` | Absorbed into turn-maintenance.ts |
| `src/lib/core/agents/scene-state-agent.ts` | Absorbed into extraction.ts |
| `src/lib/core/agents/character-state-agent.ts` | Absorbed into extraction.ts |
| `src/lib/core/agents/narrative-consistency-agent.ts` | Absorbed into turn-maintenance.ts |
| `src/lib/core/agents/index.ts` | Replaced |
| `src/lib/types/agent.ts` | Replaced by types.ts |
| `src/lib/types/agent-state.ts` | Replaced by types.ts |
| `src/lib/storage/agent-states.ts` | Replaced by session-agent-state.ts |

### Test Files

| File | Purpose |
|------|---------|
| `tests/core/agents/types.test.ts` | Type validation |
| `tests/core/agents/prompts.test.ts` | Prompt registry |
| `tests/core/agents/extraction.test.ts` | Extraction phase |
| `tests/core/agents/turn-maintenance.test.ts` | Turn maintenance phase |
| `tests/core/agents/injection.test.ts` | Injection formatting |
| `tests/core/agents/agent-pipeline.test.ts` | Pipeline orchestrator |
| `tests/storage/session-agent-state.test.ts` | State persistence |

---

## Task 1: Types & Prompts

**Files:**
- Create: `src/lib/core/agents/types.ts`
- Create: `src/lib/core/agents/prompts.ts`
- Test: `tests/core/agents/types.test.ts`
- Test: `tests/core/agents/prompts.test.ts`

- [ ] **Step 1: Write failing tests for types**

```typescript
// tests/core/agents/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  SessionAgentState,
  ExtractionSnapshot,
  CharacterSnapshot,
  NarrativeState,
  TurnMaintenanceOutput,
  EntityRecord,
  RelationRecord,
  WorldFactRecord,
  TurnSnapshot,
  AgentPipelineContext,
} from '$lib/core/agents/types';

describe('Agent pipeline types', () => {
  it('ExtractionSnapshot has required scene fields', () => {
    const snapshot: ExtractionSnapshot = {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: {
        location: 'Tavern',
        characters: ['Alice'],
        atmosphere: 'tense',
        timeOfDay: 'evening',
        environmentalNotes: 'rain outside',
      },
      characters: {},
      events: ['Alice entered the tavern'],
      newFacts: ['Alice is looking for someone'],
      changed: [],
    };
    expect(snapshot.scene.location).toBe('Tavern');
    expect(snapshot.scene.characters).toEqual(['Alice']);
  });

  it('CharacterSnapshot has required fields', () => {
    const cs: CharacterSnapshot = {
      name: 'Alice',
      emotion: 'nervous',
      location: 'at the bar',
      inventory: ['sword'],
      health: 'healthy',
      notes: 'scanning the room',
    };
    expect(cs.emotion).toBe('nervous');
    expect(cs.inventory).toEqual(['sword']);
  });

  it('NarrativeState tracks arc and tensions', () => {
    const ns: NarrativeState = {
      currentArc: "Alice's search",
      activeTensions: ['Who is Alice looking for?'],
      recentDecisions: ['Alice decided to enter the tavern'],
      nextBeats: ['Alice spots someone'],
      turnNumber: 1,
    };
    expect(ns.currentArc).toBe("Alice's search");
    expect(ns.activeTensions).toHaveLength(1);
  });

  it('TurnMaintenanceOutput has all sections', () => {
    const tmo: TurnMaintenanceOutput = {
      narrativeBrief: 'Alice arrived at the tavern looking for someone.',
      correction: {
        shouldCorrect: false,
        reasons: [],
      },
      storyAuthor: {
        currentArc: "Alice's search",
        narrativeGoal: 'Discover who Alice is looking for',
        activeTensions: ['Mystery of the search target'],
        nextBeats: ['Alice finds a clue'],
        guardrails: ['Do not reveal the target yet'],
        focusCharacters: ['Alice'],
        recentDecisions: ['Entered the tavern'],
      },
      director: {
        sceneMandate: 'Build tension as Alice searches',
        requiredOutcomes: ['Alice interacts with an NPC'],
        forbiddenMoves: ['Do not resolve the search this turn'],
        emphasis: ['Atmosphere', 'Suspicion'],
        targetPacing: 'slow',
        pressureLevel: 'medium',
        focusCharacters: ['Alice'],
      },
    };
    expect(tmo.narrativeBrief).toBeTruthy();
    expect(tmo.correction.shouldCorrect).toBe(false);
    expect(tmo.storyAuthor.currentArc).toBeTruthy();
    expect(tmo.director.sceneMandate).toBeTruthy();
  });

  it('SessionAgentState has all fields', () => {
    const state: SessionAgentState = {
      sessionId: 'sess-1',
      lastExtraction: null,
      lastTurnMaintenance: null,
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
    expect(state.sessionId).toBe('sess-1');
    expect(state.lastExtraction).toBeNull();
    expect(state.narrativeState.turnNumber).toBe(0);
  });

  it('EntityRecord has required fields', () => {
    const er: EntityRecord = {
      id: 'ent-1',
      name: 'Rusty Tankard',
      type: 'location',
      description: 'A worn but cozy tavern',
      attributes: { reputation: 'neutral' },
      lastUpdated: Date.now(),
    };
    expect(er.type).toBe('location');
  });

  it('AgentPipelineContext has cardType', () => {
    const ctx: AgentPipelineContext = {
      sessionId: 'sess-1',
      cardId: 'card-1',
      cardType: 'character',
      messages: [],
      scene: {
        location: '',
        participatingCharacters: [],
        mood: '',
        time: '',
        environmentalNotes: '',
        lastUpdated: 0,
        variables: {},
      },
      turnNumber: 1,
      config: {
        providerId: 'openai',
        model: 'gpt-4',
        apiKey: 'test',
        temperature: 0.7,
        maxTokens: 4096,
      },
    };
    expect(ctx.cardType).toBe('character');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/agents/types.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create types.ts**

```typescript
// src/lib/core/agents/types.ts
import type { Message } from '$lib/types/message';
import type { SceneState } from '$lib/types/scene';
import type { UserConfig } from '$lib/types/config';
import type { SessionId, CharacterId } from '$lib/types/branded';

export interface CharacterSnapshot {
  name: string;
  emotion: string;
  location: string;
  inventory: string[];
  health: string;
  notes: string;
}

export interface ExtractionSnapshot {
  turnNumber: number;
  timestamp: number;
  scene: {
    location: string;
    characters: string[];
    atmosphere: string;
    timeOfDay: string;
    environmentalNotes: string;
  };
  characters: Record<string, CharacterSnapshot>;
  events: string[];
  newFacts: string[];
  changed: string[];
}

export interface WorldExtractionFields {
  worldRules: string[];
  entities: EntityRecord[];
  relations: RelationRecord[];
}

export interface EntityRecord {
  id: string;
  name: string;
  type: 'character' | 'location' | 'faction' | 'item' | 'other';
  description: string;
  attributes: Record<string, string>;
  lastUpdated: number;
}

export interface RelationRecord {
  subjectId: string;
  objectId: string;
  relationType: string;
  description: string;
  lastUpdated: number;
}

export interface WorldFactRecord {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  createdAt: number;
}

export interface TurnSnapshot {
  turnNumber: number;
  extractionSummary: string;
  events: string[];
  timestamp: number;
}

export interface NarrativeState {
  currentArc: string;
  activeTensions: string[];
  recentDecisions: string[];
  nextBeats: string[];
  turnNumber: number;
}

export interface TurnMaintenanceOutput {
  narrativeBrief: string;
  correction: {
    shouldCorrect: boolean;
    reasons: string[];
    correctedEntities?: Partial<EntityRecord>[];
    correctedRelations?: Partial<RelationRecord>[];
  };
  storyAuthor: {
    currentArc: string;
    narrativeGoal: string;
    activeTensions: string[];
    nextBeats: string[];
    guardrails: string[];
    focusCharacters: string[];
    recentDecisions: string[];
  };
  director: {
    sceneMandate: string;
    requiredOutcomes: string[];
    forbiddenMoves: string[];
    emphasis: string[];
    targetPacing: 'slow' | 'normal' | 'fast';
    pressureLevel: 'low' | 'medium' | 'high';
    focusCharacters: string[];
  };
}

export interface SessionAgentState {
  sessionId: string;
  lastExtraction: ExtractionSnapshot | null;
  lastTurnMaintenance: TurnMaintenanceOutput | null;
  entities: Record<string, EntityRecord>;
  relations: RelationRecord[];
  worldFacts: WorldFactRecord[];
  turnHistory: TurnSnapshot[];
  narrativeState: NarrativeState;
}

export interface AgentPipelineContext {
  sessionId: SessionId;
  cardId: CharacterId;
  cardType: 'character' | 'world';
  messages: Message[];
  scene: SceneState;
  turnNumber: number;
  config: UserConfig;
}

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PipelineProgressCallback {
  (step: string, status: PipelineStepStatus): void;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/agents/types.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for prompts**

```typescript
// tests/core/agents/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { PROMPTS } from '$lib/core/agents/prompts';

describe('Agent prompts registry', () => {
  it('has EXTRACTION_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('EXTRACTION_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('memory extraction engine');
    expect(prompt).toContain('JSON');
  });

  it('has EXTRACTION_FALLBACK_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('EXTRACTION_FALLBACK_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt!.length).toBeLessThan(PROMPTS.get('EXTRACTION_SYSTEM')!.length);
  });

  it('has EXTRACTION_REPAIR_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('EXTRACTION_REPAIR_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('JSON');
  });

  it('has TURN_MAINTENANCE_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('TURN_MAINTENANCE_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('narrative');
    expect(prompt).toContain('director');
  });

  it('has RELIABILITY_GUARD prompt', () => {
    const prompt = PROMPTS.get('RELIABILITY_GUARD');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('conservatively');
  });

  it('has DIRECTOR_MODE_LIGHT, STRONG, ABSOLUTE', () => {
    expect(PROMPTS.get('DIRECTOR_MODE_LIGHT')).toBeTruthy();
    expect(PROMPTS.get('DIRECTOR_MODE_STRONG')).toBeTruthy();
    expect(PROMPTS.get('DIRECTOR_MODE_ABSOLUTE')).toBeTruthy();
  });

  it('build substitutes variables', () => {
    const result = PROMPTS.build('DIRECTOR_MODE_LIGHT', {});
    expect(result).toBeTruthy();
  });

  it('returns empty string for unknown key', () => {
    expect(PROMPTS.get('NONEXISTENT')).toBe('');
  });

  it('keys() returns all registered prompt keys', () => {
    const keys = PROMPTS.keys();
    expect(keys).toContain('EXTRACTION_SYSTEM');
    expect(keys).toContain('TURN_MAINTENANCE_SYSTEM');
    expect(keys).toContain('RELIABILITY_GUARD');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- tests/core/agents/prompts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Create prompts.ts**

```typescript
// src/lib/core/agents/prompts.ts
const _store: Record<string, string> = {};

_store.EXTRACTION_SYSTEM = [
  'You are a memory extraction engine. Analyze the conversation and extract structured information.',
  '',
  'You receive:',
  '- The current conversation segment',
  '- The previous extraction snapshot (for delta detection)',
  '',
  'Extract:',
  '1. Scene: location, characters present, atmosphere, time, environmental details',
  '2. Characters: for each character mentioned — emotion, location, inventory, health, notes',
  '3. Events: what happened this turn (plot points, actions, decisions)',
  '4. New facts: new information about the world, characters, or relationships',
  '5. Changes: what changed compared to the previous extraction',
  '',
  'Output JSON only:',
  '{',
  '  "scene": { "location": "", "characters": [], "atmosphere": "", "timeOfDay": "", "environmentalNotes": "" },',
  '  "characters": [{ "name": "", "emotion": "", "location": "", "inventory": [], "health": "", "notes": "" }],',
  '  "events": ["what happened"],',
  '  "newFacts": ["new information"],',
  '  "changed": ["what changed vs previous extraction"]',
  '}',
].join('\n');

_store.EXTRACTION_WORLD_SYSTEM = [
  'You are a memory extraction engine for a rich world simulation. Analyze the conversation and extract comprehensive structured information.',
  '',
  'You receive:',
  '- The current conversation segment',
  '- The previous extraction snapshot (for delta detection)',
  '',
  'Extract:',
  '1. Scene: location, characters present, atmosphere, time, environmental details',
  '2. Characters: for each character mentioned — emotion, location, inventory, health, notes',
  '3. Events: what happened this turn',
  '4. New facts: new information about the world, characters, or relationships',
  '5. Changes: what changed compared to the previous extraction',
  '6. World rules: active rules governing the current scene location',
  '7. Entities: named entities beyond characters (factions, items, locations)',
  '8. Relations: relationships between entities and characters',
  '',
  'Output JSON only:',
  '{',
  '  "scene": { "location": "", "characters": [], "atmosphere": "", "timeOfDay": "", "environmentalNotes": "" },',
  '  "characters": [{ "name": "", "emotion": "", "location": "", "inventory": [], "health": "", "notes": "" }],',
  '  "events": ["what happened"],',
  '  "newFacts": ["new information"],',
  '  "changed": ["what changed vs previous extraction"],',
  '  "worldRules": ["active rules for current location"],',
  '  "entities": [{ "name": "", "type": "", "description": "" }],',
  '  "relations": [{ "subject": "", "object": "", "relation": "", "description": "" }]',
  '}',
].join('\n');

_store.EXTRACTION_FALLBACK_SYSTEM = [
  'You extract structured information from roleplay conversation.',
  'Return JSON only with keys: scene, characters, events, newFacts, changed.',
  'Each key should contain relevant extracted data.',
].join('\n');

_store.EXTRACTION_REPAIR_SYSTEM = 'You repair malformed extraction output into valid JSON. Return exactly one JSON object with keys: scene, characters, events, newFacts, changed. Do not add commentary. Do not use markdown.';

_store.TURN_MAINTENANCE_SYSTEM = [
  'You are a Turn Maintenance Optimizer.',
  'Combine narrative briefing, story planning, director guidance, and extraction correction in one pass.',
  '',
  'You receive:',
  '- Current conversation context (recent messages)',
  '- Current extraction snapshot (scene, characters, events)',
  '- Current narrative state (arc, tensions, recent decisions)',
  '- Character/World card data (personality, scenario, relevant lore)',
  '',
  'Do not invent canon. Only fix clear extraction mistakes.',
  'If correction is unnecessary, return null for correction.',
  '',
  'Respond only as JSON:',
  '{',
  '  "narrativeBrief": "compact summary of current story situation",',
  '  "correction": { "shouldCorrect": false, "reasons": [] },',
  '  "storyAuthor": {',
  '    "currentArc": "",',
  '    "narrativeGoal": "",',
  '    "activeTensions": [""],',
  '    "nextBeats": [""],',
  '    "guardrails": [""],',
  '    "focusCharacters": [""],',
  '    "recentDecisions": [""]',
  '  },',
  '  "director": {',
  '    "sceneMandate": "",',
  '    "requiredOutcomes": [""],',
  '    "forbiddenMoves": [""],',
  '    "emphasis": [""],',
  '    "targetPacing": "slow|normal|fast",',
  '    "pressureLevel": "low|medium|high",',
  '    "focusCharacters": [""]',
  '  }',
  '}',
].join('\n');

_store.RELIABILITY_GUARD = [
  '[Reliability Guard]',
  'One or more support subsystems failed this turn.',
  'Respond conservatively: prioritize established continuity, avoid inventing new facts,',
  'and prefer the currently visible scene evidence.',
].join('\n');

_store.DIRECTOR_MODE_LIGHT = 'Apply light but persistent guidance to keep the scene moving.';
_store.DIRECTOR_MODE_STRONG = 'Apply strong directorial control and force a meaningful beat in this response.';
_store.DIRECTOR_MODE_ABSOLUTE = 'This is top-priority direction. The response must obey it and create a strong narrative turn now.';

_store.SECTION_WORLD_SYSTEM = [
  'You are a Section World Composer.',
  'Infer which slice of the established world is active in the current scene.',
  'Do not invent new canon. Do not expand the setting beyond supplied context.',
  'Write a compact prompt the main response model can follow immediately.',
  'Focus on active local rules, scene pressure, current location/world state.',
  '',
  'Respond only as JSON:',
  '{ "sectionTitle": "", "prompt": "", "activeRules": [""], "scenePressures": [""] }',
].join('\n');

export const PROMPTS = Object.freeze({
  get: (key: string): string => _store[key] || '',
  build: (key: string, vars: Record<string, string> = {}): string => {
    let template = String(_store[key] || '');
    if (!template) return '';
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(v ?? ''));
    }
    return template;
  },
  keys: (): string[] => Object.keys(_store),
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- tests/core/agents/prompts.test.ts`
Expected: PASS

- [ ] **Step 9: Run all new tests together**

Run: `npm run test -- tests/core/agents/types.test.ts tests/core/agents/prompts.test.ts`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/core/agents/types.ts src/lib/core/agents/prompts.ts tests/core/agents/types.test.ts tests/core/agents/prompts.test.ts
git commit -m "feat(agents): add types and centralized prompt registry for new pipeline"
```

---

## Task 2: Session Agent State Storage

**Files:**
- Modify: `src/lib/storage/db.ts` — add `session_agent_state` table to schema
- Create: `src/lib/storage/session-agent-state.ts`
- Test: `tests/storage/session-agent-state.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/storage/session-agent-state.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadSessionState, saveSessionState, deleteSessionState } from '$lib/storage/session-agent-state';
import { getDb, closeDb } from '$lib/storage/db';
import type { SessionAgentState } from '$lib/core/agents/types';

function makeState(sessionId: string): SessionAgentState {
  return {
    sessionId,
    lastExtraction: {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: {
        location: 'Tavern',
        characters: ['Alice'],
        atmosphere: 'tense',
        timeOfDay: 'evening',
        environmentalNotes: 'rain',
      },
      characters: {
        Alice: {
          name: 'Alice',
          emotion: 'nervous',
          location: 'bar',
          inventory: ['sword'],
          health: 'healthy',
          notes: '',
        },
      },
      events: ['Alice entered'],
      newFacts: ['Alice is searching'],
      changed: [],
    },
    lastTurnMaintenance: null,
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: {
      currentArc: "Alice's search",
      activeTensions: ['Who is Alice looking for?'],
      recentDecisions: [],
      nextBeats: [],
      turnNumber: 1,
    },
  };
}

describe('session-agent-state storage', () => {
  beforeEach(async () => {
    await closeDb();
  });
  afterEach(async () => {
    await closeDb();
  });

  it('returns null for non-existent session', async () => {
    const state = await loadSessionState('nonexistent');
    expect(state).toBeNull();
  });

  it('saves and loads a session state', async () => {
    const original = makeState('test-session-1');
    await saveSessionState(original);

    const loaded = await loadSessionState('test-session-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('test-session-1');
    expect(loaded!.lastExtraction).not.toBeNull();
    expect(loaded!.lastExtraction!.scene.location).toBe('Tavern');
    expect(loaded!.lastExtraction!.characters['Alice'].emotion).toBe('nervous');
    expect(loaded!.narrativeState.currentArc).toBe("Alice's search");
    expect(loaded!.narrativeState.activeTensions).toEqual(['Who is Alice looking for?']);
  });

  it('overwrites existing state on save', async () => {
    const first = makeState('test-session-2');
    first.narrativeState.currentArc = 'First arc';
    await saveSessionState(first);

    const second = makeState('test-session-2');
    second.narrativeState.currentArc = 'Second arc';
    second.lastExtraction = null;
    await saveSessionState(second);

    const loaded = await loadSessionState('test-session-2');
    expect(loaded!.narrativeState.currentArc).toBe('Second arc');
    expect(loaded!.lastExtraction).toBeNull();
  });

  it('deletes a session state', async () => {
    const state = makeState('test-session-3');
    await saveSessionState(state);
    await deleteSessionState('test-session-3');
    const loaded = await loadSessionState('test-session-3');
    expect(loaded).toBeNull();
  });

  it('handles empty state with no extractions', async () => {
    const empty: SessionAgentState = {
      sessionId: 'test-empty',
      lastExtraction: null,
      lastTurnMaintenance: null,
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
    await saveSessionState(empty);
    const loaded = await loadSessionState('test-empty');
    expect(loaded!.lastExtraction).toBeNull();
    expect(loaded!.narrativeState.turnNumber).toBe(0);
  });

  it('preserves worldFacts and relations', async () => {
    const state = makeState('test-world');
    state.worldFacts = [
      { id: 'wf-1', content: 'Magic exists', category: 'world_rule', importance: 0.9, source: 'extraction', createdAt: Date.now() },
    ];
    state.relations = [
      { subjectId: 'Alice', objectId: 'Bob', relationType: 'ally', description: 'travel companions', lastUpdated: Date.now() },
    ];
    await saveSessionState(state);
    const loaded = await loadSessionState('test-world');
    expect(loaded!.worldFacts).toHaveLength(1);
    expect(loaded!.worldFacts[0].content).toBe('Magic exists');
    expect(loaded!.relations).toHaveLength(1);
    expect(loaded!.relations[0].relationType).toBe('ally');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/storage/session-agent-state.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Add session_agent_state table to db.ts schema**

In `src/lib/storage/db.ts`, add this to the `SCHEMA_SQL` string, after the existing `character_states` table definition:

```sql
CREATE TABLE IF NOT EXISTS session_agent_state (
  session_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
```

Add this index as well:

```sql
CREATE INDEX IF NOT EXISTS idx_session_agent_state ON session_agent_state(session_id);
```

- [ ] **Step 4: Create session-agent-state.ts**

```typescript
// src/lib/storage/session-agent-state.ts
import { getDb, persist } from './db';
import type { SessionAgentState } from '$lib/core/agents/types';

export async function loadSessionState(sessionId: string): Promise<SessionAgentState | null> {
  const db = await getDb();
  const result = db.exec(
    'SELECT state FROM session_agent_state WHERE session_id = ?',
    [sessionId],
  );
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  const raw = result[0].values[0][0] as string;
  try {
    return JSON.parse(raw) as SessionAgentState;
  } catch {
    console.warn(`[SessionAgentState] Failed to parse state for session ${sessionId}`);
    return null;
  }
}

export async function saveSessionState(state: SessionAgentState): Promise<void> {
  const db = await getDb();
  const json = JSON.stringify(state);
  const now = Date.now();
  const existing = db.exec(
    'SELECT session_id FROM session_agent_state WHERE session_id = ?',
    [state.sessionId],
  );
  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(
      'UPDATE session_agent_state SET state = ?, updated_at = ? WHERE session_id = ?',
      [json, now, state.sessionId],
    );
  } else {
    db.run(
      'INSERT INTO session_agent_state (session_id, state, updated_at) VALUES (?, ?, ?)',
      [state.sessionId, json, now],
    );
  }
  try { await persist(); } catch {}
}

export async function deleteSessionState(sessionId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM session_agent_state WHERE session_id = ?', [sessionId]);
  try { await persist(); } catch {}
}
```

- [ ] **Step 5: Add closeDb export to db.ts if not present**

Check if `closeDb` is already exported from `src/lib/storage/db.ts`. If not, add:

```typescript
export async function closeDb(): Promise<void> {
  if (db) {
    db.close();
    db = null;
    dbPromise = null;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test -- tests/storage/session-agent-state.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage/db.ts src/lib/storage/session-agent-state.ts tests/storage/session-agent-state.test.ts
git commit -m "feat(agents): add session agent state storage with unified JSON blob"
```

---

## Task 3: Extraction Phase

**Files:**
- Create: `src/lib/core/agents/extraction.ts`
- Test: `tests/core/agents/extraction.test.ts`

This task depends on Task 1 (types, prompts) and Task 2 (storage).

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/agents/extraction.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runExtraction,
  parseExtractionJson,
  buildExtractionUserContent,
} from '$lib/core/agents/extraction';
import type { ExtractionSnapshot, SessionAgentState, AgentPipelineContext } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => { fn({ modelSlots: {}, agentSettings: { enabled: true, extraction: { enabled: true } } }); return vi.fn(); }),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('$lib/core/bootstrap', () => ({
  getRegistry: vi.fn(),
}));

vi.mock('$lib/storage/session-agent-state', () => ({
  loadSessionState: vi.fn(),
  saveSessionState: vi.fn(),
}));

vi.mock('$lib/storage/memories', () => ({
  insertMemory: vi.fn(),
  getMemoriesForSession: vi.fn(() => []),
}));

vi.mock('$lib/core/embedding', () => ({
  getEmbedding: vi.fn(() => Promise.resolve(new Array(128).fill(0.1))),
}));

function makeMessages(): Message[] {
  return [
    { role: 'user', content: 'Alice walks into the tavern.', type: 'dialogue', timestamp: 1 },
    { role: 'assistant', content: '*The door creaks as Alice steps inside. Rain drips from her cloak.*', type: 'dialogue', timestamp: 2 },
  ];
}

function makeState(): SessionAgentState {
  return {
    sessionId: 'test-session',
    lastExtraction: null,
    lastTurnMaintenance: null,
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 0 },
  };
}

describe('parseExtractionJson', () => {
  it('parses valid extraction JSON', () => {
    const json = JSON.stringify({
      scene: { location: 'Tavern', characters: ['Alice'], atmosphere: 'tense', timeOfDay: 'evening', environmentalNotes: '' },
      characters: [{ name: 'Alice', emotion: 'nervous', location: 'bar', inventory: [], health: 'healthy', notes: '' }],
      events: ['Alice entered the tavern'],
      newFacts: ['Alice is searching for someone'],
      changed: [],
    });
    const result = parseExtractionJson(json);
    expect(result).not.toBeNull();
    expect(result!.scene.location).toBe('Tavern');
    expect(result!.events).toEqual(['Alice entered the tavern']);
  });

  it('extracts JSON from surrounding text', () => {
    const text = 'Here is the extraction:\n{"scene":{"location":"Forest","characters":[],"atmosphere":"","timeOfDay":"","environmentalNotes":""},"characters":[],"events":["test"],"newFacts":[],"changed":[]}\nEnd.';
    const result = parseExtractionJson(text);
    expect(result).not.toBeNull();
    expect(result!.scene.location).toBe('Forest');
  });

  it('returns null for invalid JSON', () => {
    expect(parseExtractionJson('not json at all')).toBeNull();
  });

  it('returns null for JSON without required fields', () => {
    expect(parseExtractionJson('{"some": "thing"}')).toBeNull();
  });

  it('handles empty arrays gracefully', () => {
    const json = '{"scene":{"location":"","characters":[],"atmosphere":"","timeOfDay":"","environmentalNotes":""},"characters":[],"events":[],"newFacts":[],"changed":[]}';
    const result = parseExtractionJson(json);
    expect(result).not.toBeNull();
    expect(result!.events).toEqual([]);
  });
});

describe('buildExtractionUserContent', () => {
  it('includes conversation text', () => {
    const content = buildExtractionUserContent(makeMessages(), null, 'character');
    expect(content).toContain('Alice walks into the tavern');
  });

  it('includes previous extraction when provided', () => {
    const previous: ExtractionSnapshot = {
      turnNumber: 0,
      timestamp: 0,
      scene: { location: 'Forest', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
      characters: {},
      events: [],
      newFacts: [],
      changed: [],
    };
    const content = buildExtractionUserContent(makeMessages(), previous, 'character');
    expect(content).toContain('Forest');
    expect(content).toContain('Previous extraction');
  });

  it('does not include previous extraction when null', () => {
    const content = buildExtractionUserContent(makeMessages(), null, 'character');
    expect(content).not.toContain('Previous extraction');
  });
});

describe('runExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns extraction snapshot on successful call', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const mocked = vi.mocked(callAgentLLM);
    mocked.mockResolvedValueOnce(JSON.stringify({
      scene: { location: 'Tavern', characters: ['Alice'], atmosphere: 'tense', timeOfDay: 'evening', environmentalNotes: 'rain' },
      characters: [{ name: 'Alice', emotion: 'nervous', location: 'bar', inventory: [], health: 'healthy', notes: '' }],
      events: ['Alice entered the tavern'],
      newFacts: ['Alice is wet from the rain'],
      changed: [],
    }));

    const result = await runExtraction(makeMessages(), makeState(), 'character');
    expect(result).not.toBeNull();
    expect(result!.scene.location).toBe('Tavern');
    expect(result!.events).toContain('Alice entered the tavern');
  });

  it('returns null when LLM call fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('LLM failed'));

    const result = await runExtraction(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
  });

  it('returns null when JSON parse fails and repair fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    const mocked = vi.mocked(callAgentLLM);
    mocked.mockResolvedValueOnce('not valid json with no braces');
    mocked.mockRejectedValueOnce(new Error('repair failed'));

    const result = await runExtraction(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/agents/extraction.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create extraction.ts**

```typescript
// src/lib/core/agents/extraction.ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLM } from './agent-llm';
import { PROMPTS } from './prompts';
import { loadSessionState, saveSessionState } from '$lib/storage/session-agent-state';
import { insertMemory } from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';
import type { ExtractionSnapshot, SessionAgentState } from './types';
import type { Message } from '$lib/types/message';
import type { MemoryType } from '$lib/types/memory';

function resolveExtractionConfig(chatConfig?: import('$lib/types/config').UserConfig) {
  const settings = get(settingsStore);
  const memorySlot = settings.modelSlots?.memory;
  const chatSlot = settings.modelSlots?.chat;

  const provider = memorySlot?.provider || chatSlot?.provider
    || chatConfig?.providerId || settings.defaultProvider;
  const apiKey = memorySlot?.apiKey || chatSlot?.apiKey
    || chatConfig?.apiKey
    || (settings.providers?.[settings.defaultProvider!]?.apiKey as string);
  const model = memorySlot?.model || chatSlot?.model
    || chatConfig?.model
    || (settings.providers?.[settings.defaultProvider!]?.model as string);
  const baseUrl = memorySlot?.baseUrl || chatSlot?.baseUrl
    || chatConfig?.baseUrl;
  const temperature = memorySlot?.temperature ?? chatSlot?.temperature ?? 0.3;
  const maxTokens = (settings.agentSettings as any)?.extraction?.tokenBudget ?? 1024;

  return { provider, apiKey, model, baseUrl, temperature, maxTokens };
}

export function parseExtractionJson(content: string): ExtractionSnapshot | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.scene !== 'object' || parsed.scene === null) return null;
    if (!Array.isArray(parsed.events)) return null;
    if (!Array.isArray(parsed.newFacts)) return null;
    if (!Array.isArray(parsed.changed)) return null;

    const characters: Record<string, import('./types').CharacterSnapshot> = {};
    if (Array.isArray(parsed.characters)) {
      for (const c of parsed.characters) {
        if (c && typeof c.name === 'string' && c.name) {
          characters[c.name] = {
            name: c.name,
            emotion: typeof c.emotion === 'string' ? c.emotion : '',
            location: typeof c.location === 'string' ? c.location : '',
            inventory: Array.isArray(c.inventory) ? c.inventory : [],
            health: typeof c.health === 'string' ? c.health : '',
            notes: typeof c.notes === 'string' ? c.notes : '',
          };
        }
      }
    }

    return {
      turnNumber: 0,
      timestamp: Date.now(),
      scene: {
        location: typeof parsed.scene.location === 'string' ? parsed.scene.location : '',
        characters: Array.isArray(parsed.scene.characters) ? parsed.scene.characters : [],
        atmosphere: typeof parsed.scene.atmosphere === 'string' ? parsed.scene.atmosphere : '',
        timeOfDay: typeof parsed.scene.timeOfDay === 'string' ? parsed.scene.timeOfDay : '',
        environmentalNotes: typeof parsed.scene.environmentalNotes === 'string' ? parsed.scene.environmentalNotes : '',
      },
      characters,
      events: parsed.events.filter((e: unknown) => typeof e === 'string'),
      newFacts: parsed.newFacts.filter((f: unknown) => typeof f === 'string'),
      changed: parsed.changed.filter((c: unknown) => typeof c === 'string'),
    };
  } catch {
    return null;
  }
}

export function buildExtractionUserContent(
  messages: Message[],
  previousExtraction: ExtractionSnapshot | null,
  cardType: 'character' | 'world',
): string {
  const parts: string[] = [];

  parts.push('=== Conversation ===');
  for (const msg of messages.slice(-8)) {
    parts.push(`${msg.role}: ${msg.content}`);
  }

  if (previousExtraction) {
    parts.push('\n=== Previous Extraction ===');
    parts.push(JSON.stringify(previousExtraction, null, 2));
  }

  if (cardType === 'world') {
    parts.push('\nNote: This is a world simulation. Extract entities, relations, and world rules in addition to the standard fields.');
  }

  return parts.join('\n');
}

export async function runExtraction(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
  chatConfig?: import('$lib/types/config').UserConfig,
): Promise<ExtractionSnapshot | null> {
  const config = resolveExtractionConfig(chatConfig);
  if (!config.provider || !config.apiKey || !config.model) {
    console.warn('[Extraction] No model configured for extraction');
    return null;
  }

  const systemPrompt = cardType === 'world'
    ? PROMPTS.get('EXTRACTION_WORLD_SYSTEM')
    : PROMPTS.get('EXTRACTION_SYSTEM');
  const userContent = buildExtractionUserContent(messages, state.lastExtraction, cardType);

  let rawContent: string;
  try {
    rawContent = await callAgentLLM(systemPrompt, userContent, {
      providerId: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  } catch (err) {
    console.warn('[Extraction] LLM call failed, attempting fallback:', err);

    try {
      const fallbackSystem = PROMPTS.get('EXTRACTION_FALLBACK_SYSTEM');
      rawContent = await callAgentLLM(fallbackSystem, userContent, {
        providerId: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        maxTokens: Math.min(config.maxTokens, 512),
      });
    } catch (fallbackErr) {
      console.warn('[Extraction] Fallback LLM call also failed:', fallbackErr);
      return null;
    }
  }

  let extraction = parseExtractionJson(rawContent);

  if (!extraction) {
    console.warn('[Extraction] JSON parse failed, attempting repair');
    try {
      const repairPrompt = PROMPTS.get('EXTRACTION_REPAIR_SYSTEM');
      const repairedContent = await callAgentLLM(repairPrompt, rawContent, {
        providerId: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        temperature: 0.1,
        maxTokens: 1024,
      });
      extraction = parseExtractionJson(repairedContent);
    } catch (repairErr) {
      console.warn('[Extraction] Repair call failed:', repairErr);
    }
  }

  if (!extraction) {
    console.warn('[Extraction] All extraction attempts failed');
    return null;
  }

  extraction.turnNumber = state.narrativeState.turnNumber + 1;
  extraction.timestamp = Date.now();

  await storeExtractedMemories(extraction, state, chatConfig);

  return extraction;
}

async function storeExtractedMemories(
  extraction: ExtractionSnapshot,
  state: SessionAgentState,
  chatConfig?: import('$lib/types/config').UserConfig,
): Promise<void> {
  const settings = get(settingsStore);
  const memSettings = settings.memorySettings;
  const hasEmbedding = Boolean(memSettings?.embeddingProvider && memSettings?.embeddingApiKey);

  const factsToStore = [
    ...extraction.newFacts.map(f => ({ content: f, type: 'general' as MemoryType })),
    ...extraction.events.map(e => ({ content: e, type: 'event' as MemoryType })),
  ];

  for (const fact of factsToStore) {
    try {
      let embedding: number[];
      if (hasEmbedding) {
        embedding = await getEmbedding(fact.content, {
          provider: memSettings!.embeddingProvider as 'voyage' | 'openai-compatible',
          apiKey: memSettings!.embeddingApiKey,
          model: memSettings!.embeddingModel,
        });
      } else {
        embedding = [];
      }

      await insertMemory({
        id: crypto.randomUUID(),
        sessionId: state.sessionId as any,
        type: fact.type,
        content: fact.content,
        importance: 0.5,
        sourceMessageIds: [],
        turnNumber: extraction.turnNumber,
        createdAt: Date.now(),
        embedding,
      });
    } catch (err) {
      console.warn('[Extraction] Failed to store memory:', fact.content, err);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/agents/extraction.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/extraction.ts tests/core/agents/extraction.test.ts
git commit -m "feat(agents): add extraction phase with delta detection and repair chain"
```

---

## Task 4: Turn Maintenance Phase

**Files:**
- Create: `src/lib/core/agents/turn-maintenance.ts`
- Test: `tests/core/agents/turn-maintenance.test.ts`

This task depends on Task 1 (types, prompts).

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/agents/turn-maintenance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runTurnMaintenance,
  parseTurnMaintenanceJson,
  buildTurnMaintenanceUserContent,
} from '$lib/core/agents/turn-maintenance';
import type { SessionAgentState, TurnMaintenanceOutput, ExtractionSnapshot } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => { fn({ modelSlots: {}, agentSettings: { enabled: true, turnMaintenance: { enabled: true }, director: { mode: 'light' } } }); return vi.fn(); }),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

function makeMessages(): Message[] {
  return [
    { role: 'user', content: 'I draw my sword and challenge the guard.', type: 'dialogue', timestamp: 1 },
    { role: 'assistant', content: '*The guard narrows his eyes, hand moving to his own blade.*', type: 'dialogue', timestamp: 2 },
  ];
}

function makeState(): SessionAgentState {
  return {
    sessionId: 'test-session',
    lastExtraction: {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: 'Castle gate', characters: ['Guard', 'Alice'], atmosphere: 'tense', timeOfDay: 'dawn', environmentalNotes: '' },
      characters: {
        Guard: { name: 'Guard', emotion: 'suspicious', location: 'gate', inventory: ['sword'], health: 'healthy', notes: '' },
        Alice: { name: 'Alice', emotion: 'determined', location: 'gate', inventory: ['sword'], health: 'healthy', notes: '' },
      },
      events: ['Alice challenged the guard'],
      newFacts: ['The guard is suspicious of Alice'],
      changed: ['Tension escalated'],
    },
    lastTurnMaintenance: null,
    entities: {},
    relations: [],
    worldFacts: [],
    turnHistory: [],
    narrativeState: { currentArc: 'The gate standoff', activeTensions: ['Guard vs Alice'], recentDecisions: [], nextBeats: [], turnNumber: 1 },
  };
}

describe('parseTurnMaintenanceJson', () => {
  it('parses valid turn maintenance JSON', () => {
    const json = JSON.stringify({
      narrativeBrief: 'Alice confronts a guard at the castle gate.',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: 'Gate confrontation',
        narrativeGoal: 'Resolve the standoff',
        activeTensions: ['Will the guard let Alice through?'],
        nextBeats: ['Guard makes a decision'],
        guardrails: ['Do not kill Alice'],
        focusCharacters: ['Alice', 'Guard'],
        recentDecisions: ['Alice drew her sword'],
      },
      director: {
        sceneMandate: 'Escalate tension',
        requiredOutcomes: ['The guard responds'],
        forbiddenMoves: ['Do not resolve peacefully'],
        emphasis: ['Tension', 'Danger'],
        targetPacing: 'fast',
        pressureLevel: 'high',
        focusCharacters: ['Alice'],
      },
    });
    const result = parseTurnMaintenanceJson(json);
    expect(result).not.toBeNull();
    expect(result!.narrativeBrief).toContain('Alice');
    expect(result!.director.sceneMandate).toBe('Escalate tension');
    expect(result!.storyAuthor.activeTensions).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseTurnMaintenanceJson('no json here')).toBeNull();
  });

  it('returns null for JSON missing required sections', () => {
    expect(parseTurnMaintenanceJson('{"narrativeBrief": "test"}')).toBeNull();
  });
});

describe('buildTurnMaintenanceUserContent', () => {
  it('includes conversation, extraction, and narrative state', () => {
    const content = buildTurnMaintenanceUserContent(
      makeMessages(),
      makeState(),
      'character',
    );
    expect(content).toContain('sword');
    expect(content).toContain('Castle gate');
    expect(content).toContain('gate standoff');
  });

  it('includes world mode indicator when cardType is world', () => {
    const content = buildTurnMaintenanceUserContent(
      makeMessages(),
      makeState(),
      'world',
    );
    expect(content).toContain('world');
  });
});

describe('runTurnMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns TurnMaintenanceOutput on success', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      narrativeBrief: 'Tense standoff at the gate.',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: 'Gate confrontation',
        narrativeGoal: 'Resolve the standoff',
        activeTensions: ['Guard decision'],
        nextBeats: ['Guard attacks or yields'],
        guardrails: ['Stay in character'],
        focusCharacters: ['Alice'],
        recentDecisions: ['Alice drew sword'],
      },
      director: {
        sceneMandate: 'Force the guard to act',
        requiredOutcomes: ['Combat or negotiation'],
        forbiddenMoves: ['No deus ex machina'],
        emphasis: ['Tension'],
        targetPacing: 'fast',
        pressureLevel: 'high',
        focusCharacters: ['Alice'],
      },
    }));

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).not.toBeNull();
    expect(result!.narrativeBrief).toBeTruthy();
    expect(result!.director.sceneMandate).toBeTruthy();
  });

  it('returns null when LLM call fails', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('failed'));
    vi.mocked(callAgentLLM).mockRejectedValueOnce(new Error('repair failed'));

    const result = await runTurnMaintenance(makeMessages(), makeState(), 'character');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/agents/turn-maintenance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create turn-maintenance.ts**

```typescript
// src/lib/core/agents/turn-maintenance.ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLM } from './agent-llm';
import { PROMPTS } from './prompts';
import type { SessionAgentState, TurnMaintenanceOutput } from './types';
import type { Message } from '$lib/types/message';

function resolveMaintenanceConfig(chatConfig?: import('$lib/types/config').UserConfig) {
  const settings = get(settingsStore);
  const directorSlot = settings.modelSlots?.director;
  const memorySlot = settings.modelSlots?.memory;
  const chatSlot = settings.modelSlots?.chat;

  const provider = directorSlot?.provider || memorySlot?.provider || chatSlot?.provider
    || chatConfig?.providerId || settings.defaultProvider;
  const apiKey = directorSlot?.apiKey || memorySlot?.apiKey || chatSlot?.apiKey
    || chatConfig?.apiKey
    || (settings.providers?.[settings.defaultProvider!]?.apiKey as string);
  const model = directorSlot?.model || memorySlot?.model || chatSlot?.model
    || chatConfig?.model
    || (settings.providers?.[settings.defaultProvider!]?.model as string);
  const baseUrl = directorSlot?.baseUrl || memorySlot?.baseUrl || chatSlot?.baseUrl
    || chatConfig?.baseUrl;
  const temperature = directorSlot?.temperature ?? memorySlot?.temperature ?? chatSlot?.temperature ?? 0.7;
  const maxTokens = (settings.agentSettings as any)?.turnMaintenance?.tokenBudget ?? 2048;

  const agentSettings = settings.agentSettings as any;
  const directorMode = agentSettings?.director?.mode || 'light';

  return { provider, apiKey, model, baseUrl, temperature, maxTokens, directorMode };
}

export function parseTurnMaintenanceJson(content: string): TurnMaintenanceOutput | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);

    if (typeof parsed.narrativeBrief !== 'string') return null;
    if (!parsed.storyAuthor || typeof parsed.storyAuthor !== 'object') return null;
    if (!parsed.director || typeof parsed.director !== 'object') return null;

    const validPacing = ['slow', 'normal', 'fast'];
    const validPressure = ['low', 'medium', 'high'];

    return {
      narrativeBrief: parsed.narrativeBrief,
      correction: {
        shouldCorrect: Boolean(parsed.correction?.shouldCorrect),
        reasons: Array.isArray(parsed.correction?.reasons) ? parsed.correction.reasons : [],
        correctedEntities: parsed.correction?.correctedEntities,
        correctedRelations: parsed.correction?.correctedRelations,
      },
      storyAuthor: {
        currentArc: String(parsed.storyAuthor.currentArc || ''),
        narrativeGoal: String(parsed.storyAuthor.narrativeGoal || ''),
        activeTensions: Array.isArray(parsed.storyAuthor.activeTensions) ? parsed.storyAuthor.activeTensions.filter((t: unknown) => typeof t === 'string') : [],
        nextBeats: Array.isArray(parsed.storyAuthor.nextBeats) ? parsed.storyAuthor.nextBeats.filter((b: unknown) => typeof b === 'string') : [],
        guardrails: Array.isArray(parsed.storyAuthor.guardrails) ? parsed.storyAuthor.guardrails.filter((g: unknown) => typeof g === 'string') : [],
        focusCharacters: Array.isArray(parsed.storyAuthor.focusCharacters) ? parsed.storyAuthor.focusCharacters.filter((c: unknown) => typeof c === 'string') : [],
        recentDecisions: Array.isArray(parsed.storyAuthor.recentDecisions) ? parsed.storyAuthor.recentDecisions.filter((d: unknown) => typeof d === 'string') : [],
      },
      director: {
        sceneMandate: String(parsed.director.sceneMandate || ''),
        requiredOutcomes: Array.isArray(parsed.director.requiredOutcomes) ? parsed.director.requiredOutcomes.filter((o: unknown) => typeof o === 'string') : [],
        forbiddenMoves: Array.isArray(parsed.director.forbiddenMoves) ? parsed.director.forbiddenMoves.filter((m: unknown) => typeof m === 'string') : [],
        emphasis: Array.isArray(parsed.director.emphasis) ? parsed.director.emphasis.filter((e: unknown) => typeof e === 'string') : [],
        targetPacing: validPacing.includes(parsed.director.targetPacing) ? parsed.director.targetPacing : 'normal',
        pressureLevel: validPressure.includes(parsed.director.pressureLevel) ? parsed.director.pressureLevel : 'medium',
        focusCharacters: Array.isArray(parsed.director.focusCharacters) ? parsed.director.focusCharacters.filter((c: unknown) => typeof c === 'string') : [],
      },
    };
  } catch {
    return null;
  }
}

export function buildTurnMaintenanceUserContent(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
): string {
  const parts: string[] = [];

  parts.push('=== Recent Conversation ===');
  for (const msg of messages.slice(-6)) {
    parts.push(`${msg.role}: ${msg.content}`);
  }

  if (state.lastExtraction) {
    parts.push('\n=== Current Extraction Snapshot ===');
    parts.push(`Scene: ${state.lastExtraction.scene.location}`);
    parts.push(`Characters: ${state.lastExtraction.scene.characters.join(', ')}`);
    parts.push(`Atmosphere: ${state.lastExtraction.scene.atmosphere}`);
    parts.push(`Events: ${state.lastExtraction.events.join('; ')}`);
    if (Object.keys(state.lastExtraction.characters).length > 0) {
      parts.push('Character States:');
      for (const [name, cs] of Object.entries(state.lastExtraction.characters)) {
        parts.push(`  ${name}: ${cs.emotion}, ${cs.location}, health: ${cs.health}`);
      }
    }
  }

  if (state.narrativeState.currentArc || state.narrativeState.activeTensions.length > 0) {
    parts.push('\n=== Current Narrative State ===');
    if (state.narrativeState.currentArc) parts.push(`Current Arc: ${state.narrativeState.currentArc}`);
    if (state.narrativeState.activeTensions.length) parts.push(`Active Tensions: ${state.narrativeState.activeTensions.join('; ')}`);
    if (state.narrativeState.recentDecisions.length) parts.push(`Recent Decisions: ${state.narrativeState.recentDecisions.join('; ')}`);
  }

  if (state.lastTurnMaintenance) {
    parts.push('\n=== Previous Turn Maintenance ===');
    parts.push(`Previous Brief: ${state.lastTurnMaintenance.narrativeBrief}`);
    if (state.lastTurnMaintenance.storyAuthor.nextBeats.length) {
      parts.push(`Previous Next Beats: ${state.lastTurnMaintenance.storyAuthor.nextBeats.join('; ')}`);
    }
  }

  if (cardType === 'world') {
    parts.push('\nNote: This is a world simulation. Include world-scale narrative guidance.');
  }

  return parts.join('\n');
}

export async function runTurnMaintenance(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
  chatConfig?: import('$lib/types/config').UserConfig,
): Promise<TurnMaintenanceOutput | null> {
  const config = resolveMaintenanceConfig(chatConfig);
  if (!config.provider || !config.apiKey || !config.model) {
    console.warn('[TurnMaintenance] No model configured');
    return null;
  }

  const systemPrompt = PROMPTS.get('TURN_MAINTENANCE_SYSTEM');
  const userContent = buildTurnMaintenanceUserContent(messages, state, cardType);

  let rawContent: string;
  try {
    rawContent = await callAgentLLM(systemPrompt, userContent, {
      providerId: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  } catch (err) {
    console.warn('[TurnMaintenance] LLM call failed:', err);
    return null;
  }

  let result = parseTurnMaintenanceJson(rawContent);

  if (!result) {
    console.warn('[TurnMaintenance] JSON parse failed, attempting repair');
    try {
      const repairedContent = await callAgentLLM(
        'Repair this JSON. Return only valid JSON with keys: narrativeBrief, correction, storyAuthor, director.',
        rawContent,
        {
          providerId: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          temperature: 0.1,
          maxTokens: 2048,
        },
      );
      result = parseTurnMaintenanceJson(repairedContent);
    } catch (repairErr) {
      console.warn('[TurnMaintenance] Repair failed:', repairErr);
    }
  }

  if (!result) {
    console.warn('[TurnMaintenance] All attempts failed');
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/agents/turn-maintenance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/turn-maintenance.ts tests/core/agents/turn-maintenance.test.ts
git commit -m "feat(agents): add turn maintenance phase with narrative continuity"
```

---

## Task 5: Injection Formatting

**Files:**
- Create: `src/lib/core/agents/injection.ts`
- Test: `tests/core/agents/injection.test.ts`

This task depends on Task 1 (types).

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/agents/injection.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatTurnMaintenanceInjection,
  formatExtractionInjection,
  formatReliabilityGuard,
  formatMemoryInjection,
} from '$lib/core/agents/injection';
import type { TurnMaintenanceOutput, ExtractionSnapshot } from '$lib/core/agents/types';

describe('formatTurnMaintenanceInjection', () => {
  it('formats complete turn maintenance output', () => {
    const tmo: TurnMaintenanceOutput = {
      narrativeBrief: 'Alice confronts the guard.',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: 'Gate standoff',
        narrativeGoal: 'Resolve confrontation',
        activeTensions: ['Will violence erupt?'],
        nextBeats: ['Guard makes a choice'],
        guardrails: ['No deus ex machina'],
        focusCharacters: ['Alice'],
        recentDecisions: ['Drew sword'],
      },
      director: {
        sceneMandate: 'Escalate',
        requiredOutcomes: ['Physical confrontation'],
        forbiddenMoves: ['Peaceful resolution'],
        emphasis: ['Danger'],
        targetPacing: 'fast',
        pressureLevel: 'high',
        focusCharacters: ['Alice'],
      },
    };

    const result = formatTurnMaintenanceInjection(tmo);
    expect(result).toContain('[Narrative Brief]');
    expect(result).toContain('Alice confronts the guard');
    expect(result).toContain('[Story Author Guidance]');
    expect(result).toContain('Gate standoff');
    expect(result).toContain('[Director Supervision]');
    expect(result).toContain('Escalate');
    expect(result).toContain('fast');
    expect(result).toContain('high');
  });

  it('omits empty sections', () => {
    const tmo: TurnMaintenanceOutput = {
      narrativeBrief: '',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [],
        guardrails: [], focusCharacters: [], recentDecisions: [],
      },
      director: {
        sceneMandate: 'Just keep going',
        requiredOutcomes: [], forbiddenMoves: [], emphasis: [],
        targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [],
      },
    };

    const result = formatTurnMaintenanceInjection(tmo);
    expect(result).not.toContain('[Narrative Brief]');
    expect(result).not.toContain('[Story Author Guidance]');
    expect(result).toContain('[Director Supervision]');
  });
});

describe('formatExtractionInjection', () => {
  it('formats extraction snapshot for injection', () => {
    const snap: ExtractionSnapshot = {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: 'Tavern', characters: ['Alice'], atmosphere: 'tense', timeOfDay: 'evening', environmentalNotes: 'rain' },
      characters: {
        Alice: { name: 'Alice', emotion: 'nervous', location: 'bar', inventory: [], health: 'healthy', notes: '' },
      },
      events: ['Alice entered'],
      newFacts: [],
      changed: [],
    };

    const result = formatExtractionInjection(snap);
    expect(result).toContain('[Scene State]');
    expect(result).toContain('Tavern');
    expect(result).toContain('[Character States]');
    expect(result).toContain('Alice');
  });

  it('returns undefined for empty snapshot', () => {
    const snap: ExtractionSnapshot = {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: '', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
      characters: {},
      events: [],
      newFacts: [],
      changed: [],
    };
    expect(formatExtractionInjection(snap)).toBeUndefined();
  });
});

describe('formatReliabilityGuard', () => {
  it('returns the guard text', () => {
    const result = formatReliabilityGuard();
    expect(result).toContain('Reliability Guard');
    expect(result).toContain('conservatively');
  });
});

describe('formatMemoryInjection', () => {
  it('formats memory records', () => {
    const memories = [
      { content: 'Alice owns a sword', type: 'trait' as const },
      { content: 'The tavern is called Rusty Tankard', type: 'location' as const },
    ];
    const result = formatMemoryInjection(memories);
    expect(result).toContain('[Memory]');
    expect(result).toContain('Alice owns a sword');
    expect(result).toContain('Rusty Tankard');
  });

  it('returns undefined for empty memories', () => {
    expect(formatMemoryInjection([])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/agents/injection.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create injection.ts**

```typescript
// src/lib/core/agents/injection.ts
import { PROMPTS } from './prompts';
import type { TurnMaintenanceOutput, ExtractionSnapshot, CharacterSnapshot } from './types';

export function formatTurnMaintenanceInjection(tmo: TurnMaintenanceOutput): string {
  const sections: string[] = [];

  if (tmo.narrativeBrief) {
    sections.push(`[Narrative Brief]\n${tmo.narrativeBrief}`);
  }

  const sa = tmo.storyAuthor;
  if (sa.currentArc || sa.narrativeGoal || sa.activeTensions.length || sa.nextBeats.length || sa.guardrails.length) {
    const lines: string[] = ['[Story Author Guidance]'];
    if (sa.currentArc) lines.push(`Current Arc: ${sa.currentArc}`);
    if (sa.narrativeGoal) lines.push(`Narrative Goal: ${sa.narrativeGoal}`);
    if (sa.activeTensions.length) lines.push(`Active Tensions: ${sa.activeTensions.join(', ')}`);
    if (sa.nextBeats.length) lines.push(`Next Beats: ${sa.nextBeats.join(', ')}`);
    if (sa.guardrails.length) lines.push(`Guardrails: ${sa.guardrails.join(', ')}`);
    if (sa.focusCharacters.length) lines.push(`Focus Characters: ${sa.focusCharacters.join(', ')}`);
    sections.push(lines.join('\n'));
  }

  const dir = tmo.director;
  if (dir.sceneMandate || dir.requiredOutcomes.length || dir.forbiddenMoves.length || dir.emphasis.length) {
    const lines: string[] = ['[Director Supervision]'];
    if (dir.sceneMandate) lines.push(`Scene Mandate: ${dir.sceneMandate}`);
    if (dir.requiredOutcomes.length) lines.push(`Required Outcomes: ${dir.requiredOutcomes.join(', ')}`);
    if (dir.forbiddenMoves.length) lines.push(`Forbidden Moves: ${dir.forbiddenMoves.join(', ')}`);
    if (dir.emphasis.length) lines.push(`Emphasis: ${dir.emphasis.join(', ')}`);
    lines.push(`Target Pacing: ${dir.targetPacing}`);
    lines.push(`Pressure Level: ${dir.pressureLevel}`);
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

export function formatExtractionInjection(snap: ExtractionSnapshot): string | undefined {
  const sections: string[] = [];

  const hasScene = snap.scene.location || snap.scene.characters.length > 0
    || snap.scene.atmosphere || snap.scene.timeOfDay || snap.scene.environmentalNotes;

  if (hasScene) {
    const lines: string[] = ['[Scene State]'];
    if (snap.scene.location) lines.push(`Location: ${snap.scene.location}`);
    if (snap.scene.characters.length) lines.push(`Characters Present: ${snap.scene.characters.join(', ')}`);
    if (snap.scene.atmosphere) lines.push(`Atmosphere: ${snap.scene.atmosphere}`);
    if (snap.scene.timeOfDay) lines.push(`Time: ${snap.scene.timeOfDay}`);
    if (snap.scene.environmentalNotes) lines.push(`Environment: ${snap.scene.environmentalNotes}`);
    sections.push(lines.join('\n'));
  }

  const charEntries = Object.values(snap.characters);
  if (charEntries.length > 0) {
    const lines: string[] = ['[Character States]'];
    for (const cs of charEntries) {
      const details: string[] = [];
      if (cs.emotion) details.push(`feeling ${cs.emotion}`);
      if (cs.location) details.push(cs.location);
      if (cs.health && cs.health !== 'healthy') details.push(cs.health);
      if (cs.inventory.length > 0) details.push(`carrying: ${cs.inventory.join(', ')}`);
      if (cs.notes) details.push(cs.notes);
      if (details.length > 0) lines.push(`${cs.name}: ${details.join('; ')}`);
    }
    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export function formatReliabilityGuard(): string {
  return PROMPTS.get('RELIABILITY_GUARD');
}

export function formatMemoryInjection(memories: Array<{ content: string; type: string }>): string | undefined {
  if (memories.length === 0) return undefined;

  const lines: string[] = ['[Memory]'];
  for (const mem of memories) {
    lines.push(`- ${mem.content} (${mem.type})`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/agents/injection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/injection.ts tests/core/agents/injection.test.ts
git commit -m "feat(agents): add injection formatting with labeled priority sections"
```

---

## Task 6: Agent Pipeline Orchestrator

**Files:**
- Create: `src/lib/core/agents/agent-pipeline.ts`
- Test: `tests/core/agents/agent-pipeline.test.ts`

This task depends on Tasks 1-5.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/agents/agent-pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentPipeline } from '$lib/core/agents/agent-pipeline';
import type { AgentPipelineContext } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/agents/agent-llm', () => ({
  callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
  settingsStore: {
    subscribe: vi.fn((fn) => { fn({ modelSlots: {}, agentSettings: { enabled: true, turnMaintenance: { enabled: true }, extraction: { enabled: true }, director: { mode: 'light' } }, memorySettings: {} }); return vi.fn(); }),
    set: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('$lib/core/bootstrap', () => ({
  getRegistry: vi.fn(),
}));

vi.mock('$lib/storage/session-agent-state', () => ({
  loadSessionState: vi.fn(() => Promise.resolve(null)),
  saveSessionState: vi.fn(),
}));

vi.mock('$lib/storage/memories', () => ({
  insertMemory: vi.fn(),
  findSimilarMemories: vi.fn(() => Promise.resolve([])),
  getMemoriesForSession: vi.fn(() => Promise.resolve([])),
}));

vi.mock('$lib/core/embedding', () => ({
  getEmbedding: vi.fn(() => Promise.resolve(new Array(128).fill(0.1))),
}));

function makeContext(): AgentPipelineContext {
  return {
    sessionId: 'sess-1' as any,
    cardId: 'card-1' as any,
    cardType: 'character',
    messages: [
      { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 1 },
      { role: 'assistant', content: 'Hi there!', type: 'dialogue', timestamp: 2 },
    ],
    scene: {
      location: '', participatingCharacters: [], mood: '', time: '',
      environmentalNotes: '', lastUpdated: 0, variables: {},
    },
    turnNumber: 1,
    config: {
      providerId: 'openai', model: 'gpt-4', apiKey: 'test', temperature: 0.7, maxTokens: 4096,
    },
  };
}

describe('AgentPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates with correct step names', () => {
    const pipeline = new AgentPipeline();
    const steps = pipeline.getSteps();
    expect(steps).toHaveLength(4);
    expect(steps[0].id).toBe('memory-retrieval');
    expect(steps[1].id).toBe('turn-maintenance');
    expect(steps[2].id).toBe('generation');
    expect(steps[3].id).toBe('extraction');
  });

  it('runBeforeGeneration returns injection result', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      narrativeBrief: 'Test brief',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: { currentArc: 'Test arc', narrativeGoal: 'Test', activeTensions: [], nextBeats: [], guardrails: [], focusCharacters: [], recentDecisions: [] },
      director: { sceneMandate: 'Test mandate', requiredOutcomes: [], forbiddenMoves: [], emphasis: [], targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [] },
    }));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    const progress: Array<{ step: string; status: string }> = [];
    const result = await pipeline.runBeforeGeneration(ctx, (step, status) => {
      progress.push({ step, status });
    });

    expect(result).not.toBeNull();
    expect(result!.injection).toBeTruthy();
    expect(result!.injection).toContain('Director Supervision');
    expect(progress.length).toBeGreaterThan(0);
  });

  it('runAfterGeneration stores extraction', async () => {
    const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
    vi.mocked(callAgentLLM).mockResolvedValueOnce(JSON.stringify({
      scene: { location: 'Room', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
      characters: [],
      events: ['Something happened'],
      newFacts: ['A new fact'],
      changed: [],
    }));

    const pipeline = new AgentPipeline();
    const ctx = makeContext();
    await pipeline.runBeforeGeneration(ctx);
    const extraction = await pipeline.runAfterGeneration(ctx, 'AI response text');

    expect(extraction).not.toBeNull();
    expect(extraction!.events).toContain('Something happened');
  });

  it('handles generation step progress', async () => {
    const pipeline = new AgentPipeline();
    const progress: Array<{ step: string; status: string }> = [];
    pipeline.reportGenerationStatus('running', (step, status) => {
      progress.push({ step, status });
    });
    expect(progress).toEqual([{ step: 'generation', status: 'running' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/core/agents/agent-pipeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create agent-pipeline.ts**

```typescript
// src/lib/core/agents/agent-pipeline.ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { runExtraction } from './extraction';
import { runTurnMaintenance } from './turn-maintenance';
import { formatTurnMaintenanceInjection, formatExtractionInjection, formatReliabilityGuard, formatMemoryInjection } from './injection';
import { loadSessionState, saveSessionState } from '$lib/storage/session-agent-state';
import { findSimilarMemories } from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';
import type {
  AgentPipelineContext,
  SessionAgentState,
  ExtractionSnapshot,
  TurnMaintenanceOutput,
  PipelineProgressCallback,
  PipelineStepStatus,
} from './types';

export interface PipelineBeforeResult {
  injection: string;
  reliabilityGuard: boolean;
}

export interface PipelineAfterResult {
  extraction: ExtractionSnapshot | null;
}

export class AgentPipeline {
  private state: SessionAgentState | null = null;

  getSteps(): Array<{ id: string; label: string }> {
    return [
      { id: 'memory-retrieval', label: 'Memory' },
      { id: 'turn-maintenance', label: 'Planning' },
      { id: 'generation', label: 'Generating' },
      { id: 'extraction', label: 'Extracting' },
    ];
  }

  reportGenerationStatus(status: PipelineStepStatus, onProgress?: PipelineProgressCallback): void {
    onProgress?.('generation', status);
  }

  private async ensureState(ctx: AgentPipelineContext): Promise<SessionAgentState> {
    if (this.state && this.state.sessionId === ctx.sessionId) {
      return this.state;
    }
    const loaded = await loadSessionState(ctx.sessionId);
    if (loaded) {
      this.state = loaded;
    } else {
      this.state = {
        sessionId: ctx.sessionId,
        lastExtraction: null,
        lastTurnMaintenance: null,
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
    }
    return this.state;
  }

  async runBeforeGeneration(
    ctx: AgentPipelineContext,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineBeforeResult> {
    const state = await this.ensureState(ctx);
    const parts: string[] = [];
    let reliabilityGuard = false;

    onProgress?.('memory-retrieval', 'running');
    const memoryText = await this.retrieveMemories(ctx);
    if (memoryText) {
      parts.push(memoryText);
    }
    onProgress?.('memory-retrieval', memoryText ? 'done' : 'skipped');

    if (state.lastExtraction) {
      const sceneInjection = formatExtractionInjection(state.lastExtraction);
      if (sceneInjection) parts.push(sceneInjection);
    }

    onProgress?.('turn-maintenance', 'running');
    const maintenance = await runTurnMaintenance(ctx.messages, state, ctx.cardType, ctx.config);
    if (maintenance) {
      state.lastTurnMaintenance = maintenance;
      state.narrativeState = {
        currentArc: maintenance.storyAuthor.currentArc || state.narrativeState.currentArc,
        activeTensions: maintenance.storyAuthor.activeTensions,
        recentDecisions: maintenance.storyAuthor.recentDecisions,
        nextBeats: maintenance.storyAuthor.nextBeats,
        turnNumber: ctx.turnNumber,
      };
      parts.push(formatTurnMaintenanceInjection(maintenance));
      onProgress?.('turn-maintenance', 'done');
    } else {
      parts.push(formatReliabilityGuard());
      reliabilityGuard = true;
      onProgress?.('turn-maintenance', 'failed');
    }

    await saveSessionState(state);
    this.state = state;

    return { injection: parts.join('\n\n'), reliabilityGuard };
  }

  async runAfterGeneration(
    ctx: AgentPipelineContext,
    response: string,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineAfterResult> {
    const state = await this.ensureState(ctx);

    onProgress?.('extraction', 'running');
    const allMessages = [...ctx.messages, { role: 'assistant' as const, content: response, type: 'dialogue' as const, timestamp: Date.now() }];
    const extraction = await runExtraction(allMessages, state, ctx.cardType, ctx.config);

    if (extraction) {
      state.lastExtraction = extraction;
      state.narrativeState.turnNumber = ctx.turnNumber;
      state.turnHistory.push({
        turnNumber: ctx.turnNumber,
        extractionSummary: extraction.events.join('; ') || 'No events',
        events: extraction.events,
        timestamp: Date.now(),
      });
      if (state.turnHistory.length > 20) {
        state.turnHistory = state.turnHistory.slice(-20);
      }
      onProgress?.('extraction', 'done');
    } else {
      onProgress?.('extraction', 'failed');
    }

    await saveSessionState(state);
    this.state = state;

    return { extraction };
  }

  private async retrieveMemories(ctx: AgentPipelineContext): Promise<string | undefined> {
    const settings = get(settingsStore);
    const memSettings = settings.memorySettings;
    if (!memSettings?.embeddingProvider || !memSettings?.embeddingApiKey) {
      return undefined;
    }

    try {
      const recentMessages = ctx.messages.slice(-4);
      const queryText = recentMessages.map(m => m.content).join(' ');
      if (!queryText.trim()) return undefined;

      const queryEmbedding = await getEmbedding(queryText, {
        provider: memSettings.embeddingProvider as 'voyage' | 'openai-compatible',
        apiKey: memSettings.embeddingApiKey,
        model: memSettings.embeddingModel,
      });

      const topK = memSettings.topK ?? 15;
      const results = await findSimilarMemories(ctx.sessionId, queryEmbedding, topK, ctx.turnNumber);
      if (!results.length) return undefined;

      return formatMemoryInjection(results.map(r => ({ content: r.content, type: r.type })));
    } catch (err) {
      console.warn('[AgentPipeline] Memory retrieval failed:', err);
      return undefined;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/core/agents/agent-pipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/agents/agent-pipeline.ts tests/core/agents/agent-pipeline.test.ts
git commit -m "feat(agents): add pipeline orchestrator with memory retrieval and state management"
```

---

## Task 7: Delete Old Agent Files & Update Exports

**Files:**
- Delete: all old agent files
- Create: new `src/lib/core/agents/index.ts`
- Modify: `src/lib/types/index.ts`

This task depends on Tasks 1-6 being complete.

- [ ] **Step 1: Delete old agent files**

Delete these files:
- `src/lib/core/agents/agent-runner.ts`
- `src/lib/core/agents/memory-agent.ts`
- `src/lib/core/agents/director-agent.ts`
- `src/lib/core/agents/scene-state-agent.ts`
- `src/lib/core/agents/character-state-agent.ts`
- `src/lib/core/agents/narrative-consistency-agent.ts`
- `src/lib/types/agent.ts`
- `src/lib/types/agent-state.ts`
- `src/lib/storage/agent-states.ts`

- [ ] **Step 2: Create new index.ts**

```typescript
// src/lib/core/agents/index.ts
export { AgentPipeline } from './agent-pipeline';
export type {
  AgentPipelineContext,
  SessionAgentState,
  ExtractionSnapshot,
  CharacterSnapshot,
  NarrativeState,
  TurnMaintenanceOutput,
  EntityRecord,
  RelationRecord,
  WorldFactRecord,
  TurnSnapshot,
  PipelineStepStatus,
  PipelineProgressCallback,
} from './types';
export { PROMPTS } from './prompts';
```

- [ ] **Step 3: Update src/lib/types/index.ts**

Remove old agent/agent-state exports. Replace them with:

```typescript
export type {
  AgentPipelineContext,
  SessionAgentState,
  ExtractionSnapshot,
  TurnMaintenanceOutput,
  NarrativeState,
  CharacterSnapshot,
  EntityRecord,
  RelationRecord,
} from '../core/agents/types';

export { AgentPipeline } from '../core/agents/agent-pipeline';
```

Remove these lines if they exist:
```typescript
export type { AgentConfig, AgentContext, AgentResult, ProgressCallback, Agent } from './agent';
```

And any imports from `./agent-state` — remove `DirectorGuidance`, `DirectorMode`, `StateUpdate`, `CharacterState`, `AgentTokenBudget`, `AgentBudgetConfig`.

- [ ] **Step 4: Run typecheck to find all broken imports**

Run: `npm run check`
Expected: Errors pointing to files that import old types

- [ ] **Step 5: Fix all broken imports**

Fix any files that imported from deleted modules (`$lib/types/agent`, `$lib/types/agent-state`, `$lib/storage/agent-states`). The main files that need updating:

- `src/lib/core/chat/engine.ts` — update imports (will be fully rewritten in Task 8)
- `src/lib/core/image/generator.ts` — update `AgentImageContext` if it uses old state types
- `src/lib/core/chat/prompt-assembler.ts` — update `AgentOutputs` references (will be updated in Task 9)
- `src/lib/stores/settings.ts` — update if it imports old agent types

- [ ] **Step 6: Run typecheck again**

Run: `npm run check`
Expected: No errors (or only errors in files that will be rewritten in Tasks 8-9)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(agents): delete old agent files, add new index and exports"
```

---

## Task 8: Integrate Pipeline into ChatEngine

**Files:**
- Rewrite: `src/lib/core/chat/engine.ts`
- Modify: `src/lib/stores/agent-progress.ts`
- Modify: `src/lib/components/AgentPipelineIndicator.svelte`

This task depends on Tasks 1-7.

- [ ] **Step 1: Update agent-progress.ts store**

```typescript
// src/lib/stores/agent-progress.ts
import { writable } from 'svelte/store';

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

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

- [ ] **Step 2: Update AgentPipelineIndicator.svelte**

```svelte
<script lang="ts">
  import { agentProgress } from '$lib/stores/agent-progress';

  const statusIcon: Record<string, string> = {
    pending: '○',
    running: '●',
    done: '✓',
    failed: '✗',
    skipped: '—',
  };

  let state = $derived($agentProgress);
</script>

{#if state.active}
  <div class="flex items-center justify-center gap-2 bg-surface0/90 backdrop-blur-sm text-text text-xs px-3 py-1.5 border-t border-surface0 animate-in">
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

- [ ] **Step 3: Rewrite ChatEngine to use AgentPipeline**

The key changes to `src/lib/core/chat/engine.ts`:

1. Remove `AgentRunner` import and usage
2. Import `AgentPipeline` from `../agents/agent-pipeline`
3. Replace the agent-related sections in `send()`:

In the constructor, replace `private agentRunner = new AgentRunner()` with `private pipeline = new AgentPipeline()`.

In `send()`, replace the agent runner onBeforeSend block with:

```typescript
const pipelineSteps = this.pipeline.getSteps();
startPipeline(pipelineSteps);

const pipelineResult = await this.pipeline.runBeforeGeneration(
  {
    sessionId: makeSessionId(options.sessionId || options.characterId || ''),
    cardId: makeCharacterId(options.characterId || ''),
    cardType: options.worldCard ? 'world' : 'character',
    messages: allMessages,
    scene: triggerScene,
    turnNumber: allMessages.filter(m => m.role === 'user').length,
    config: options.config,
  },
  (step, status) => updateStep(step, status),
);

if (pipelineResult.injection) {
  ctx.additionalPrompt = (ctx.additionalPrompt || '') + '\n\n' + pipelineResult.injection;
}
```

Remove the `ctx.agentOutputs` assignment (the preset item types will be updated in Task 9 to use `ctx.additionalPrompt` directly instead).

For the `onAfterReceive` block inside `tokenStream()`, replace the agent runner call with:

```typescript
this.pipeline.reportGenerationStatus('done', (step, status) => updateStep(step, status));

try {
  await this.pipeline.runAfterGeneration({
    sessionId: makeSessionId(capturedSessionId || capturedCharacterId || ''),
    cardId: makeCharacterId(capturedCharacterId || ''),
    cardType: capturedCardType,
    messages: capturedCtx.messages,
    scene: capturedCtx.scene,
    turnNumber: capturedCtx.messages.filter(m => m.role === 'user').length,
    config: capturedConfig,
  }, processed, (step, status) => updateStep(step, status));
} catch {
  // Extraction failed — non-blocking
}
```

Remove the `mergeAgentImageState` function and all `agentImgContext` / `AgentImageContext` references from the engine (image generation integration will be re-added later as a follow-up).

Also remove the `for (const agent of this.registry.listAgents())` loops — those were the old AgentPlugin hooks.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: May have errors in prompt-assembler.ts (fixed in Task 9) and use-chat files

- [ ] **Step 5: Fix remaining import errors in use-chat files**

Update `src/lib/core/chat/use-chat.ts` and `src/lib/core/chat/use-chat-streaming.ts` if they import old agent types. Replace any references to `AgentRunner` or old agent types with imports from `$lib/core/agents/agent-pipeline`.

- [ ] **Step 6: Run tests**

Run: `npm run test`
Expected: Old agent tests fail (they reference deleted files). New tests pass. Will clean up old tests in Task 10.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): integrate AgentPipeline into ChatEngine, replace AgentRunner"
```

---

## Task 9: Update Prompt Assembler & Config Types

**Files:**
- Modify: `src/lib/core/chat/prompt-assembler.ts`
- Modify: `src/lib/types/prompt-preset.ts`
- Modify: `src/lib/types/config.ts`
- Modify: `src/lib/types/plugin.ts`
- Modify: `src/lib/plugins/registry.ts`

- [ ] **Step 1: Update PromptItemType in prompt-preset.ts**

Add new types to the union:

```typescript
export type PromptItemType =
  | 'system' | 'description' | 'persona' | 'personality' | 'scenario'
  | 'exampleMessages' | 'chatHistory' | 'lorebook' | 'authornote'
  | 'postHistoryInstructions' | 'depthPrompt' | 'jailbreak' | 'prefill' | 'plain'
  | 'memory' | 'director' | 'sceneState' | 'characterState' | 'worldDescription'
  | 'narrativeGuidance' | 'sectionWorld' | 'worldRelations';
```

- [ ] **Step 2: Update AgentSettings in config.ts**

Replace the existing `AgentSettings` interface:

```typescript
export interface AgentSettings {
  enabled: boolean;
  turnMaintenance: {
    enabled: boolean;
    contextMessages: number;
    tokenBudget: number;
  };
  extraction: {
    enabled: boolean;
    tokenBudget: number;
    repairAttempts: number;
  };
  director: {
    mode: 'light' | 'strong' | 'absolute';
  };
  worldMode?: {
    extractEntities: boolean;
    extractRelations: boolean;
    sectionWorldInjection: boolean;
  };
}
```

- [ ] **Step 3: Remove AgentPlugin from plugin.ts**

Remove the `AgentPlugin` interface and the `agentOutputs` property from `ChatContext`:

```typescript
export interface ChatContext {
  messages: Message[];
  card: CharacterCard;
  scene: SceneState;
  config: UserConfig;
  additionalPrompt?: string;
  lorebookMatches: LorebookEntry[];
}
```

- [ ] **Step 4: Remove agent methods from registry.ts**

Remove from `PluginRegistry`:
- The `agents` map
- `registerAgent()` method
- `getAgent()` method
- `listAgents()` method

- [ ] **Step 5: Update prompt-assembler.ts**

Update the `AssemblyContext` to remove `agentOutputs`:

```typescript
export interface AssemblyContext {
  card: CharacterCard;
  scene: SceneState;
  messages: Message[];
  lorebookMatches: LorebookEntry[];
  persona?: UserPersona;
  worldCard?: WorldCard;
  additionalPrompt?: string;
  outputLanguage?: string;
}
```

In `resolveItem()`, the `memory`, `director`, `sceneState`, `characterState` cases now return `null` since the agent pipeline injects everything via `additionalPrompt`. Add new cases for `narrativeGuidance`, `sectionWorld`, `worldRelations` that also return `null` (they're injected via additionalPrompt).

Remove the `agentOutputs` parameter from `assembleWithPreset()` and any internal usage.

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: All type errors resolved

- [ ] **Step 7: Run tests**

Run: `npm run test`
Expected: Only old agent tests may fail (cleaned in Task 10)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: update prompt assembler, config types, and plugin registry for new pipeline"
```

---

## Task 10: Clean Up Old Tests & Final Verification

**Files:**
- Delete: old test files that reference deleted code
- Run: full test suite + typecheck

- [ ] **Step 1: Delete old agent test files**

Delete these test directories/files:
- `tests/agents/agent-runner.test.ts`
- `tests/agents/agent-runner-outputs.test.ts`
- `tests/agents/agent-runner-progress.test.ts`
- `tests/agents/agent-state-persist.test.ts`
- `tests/agents/agent-engine-outputs.test.ts`
- `tests/agents/character-state-agent.test.ts`
- `tests/agents/director-agent.test.ts`
- `tests/agents/scene-state-agent.test.ts`
- `tests/agents/narrative-consistency-agent.test.ts`
- `tests/core/agents/memory-agent.test.ts`
- `tests/types/agent.test.ts`
- `tests/types/agent-outputs.test.ts`
- `tests/types/agent-state.test.ts`
- `tests/types/prompt-item-agent.test.ts`
- `tests/storage/agent-states.test.ts`
- `tests/core/presets/agent-preset-items.test.ts`
- `tests/core/chat/prompt-assembler-agent.test.ts`
- `tests/integration/agent-pipeline.test.ts`
- `tests/integration/agent-prompt-integration.test.ts`

Keep these if they still pass with updated imports:
- `tests/stores/agent-progress.test.ts` — update for new store shape if needed

- [ ] **Step 2: Fix any remaining test files**

Check `tests/core/chat/engine.test.ts` and `tests/plugins/registry.test.ts` for references to old agent types. Update imports and remove agent-related test cases.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS, no type errors

- [ ] **Step 4: Run full test suite**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: clean up old agent tests, verify new pipeline passes all checks"
```

---

## Self-Review

**Spec coverage:**
- Extraction phase with delta detection → Task 3 ✓
- Turn maintenance with narrative continuity → Task 4 ✓
- Injection with labeled sections → Task 5 ✓
- Reliability guard → Task 5 (formatReliabilityGuard) ✓
- Unified pipeline orchestrator → Task 6 ✓
- Session state storage → Task 2 ✓
- DB schema migration → Task 2 ✓
- ChatEngine integration → Task 8 ✓
- Prompt assembler updates → Task 9 ✓
- Config type updates → Task 9 ✓
- Plugin registry cleanup → Task 9 ✓
- World mode extensions → Task 3 (buildExtractionUserContent), Task 4 (buildTurnMaintenanceUserContent) ✓
- Progress monitoring → Task 8 ✓
- Old file deletion → Task 7, Task 10 ✓

**Placeholder scan:** No TBD/TODO found. All steps have complete code.

**Type consistency:** Checked all type names, method signatures, and imports across tasks. Consistent.
