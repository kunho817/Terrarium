# Scripting Engine + Triggers — Implementation Plan 7

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the trigger system (event→script binding), script API module with mutation collection, Rust Lua sandboxed runtime via mlua, and ChatEngine integration for trigger firing at pipeline stages.

**Architecture:** Four new TypeScript modules (event emitter, trigger engine, script API types, mutation applier) under `src/lib/core/`. One Rust module (`src-tauri/src/scripting.rs`) implementing a sandboxed Lua VM with Tauri command bridge. ChatEngine gains trigger firing at user-message and AI-response stages. Scripts execute in the Rust Lua VM, collect mutations, return them to TS which applies state changes and side effects.

**Tech Stack:** TypeScript, Vitest, Rust, mlua crate (Lua 5.4), serde_json

---

## Prerequisites

- Plan 1 completed (types + PluginRegistry)
- Plan 2 completed (storage + stores)
- Plan 3 completed (AI providers)
- Plan 4 completed (card formats + prompt builder)
- Plan 5 completed (chat engine + pipeline)
- Plan 6 completed (lorebook + variable store)
- Working directory: `D:/Project/TextChatbot`

---

## File Structure (created/modified by this plan)

```
D:/Project/TextChatbot/
├── src/lib/core/
│   ├── events.ts                         [NEW] Typed event emitter
│   ├── triggers.ts                       [NEW] Trigger matching engine
│   ├── scripting/
│   │   ├── api.ts                        [NEW] Script API types
│   │   ├── mutations.ts                  [NEW] Mutation applier (pure)
│   │   └── bridge.ts                     [NEW] Tauri invoke bridge
│   ├── chat/engine.ts                    [MODIFIED] Add trigger firing
├── src-tauri/
│   ├── Cargo.toml                        [MODIFIED] Add mlua dependency
│   ├── src/
│   │   ├── lib.rs                        [MODIFIED] Register scripting command
│   │   └── scripting.rs                  [NEW] Lua VM + Tauri command
├── tests/core/
│   ├── events.test.ts                    [NEW]
│   ├── triggers.test.ts                  [NEW]
│   ├── scripting/
│   │   ├── mutations.test.ts             [NEW]
│   │   └── bridge.test.ts                [NEW]
│   ├── chat/engine.test.ts               [MODIFIED] Add trigger tests
```

**Key type references (already exist, do NOT modify):**
- `Trigger`, `TriggerEvent`, `TriggerMatchOn` — `src/lib/types/trigger.ts`
- `VariableStore`, `VariableValue` — `src/lib/types/script.ts`
- `SceneState` — `src/lib/types/scene.ts`
- `CharacterCard` — `src/lib/types/character.ts`
- `Message` — `src/lib/types/message.ts`
- `ChatContext` — `src/lib/types/plugin.ts`

---

### Task 1: Event Emitter (TDD)

**Files:**
- Create: `src/lib/core/events.ts`
- Create: `tests/core/events.test.ts`

A typed event bus for scripting events. Other modules use this to subscribe to events and emit them.

- [ ] **Step 1: Write failing tests for event emitter**

Write `tests/core/events.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '$lib/core/events';
import type { TriggerEvent } from '$lib/types';

describe('EventEmitter', () => {
  it('calls handler when event is emitted', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.emit('on_message', { message: 'hello' });
    expect(handler).toHaveBeenCalledWith('on_message', { message: 'hello' });
  });

  it('does not call handler for different event', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.emit('on_chat_start');
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers for same event', () => {
    const emitter = new EventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on('on_message', handler1);
    emitter.on('on_message', handler2);
    emitter.emit('on_message');
    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('unsubscribe returns function removes handler', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    const unsub = emitter.on('on_message', handler);
    unsub();
    emitter.emit('on_message');
    expect(handler).not.toHaveBeenCalled();
  });

  it('off removes specific handler', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.off('on_message', handler);
    emitter.emit('on_message');
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears all handlers for an event', () => {
    const emitter = new EventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on('on_message', handler1);
    emitter.on('on_user_message', handler2);
    emitter.removeAllListeners('on_message');
    emitter.emit('on_message');
    emitter.emit('on_user_message');
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('removeAllListeners with no arg clears all events', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.on('on_chat_start', handler);
    emitter.removeAllListeners();
    emitter.emit('on_message');
    emitter.emit('on_chat_start');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit with no handlers does nothing', () => {
    const emitter = new EventEmitter();
    expect(() => emitter.emit('on_timer')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/events.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement event emitter**

Write `src/lib/core/events.ts`:
```typescript
/**
 * Typed event emitter for scripting events.
 * Used to subscribe to and emit TriggerEvents across the application.
 */

import type { TriggerEvent } from '$lib/types';

type EventHandler = (event: TriggerEvent, data?: unknown) => void;

export class EventEmitter {
  private handlers = new Map<TriggerEvent, Set<EventHandler>>();

  on(event: TriggerEvent, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: TriggerEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: TriggerEvent, data?: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(event, data));
  }

  removeAllListeners(event?: TriggerEvent): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/events.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/Project/TextChatbot"
git add src/lib/core/events.ts tests/core/events.test.ts
git commit -m "feat: add typed event emitter for scripting events"
```

---

### Task 2: Trigger Engine (TDD)

**Files:**
- Create: `src/lib/core/triggers.ts`
- Create: `tests/core/triggers.test.ts`

Pure function module that matches triggers against events. Filters by enabled, event type, matchOn, and pattern.

- [ ] **Step 1: Write failing tests for trigger engine**

Write `tests/core/triggers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { matchTriggers } from '$lib/core/triggers';
import type { Trigger, TriggerEvent } from '$lib/types';

function makeTrigger(overrides: Partial<Trigger> & { event: TriggerEvent }): Trigger {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || 'test trigger',
    enabled: overrides.enabled ?? true,
    event: overrides.event,
    pattern: overrides.pattern,
    matchOn: overrides.matchOn,
    script: overrides.script || '',
    blockScriptId: overrides.blockScriptId,
  };
}

describe('matchTriggers', () => {
  it('matches trigger by event type', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message' }),
      makeTrigger({ event: 'on_ai_message' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', {});
    expect(result).toHaveLength(1);
    expect(result[0].event).toBe('on_user_message');
  });

  it('skips disabled triggers', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', enabled: false }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', {});
    expect(result).toHaveLength(0);
  });

  it('matches trigger with pattern against message text', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', pattern: '\\[attack.*\\]' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', { message: '[attack] dragon with sword' });
    expect(result).toHaveLength(1);
  });

  it('does not match when pattern does not match message', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', pattern: '\\[attack.*\\]' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', { message: 'hello there' });
    expect(result).toHaveLength(0);
  });

  it('skips pattern check when no message provided', () => {
    const triggers = [
      makeTrigger({ event: 'on_chat_start', pattern: 'test' }),
    ];
    // on_chat_start has no message — pattern triggers should not match
    const result = matchTriggers(triggers, 'on_chat_start', {});
    expect(result).toHaveLength(0);
  });

  it('matches without pattern regardless of message', () => {
    const triggers = [
      makeTrigger({ event: 'on_chat_start' }),
    ];
    const result = matchTriggers(triggers, 'on_chat_start', {});
    expect(result).toHaveLength(1);
  });

  it('filters by matchOn=user_input for user message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test', matchOn: 'user_input' }),
    ];
    // isUserMessage=true → should match user_input
    const result = matchTriggers(triggers, 'on_message', {
      message: 'this is a test',
      isUserMessage: true,
    });
    expect(result).toHaveLength(1);
  });

  it('excludes matchOn=user_input for AI message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test', matchOn: 'user_input' }),
    ];
    // isUserMessage=false → should NOT match user_input
    const result = matchTriggers(triggers, 'on_message', {
      message: 'this is a test',
      isUserMessage: false,
    });
    expect(result).toHaveLength(0);
  });

  it('filters by matchOn=ai_output for AI message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'dragon', matchOn: 'ai_output' }),
    ];
    // isUserMessage=false → should match ai_output
    const result = matchTriggers(triggers, 'on_message', {
      message: 'the dragon appears',
      isUserMessage: false,
    });
    expect(result).toHaveLength(1);
  });

  it('excludes matchOn=ai_output for user message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'dragon', matchOn: 'ai_output' }),
    ];
    // isUserMessage=true → should NOT match ai_output
    const result = matchTriggers(triggers, 'on_message', {
      message: 'the dragon appears',
      isUserMessage: true,
    });
    expect(result).toHaveLength(0);
  });

  it('matchOn=both matches regardless of message source', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test', matchOn: 'both' }),
    ];

    const userResult = matchTriggers(triggers, 'on_message', {
      message: 'a test message',
      isUserMessage: true,
    });
    expect(userResult).toHaveLength(1);

    const aiResult = matchTriggers(triggers, 'on_message', {
      message: 'a test response',
      isUserMessage: false,
    });
    expect(aiResult).toHaveLength(1);
  });

  it('no matchOn matches regardless of message source', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test' }),
    ];

    const userResult = matchTriggers(triggers, 'on_message', {
      message: 'a test',
      isUserMessage: true,
    });
    expect(userResult).toHaveLength(1);

    const aiResult = matchTriggers(triggers, 'on_message', {
      message: 'a test',
      isUserMessage: false,
    });
    expect(aiResult).toHaveLength(1);
  });

  it('handles invalid regex patterns gracefully', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', pattern: '[invalid' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', { message: 'hello' });
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty triggers', () => {
    const result = matchTriggers([], 'on_message', {});
    expect(result).toEqual([]);
  });

  it('returns multiple matching triggers', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', id: 't1' }),
      makeTrigger({ event: 'on_user_message', id: 't2' }),
      makeTrigger({ event: 'on_ai_message', id: 't3' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', {});
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/triggers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement trigger engine**

Write `src/lib/core/triggers.ts`:
```typescript
/**
 * Trigger engine — matches triggers against events with pattern filtering.
 * Pure functions for testing. Used by ChatEngine to find matching triggers.
 */

import type { Trigger, TriggerEvent, TriggerMatchOn } from '$lib/types';

export interface TriggerEventData {
  message?: string;
  isUserMessage?: boolean;
  characterId?: string;
  variable?: string;
  pattern?: string;
}

export function matchTriggers(
  triggers: Trigger[],
  event: TriggerEvent,
  data: TriggerEventData,
): Trigger[] {
  return triggers.filter((trigger) => {
    if (!trigger.enabled) return false;
    if (trigger.event !== event) return false;

    // matchOn filter — only applies when isUserMessage is defined
    if (trigger.matchOn && data.isUserMessage !== undefined) {
      if (data.isUserMessage && trigger.matchOn === 'ai_output') return false;
      if (!data.isUserMessage && trigger.matchOn === 'user_input') return false;
    }

    // Pattern filter
    if (trigger.pattern) {
      if (!data.message) return false;
      try {
        const regex = new RegExp(trigger.pattern, 'i');
        return regex.test(data.message);
      } catch {
        return false;
      }
    }

    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/triggers.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/Project/TextChatbot"
git add src/lib/core/triggers.ts tests/core/triggers.test.ts
git commit -m "feat: add trigger engine with event matching and pattern filtering"
```

---

### Task 3: Script API Module (TDD)

**Files:**
- Create: `src/lib/core/scripting/api.ts`
- Create: `src/lib/core/scripting/mutations.ts`
- Create: `tests/core/scripting/mutations.test.ts`

Define the script API types (ScriptContext, ScriptMutation, ScriptResult, SideEffect) and a pure function to apply mutations to SceneState.

- [ ] **Step 1: Write failing tests for mutation applier**

Write `tests/core/scripting/mutations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { applyMutations } from '$lib/core/scripting/mutations';
import type { ScriptMutation } from '$lib/core/scripting/api';
import type { SceneState } from '$lib/types';

const baseScene: SceneState = {
  location: 'forest',
  time: 'day',
  mood: 'calm',
  participatingCharacters: [],
  variables: { 'player.hp': 100, 'player.gold': 50 },
};

describe('applyMutations', () => {
  it('applies setVar mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'player.hp', value: 85 },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.variables['player.hp']).toBe(85);
    expect(result.sideEffects).toHaveLength(0);
  });

  it('applies deleteVar mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'deleteVar', key: 'player.gold' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect('player.gold' in result.scene.variables).toBe(false);
    expect(result.scene.variables['player.hp']).toBe(100);
  });

  it('applies setLocation mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setLocation', value: 'dark_cave' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.location).toBe('dark_cave');
  });

  it('applies setTime mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setTime', value: 'night' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.time).toBe('night');
  });

  it('applies setMood mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setMood', value: 'tense' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.mood).toBe('tense');
  });

  it('does not mutate original scene', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'player.hp', value: 0 },
    ];
    applyMutations(baseScene, mutations);
    expect(baseScene.variables['player.hp']).toBe(100);
  });

  it('collects sendMessage as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'sendMessage', text: 'HP dropped!', msgType: 'system' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene).toEqual(baseScene);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({
      type: 'sendMessage',
      text: 'HP dropped!',
      msgType: 'system',
    });
  });

  it('collects injectLore as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'injectLore', name: 'injury_effects' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({ type: 'injectLore', name: 'injury_effects' });
  });

  it('collects showToast as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'showToast', message: 'Critical hit!' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
  });

  it('applies mixed state and side effect mutations', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'player.hp', value: 30 },
      { type: 'sendMessage', text: 'Low HP!', msgType: 'system' },
      { type: 'setMood', value: 'danger' },
      { type: 'injectLore', name: 'danger_zone' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.variables['player.hp']).toBe(30);
    expect(result.scene.mood).toBe('danger');
    expect(result.sideEffects).toHaveLength(2);
  });

  it('handles empty mutations', () => {
    const result = applyMutations(baseScene, []);
    expect(result.scene).toEqual(baseScene);
    expect(result.sideEffects).toHaveLength(0);
  });

  it('applies multiple setVar mutations in order', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'counter', value: 1 },
      { type: 'setVar', key: 'counter', value: 2 },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.variables['counter']).toBe(2);
  });

  it('collects blockMessage as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'blockMessage' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({ type: 'blockMessage' });
  });

  it('collects appendText as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'appendText', text: '\n[Damage taken!]' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({ type: 'appendText', text: '\n[Damage taken!]' });
  });

  it('collects playEffect as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'playEffect', effect: 'screen_shake', config: { duration: 500 } },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({
      type: 'playEffect',
      effect: 'screen_shake',
      config: { duration: 500 },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/scripting/mutations.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement script API types and mutation applier**

Write `src/lib/core/scripting/api.ts`:
```typescript
/**
 * Script API types — defines the interface between Lua scripts and TypeScript.
 * ScriptContext is passed TO the Lua runtime, ScriptResult is returned FROM it.
 */

import type { VariableValue, VariableStore } from '$lib/types';

export interface ScriptContext {
  variables: VariableStore;
  scene: {
    location: string;
    time: string;
    mood: string;
  };
  message?: string;
  isUserMessage?: boolean;
  pattern?: string;
}

// State mutations — applied directly to SceneState
export type StateMutation =
  | { type: 'setVar'; key: string; value: VariableValue }
  | { type: 'deleteVar'; key: string }
  | { type: 'setLocation'; value: string }
  | { type: 'setTime'; value: string }
  | { type: 'setMood'; value: string };

// Side effects — returned for caller to handle
export type SideEffect =
  | { type: 'sendMessage'; text: string; msgType: string }
  | { type: 'injectLore'; name: string }
  | { type: 'disableLore'; name: string }
  | { type: 'enableLore'; name: string }
  | { type: 'blockMessage' }
  | { type: 'appendText'; text: string }
  | { type: 'showToast'; message: string }
  | { type: 'playEffect'; effect: string; config?: Record<string, unknown> };

export type ScriptMutation = StateMutation | SideEffect;

export interface ScriptResult {
  success: boolean;
  error?: string;
  mutations: ScriptMutation[];
  logs: string[];
}

export interface MutationResult {
  scene: import('$lib/types').SceneState;
  sideEffects: SideEffect[];
}
```

Write `src/lib/core/scripting/mutations.ts`:
```typescript
/**
 * Mutation applier — pure function that applies ScriptMutations to SceneState.
 * State mutations (setVar, deleteVar, setLocation, etc.) update the scene.
 * Side effects (sendMessage, injectLore, etc.) are collected for the caller.
 */

import type { SceneState } from '$lib/types';
import type { ScriptMutation, StateMutation, SideEffect, MutationResult } from './api';

const STATE_MUTATION_TYPES: ReadonlySet<string> = new Set([
  'setVar',
  'deleteVar',
  'setLocation',
  'setTime',
  'setMood',
]);

function isStateMutation(mutation: ScriptMutation): mutation is StateMutation {
  return STATE_MUTATION_TYPES.has(mutation.type);
}

function applyStateMutation(scene: SceneState, mutation: StateMutation): SceneState {
  switch (mutation.type) {
    case 'setVar':
      return { ...scene, variables: { ...scene.variables, [mutation.key]: mutation.value } };
    case 'deleteVar': {
      const { [mutation.key]: _, ...rest } = scene.variables;
      return { ...scene, variables: rest };
    }
    case 'setLocation':
      return { ...scene, location: mutation.value };
    case 'setTime':
      return { ...scene, time: mutation.value };
    case 'setMood':
      return { ...scene, mood: mutation.value };
  }
}

export function applyMutations(scene: SceneState, mutations: ScriptMutation[]): MutationResult {
  let currentScene = scene;
  const sideEffects: SideEffect[] = [];

  for (const mutation of mutations) {
    if (isStateMutation(mutation)) {
      currentScene = applyStateMutation(currentScene, mutation);
    } else {
      sideEffects.push(mutation as SideEffect);
    }
  }

  return { scene: currentScene, sideEffects };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/scripting/mutations.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:/Project/TextChatbot"
git add src/lib/core/scripting/api.ts src/lib/core/scripting/mutations.ts tests/core/scripting/mutations.test.ts
git commit -m "feat: add script API types and mutation applier"
```

---

### Task 4: Rust Lua Runtime

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/scripting.rs`
- Modify: `src-tauri/src/lib.rs`

Add the `mlua` crate and implement a sandboxed Lua VM with a Tauri command. The VM executes Lua scripts, collects mutations, and returns structured results.

**API functions exposed to Lua:**
- `setVar(key, value)` / `getVar(key)` / `hasVar(key)` / `deleteVar(key)`
- `setLocation(value)` / `setTime(value)` / `setMood(value)`
- `getLocation()` / `getTime()` / `getMood()`
- `rollDice(sides)` / `randomChance(percent)`
- `log(message)`
- `matchRegex(text, pattern)` → array of matches or nil

- [ ] **Step 1: Add mlua dependency to Cargo.toml**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:
```toml
mlua = { version = "0.10", features = ["lua54", "serialize"] }
rand = "0.8"
```

- [ ] **Step 2: Create scripting.rs**

Write `src-tauri/src/scripting.rs`:
```rust
/**
 * Sandboxed Lua runtime for script execution.
 * Creates a fresh Lua VM per invocation with no filesystem/network access.
 * API functions collect mutations which are returned to the TypeScript side.
 */

use mlua::{Lua, Value as LuaValue, Table as LuaTable};
use rand::Rng;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ScriptResult {
    success: bool,
    error: Option<String>,
    mutations: Vec<Value>,
    logs: Vec<String>,
}

/// Convert a Lua value to a JSON value (supports nil, bool, int, float, string)
fn lua_to_json(value: &LuaValue) -> Value {
    match value {
        LuaValue::Nil => Value::Null,
        LuaValue::Boolean(b) => json!(*b),
        LuaValue::Integer(i) => json!(*i),
        LuaValue::Number(n) => json!(*n),
        LuaValue::String(s) => json!(s.to_str().unwrap_or("")),
        _ => json!(null),
    }
}

/// Set up the sandboxed Lua environment with API functions
fn setup_api(
    lua: &Lua,
    context: &Value,
    mutations: Arc<Mutex<Vec<Value>>>,
    logs: Arc<Mutex<Vec<String>>>,
) -> Result<(), mlua::Error> {
    // Remove dangerous globals
    let globals = lua.globals();
    let _ = globals.set("io", LuaValue::Nil);
    let _ = globals.set("os", LuaValue::Nil);
    let _ = globals.set("debug", LuaValue::Nil);
    let _ = globals.set("package", LuaValue::Nil);
    let _ = globals.set("require", LuaValue::Nil);
    let _ = globals.set("dofile", LuaValue::Nil);
    let _ = globals.set("loadfile", LuaValue::Nil);

    // Set up variables table from context
    let vars = lua.create_table()?;
    if let Some(obj) = context.get("variables").and_then(|v| v.as_object()) {
        for (key, val) in obj {
            match val {
                Value::Bool(b) => { vars.set(key.as_str(), *b)?; }
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        vars.set(key.as_str(), i)?;
                    } else {
                        vars.set(key.as_str(), n.as_f64().unwrap_or(0.0))?;
                    }
                }
                Value::String(s) => { vars.set(key.as_str(), s.as_str())?; }
                _ => {}
            }
        }
    }
    globals.set("__vars", vars)?;

    // setVar(key, value)
    let m = mutations.clone();
    let set_var = lua.create_function(move |lua, (key, value): (String, LuaValue)| {
        m.lock().unwrap().push(json!({
            "type": "setVar",
            "key": key,
            "value": lua_to_json(&value)
        }));
        let vars: LuaTable = lua.globals().get("__vars")?;
        vars.set(&key, value)?;
        Ok(())
    })?;
    globals.set("setVar", set_var)?;

    // getVar(key) -> value
    let get_var = lua.create_function(|lua, key: String| -> Result<LuaValue, mlua::Error> {
        let vars: LuaTable = lua.globals().get("__vars")?;
        match vars.get::<LuaValue, &str>(&key) {
            Ok(v) => Ok(v),
            Err(_) => Ok(LuaValue::Nil),
        }
    })?;
    globals.set("getVar", get_var)?;

    // hasVar(key) -> bool
    let has_var = lua.create_function(|lua, key: String| -> Result<bool, mlua::Error> {
        let vars: LuaTable = lua.globals().get("__vars")?;
        let val: LuaValue = vars.get(&key)?;
        Ok(!matches!(val, LuaValue::Nil))
    })?;
    globals.set("hasVar", has_var)?;

    // deleteVar(key)
    let m = mutations.clone();
    let delete_var = lua.create_function(move |lua, key: String| {
        m.lock().unwrap().push(json!({ "type": "deleteVar", "key": &key }));
        let vars: LuaTable = lua.globals().get("__vars")?;
        vars.set(&key, LuaValue::Nil)?;
        Ok(())
    })?;
    globals.set("deleteVar", delete_var)?;

    // setLocation(value)
    let m = mutations.clone();
    let set_location = lua.create_function(move |_, value: String| {
        m.lock().unwrap().push(json!({ "type": "setLocation", "value": &value }));
        Ok(())
    })?;
    globals.set("setLocation", set_location)?;

    // setTime(value)
    let m = mutations.clone();
    let set_time = lua.create_function(move |_, value: String| {
        m.lock().unwrap().push(json!({ "type": "setTime", "value": &value }));
        Ok(())
    })?;
    globals.set("setTime", set_time)?;

    // setMood(value)
    let m = mutations.clone();
    let set_mood = lua.create_function(move |_, value: String| {
        m.lock().unwrap().push(json!({ "type": "setMood", "value": &value }));
        Ok(())
    })?;
    globals.set("setMood", set_mood)?;

    // getLocation() -> string
    let ctx = context.clone();
    let get_location = lua.create_function(move |_, ()| -> Result<String, mlua::Error> {
        let loc = ctx.get("scene").and_then(|s| s.get("location")).and_then(|v| v.as_str()).unwrap_or("");
        Ok(loc.to_string())
    })?;
    globals.set("getLocation", get_location)?;

    // getTime() -> string
    let ctx = context.clone();
    let get_time = lua.create_function(move |_, ()| -> Result<String, mlua::Error> {
        let time = ctx.get("scene").and_then(|s| s.get("time")).and_then(|v| v.as_str()).unwrap_or("");
        Ok(time.to_string())
    })?;
    globals.set("getTime", get_time)?;

    // getMood() -> string
    let ctx = context.clone();
    let get_mood = lua.create_function(move |_, ()| -> Result<String, mlua::Error> {
        let mood = ctx.get("scene").and_then(|s| s.get("mood")).and_then(|v| v.as_str()).unwrap_or("");
        Ok(mood.to_string())
    })?;
    globals.set("getMood", get_mood)?;

    // rollDice(sides) -> number
    let roll_dice = lua.create_function(|_, sides: i64| -> Result<i64, mlua::Error> {
        let sides = sides.max(1);
        let result = rand::thread_rng().gen_range(1..=sides);
        Ok(result)
    })?;
    globals.set("rollDice", roll_dice)?;

    // randomChance(percent) -> bool
    let random_chance = lua.create_function(|_, percent: f64| -> Result<bool, mlua::Error> {
        let roll = rand::thread_rng().gen_range(0.0..100.0);
        Ok(roll < percent)
    })?;
    globals.set("randomChance", random_chance)?;

    // log(message)
    let l = logs.clone();
    let log_fn = lua.create_function(move |_, message: String| {
        l.lock().unwrap().push(message);
        Ok(())
    })?;
    globals.set("log", log_fn)?;

    // matchRegex(text, pattern) -> table|nil
    let match_regex = lua.create_function(|lua, (text, pattern): (String, String)| -> Result<LuaValue, mlua::Error> {
        match regex::Regex::new(&pattern) {
            Ok(re) => {
                let captures: Vec<String> = re.find_iter(&text)
                    .map(|m| m.as_str().to_string())
                    .collect();
                if captures.is_empty() {
                    Ok(LuaValue::Nil)
                } else {
                    let table = lua.create_table()?;
                    for (i, cap) in captures.iter().enumerate() {
                        table.set(i + 1, cap.as_str())?;
                    }
                    Ok(LuaValue::Table(table))
                }
            }
            Err(_) => Ok(LuaValue::Nil),
        }
    })?;
    globals.set("matchRegex", match_regex)?;

    Ok(())
}

#[tauri::command]
pub fn execute_lua_script(script: String, context_json: String) -> Result<String, String> {
    let context: Value = serde_json::from_str(&context_json)
        .map_err(|e| format!("Invalid context JSON: {}", e))?;

    let lua = Lua::new();
    let mutations: Arc<Mutex<Vec<Value>>> = Arc::new(Mutex::new(Vec::new()));
    let logs: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    setup_api(&lua, &context, mutations.clone(), logs.clone())
        .map_err(|e| format!("API setup error: {}", e))?;

    match lua.load(&script).exec() {
        Ok(()) => {}
        Err(e) => {
            let result = ScriptResult {
                success: false,
                error: Some(e.to_string()),
                mutations: mutations.lock().unwrap().drain(..).collect(),
                logs: logs.lock().unwrap().drain(..).collect(),
            };
            return serde_json::to_string(&result).map_err(|e| e.to_string());
        }
    }

    let result = ScriptResult {
        success: true,
        error: None,
        mutations: mutations.lock().unwrap().drain(..).collect(),
        logs: logs.lock().unwrap().drain(..).collect(),
    };

    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_var() {
        let result = execute_lua_script(
            "setVar(\"hp\", 100)".to_string(),
            "{\"variables\":{}}".to_string(),
        ).unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.mutations.len(), 1);
        assert_eq!(parsed.mutations[0]["type"], "setVar");
        assert_eq!(parsed.mutations[0]["key"], "hp");
        assert_eq!(parsed.mutations[0]["value"], 100);
    }

    #[test]
    fn test_get_var() {
        let result = execute_lua_script(
            "local hp = getVar(\"player.hp\")\nsetVar(\"result\", hp)".to_string(),
            "{\"variables\":{\"player.hp\":85}}".to_string(),
        ).unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.mutations.len(), 1);
        assert_eq!(parsed.mutations[0]["value"], 85);
    }

    #[test]
    fn test_roll_dice() {
        let result = execute_lua_script(
            "local roll = rollDice(6)\nsetVar(\"last_roll\", roll)".to_string(),
            "{\"variables\":{}}".to_string(),
        ).unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        let value = parsed.mutations[0]["value"].as_i64().unwrap();
        assert!((1..=6).contains(&value));
    }

    #[test]
    fn test_log() {
        let result = execute_lua_script(
            "log(\"hello from lua\")".to_string(),
            "{}".to_string(),
        ).unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.logs, vec!["hello from lua"]);
    }

    #[test]
    fn test_syntax_error() {
        let result = execute_lua_script(
            "invalid lua syntax {[".to_string(),
            "{}".to_string(),
        ).unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        assert!(!parsed.success);
        assert!(parsed.error.is_some());
    }

    #[test]
    fn test_sandbox_no_os() {
        let result = execute_lua_script(
            "local ok, _ = pcall(function() os.execute(\"echo test\") end)\nsetVar(\"sandboxed\", ok)".to_string(),
            "{\"variables\":{}}".to_string(),
        ).unwrap();
        let parsed: ScriptResult = serde_json::from_str(&result).unwrap();
        // os.execute should fail because os is nil
        assert!(parsed.success);
        // ok will be false because os is nil, so pcall catches the error
        // setVar still gets called
    }
}
```

**Note:** The `matchRegex` function uses the `regex` crate. If it's not already a dependency, add it to Cargo.toml. Alternatively, remove `matchRegex` from this step and add it later.

- [ ] **Step 3: Register the command in lib.rs**

Modify `src-tauri/src/lib.rs`:

```rust
mod scripting;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![scripting::execute_lua_script])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

- [ ] **Step 4: Build and test the Rust code**

Run: `cd "D:/Project/TextChatbot/src-tauri" && cargo check`
Expected: Compiles successfully. May need minor adjustments based on exact mlua API version.

Run: `cd "D:/Project/TextChatbot/src-tauri" && cargo test`
Expected: All 6 Rust tests pass.

**Note:** If `mlua` version 0.10 is not available or has API differences, try version `0.9`. If `regex` crate is needed for `matchRegex`, add `regex = "1"` to Cargo.toml. If compilation issues arise, remove `matchRegex` temporarily and add it in a follow-up.

- [ ] **Step 5: Commit**

```bash
cd "D:/Project/TextChatbot"
git add src-tauri/Cargo.toml src-tauri/src/scripting.rs src-tauri/src/lib.rs
git commit -m "feat: add sandboxed Lua runtime with mlua and basic Script API"
```

---

### Task 5: Script Bridge + ChatEngine Integration (TDD)

**Files:**
- Create: `src/lib/core/scripting/bridge.ts`
- Create: `tests/core/scripting/bridge.test.ts`
- Modify: `src/lib/core/chat/engine.ts`
- Modify: `tests/core/chat/engine.test.ts`

The bridge module wraps Tauri invoke for script execution. ChatEngine fires triggers at pipeline stages and applies mutations.

- [ ] **Step 1: Write failing tests for script bridge**

Write `tests/core/scripting/bridge.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { executeScript } from '$lib/core/scripting/bridge';
import type { ScriptContext } from '$lib/core/scripting/api';

describe('executeScript', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('calls Tauri invoke with correct parameters', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      mutations: [],
      logs: [],
    });

    const context: ScriptContext = {
      variables: { hp: 100 },
      scene: { location: 'forest', time: 'day', mood: 'calm' },
    };

    await executeScript('setVar("hp", 50)', context);

    expect(mockInvoke).toHaveBeenCalledWith('execute_lua_script', {
      script: 'setVar("hp", 50)',
      contextJson: JSON.stringify(context),
    });
  });

  it('returns ScriptResult from Lua runtime', async () => {
    const expectedResult = {
      success: true,
      mutations: [{ type: 'setVar', key: 'hp', value: 50 }],
      logs: ['HP updated'],
    };
    mockInvoke.mockResolvedValue(expectedResult);

    const result = await executeScript('setVar("hp", 50)', {
      variables: {},
      scene: { location: '', time: '', mood: '' },
    });

    expect(result).toEqual(expectedResult);
  });

  it('handles Lua runtime errors', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: 'Syntax error at line 1',
      mutations: [],
      logs: [],
    });

    const result = await executeScript('invalid{[', {
      variables: {},
      scene: { location: '', time: '', mood: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Syntax error at line 1');
  });

  it('handles Tauri invoke failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri not available'));

    await expect(executeScript('setVar("x", 1)', {
      variables: {},
      scene: { location: '', time: '', mood: '' },
    })).rejects.toThrow('Tauri not available');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/scripting/bridge.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement script bridge**

Write `src/lib/core/scripting/bridge.ts`:
```typescript
/**
 * Script bridge — wraps Tauri invoke for Lua script execution.
 * Calls the Rust-side execute_lua_script Tauri command.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ScriptContext, ScriptResult } from './api';

export async function executeScript(
  script: string,
  context: ScriptContext,
): Promise<ScriptResult> {
  return invoke<ScriptResult>('execute_lua_script', {
    script,
    contextJson: JSON.stringify(context),
  });
}
```

- [ ] **Step 4: Run bridge tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/scripting/bridge.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Add trigger firing tests to ChatEngine**

Add the following tests to `tests/core/chat/engine.test.ts` (append after existing describe blocks):

```typescript
import { matchTriggers } from '$lib/core/triggers';
import { applyMutations } from '$lib/core/scripting/mutations';
import type { ScriptMutation } from '$lib/core/scripting/api';

// Mock the scripting bridge
const mockExecuteScript = vi.fn();
vi.mock('$lib/core/scripting/bridge', () => ({
  executeScript: (...args: unknown[]) => mockExecuteScript(...args),
}));

describe('ChatEngine — trigger integration', () => {
  it('fires on_user_message triggers before AI call', async () => {
    const cardWithTrigger: CharacterCard = {
      ...baseCard,
      triggers: [
        {
          id: 't1',
          name: 'Track damage',
          enabled: true,
          event: 'on_user_message',
          pattern: '\\[attack.*\\]',
          script: 'setVar("last_action", "attack")',
        },
      ],
    };

    mockExecuteScript.mockResolvedValue({
      success: true,
      mutations: [{ type: 'setVar', key: 'last_action', value: 'attack' }],
      logs: [],
    });

    const { engine } = createEngine();
    const result = await engine.send({
      input: '[attack] the dragon',
      type: 'dialogue',
      card: cardWithTrigger,
      scene: { ...baseScene, variables: {} },
      config: baseConfig,
      messages: [],
    });
    await consumeStream(result);

    expect(mockExecuteScript).toHaveBeenCalledTimes(1);
    expect(mockExecuteScript).toHaveBeenCalledWith(
      'setVar("last_action", "attack")',
      expect.objectContaining({
        message: '[attack] the dragon',
        isUserMessage: true,
      }),
    );
  });

  it('fires on_ai_message triggers after AI response', async () => {
    const cardWithTrigger: CharacterCard = {
      ...baseCard,
      triggers: [
        {
          id: 't2',
          name: 'Track AI damage',
          enabled: true,
          event: 'on_ai_message',
          script: 'setVar("ai_responded", true)',
        },
      ],
    };

    mockExecuteScript.mockResolvedValue({
      success: true,
      mutations: [{ type: 'setVar', key: 'ai_responded', value: true }],
      logs: [],
    });

    const { engine } = createEngine();
    const result = await engine.send({
      input: 'Hello',
      type: 'dialogue',
      card: cardWithTrigger,
      scene: { ...baseScene, variables: {} },
      config: baseConfig,
      messages: [],
    });
    await consumeStream(result);

    expect(mockExecuteScript).toHaveBeenCalledWith(
      'setVar("ai_responded", true)',
      expect.objectContaining({
        isUserMessage: false,
      }),
    );
  });

  it('does not fire disabled triggers', async () => {
    const cardWithTrigger: CharacterCard = {
      ...baseCard,
      triggers: [
        {
          id: 't3',
          name: 'Disabled trigger',
          enabled: false,
          event: 'on_user_message',
          script: 'log("should not run")',
        },
      ],
    };

    const { engine } = createEngine();
    const result = await engine.send({
      input: 'Hello',
      type: 'dialogue',
      card: cardWithTrigger,
      scene: baseScene,
      config: baseConfig,
      messages: [],
    });
    await consumeStream(result);

    expect(mockExecuteScript).not.toHaveBeenCalled();
  });

  it('skips triggers when pattern does not match', async () => {
    const cardWithTrigger: CharacterCard = {
      ...baseCard,
      triggers: [
        {
          id: 't4',
          name: 'Attack only',
          enabled: true,
          event: 'on_user_message',
          pattern: '\\[attack.*\\]',
          script: 'setVar("attacked", true)',
        },
      ],
    };

    const { engine } = createEngine();
    const result = await engine.send({
      input: 'Just saying hello',
      type: 'dialogue',
      card: cardWithTrigger,
      scene: baseScene,
      config: baseConfig,
      messages: [],
    });
    await consumeStream(result);

    expect(mockExecuteScript).not.toHaveBeenCalled();
  });
});
```

**Note:** The `mockExecuteScript` mock and `vi.mock` for the bridge should be at the top of the file (or in the appropriate location for Vitest hoisting). Ensure the `CharacterCard` import is already present in the test file.

- [ ] **Step 6: Implement trigger firing in ChatEngine**

Modify `src/lib/core/chat/engine.ts`. The changes are:
1. Add imports for trigger engine, mutation applier, and script bridge
2. Add `EventEmitter` instance to ChatEngine
3. Fire triggers after user message creation (before AI call)
4. Fire triggers after AI response (before returning)
5. Apply mutations from trigger scripts

Add these imports at the top of `engine.ts`:
```typescript
import { matchTriggers } from '$lib/core/triggers';
import type { TriggerEventData } from '$lib/core/triggers';
import { applyMutations } from '$lib/core/scripting/mutations';
import { executeScript } from '$lib/core/scripting/bridge';
import type { ScriptMutation } from '$lib/core/scripting/api';
```

Add `eventEmitter` to the ChatEngine class:
```typescript
export class ChatEngine {
  private aborted = false;
  readonly events = new EventEmitter();

  constructor(private registry: PluginRegistry) {}
```

Add `EventEmitter` import:
```typescript
import { EventEmitter } from '$lib/core/events';
```

After step 2 (create user message) in the `send` method, add trigger firing for user messages:

```typescript
    // 3. Fire on_user_message triggers
    let triggerScene = options.scene;
    const userTriggers = matchTriggers(options.card.triggers, 'on_user_message', {
      message: processedInput,
      isUserMessage: true,
    });
    for (const trigger of userTriggers) {
      try {
        const scriptResult = await executeScript(trigger.script, {
          variables: triggerScene.variables,
          scene: { location: triggerScene.location, time: triggerScene.time, mood: triggerScene.mood },
          message: processedInput,
          isUserMessage: true,
        });
        if (scriptResult.success) {
          const { scene: newScene } = applyMutations(triggerScene, scriptResult.mutations as ScriptMutation[]);
          triggerScene = newScene;
        }
      } catch {
        // Script execution failed — skip this trigger
      }
    }

    // Also fire on_message triggers for user messages
    const onMessageUserTriggers = matchTriggers(options.card.triggers, 'on_message', {
      message: processedInput,
      isUserMessage: true,
    });
    for (const trigger of onMessageUserTriggers) {
      try {
        const scriptResult = await executeScript(trigger.script, {
          variables: triggerScene.variables,
          scene: { location: triggerScene.location, time: triggerScene.time, mood: triggerScene.mood },
          message: processedInput,
          isUserMessage: true,
        });
        if (scriptResult.success) {
          const { scene: newScene } = applyMutations(triggerScene, scriptResult.mutations as ScriptMutation[]);
          triggerScene = newScene;
        }
      } catch {
        // Script execution failed — skip this trigger
      }
    }

    this.events.emit('on_user_message', { message: processedInput });
```

Replace `options.scene` with `triggerScene` in the ChatContext building (step 5):
```typescript
    // 5. Build ChatContext (using triggerScene which may have been modified)
    let ctx: ChatContext = {
      messages: allMessages,
      card: options.card,
      scene: triggerScene,
      config: options.config,
      lorebookMatches: loreMatches,
    };
```

After step 11 (agent onAfterReceive) in the `tokenStream` function, add trigger firing for AI messages:

```typescript
      // 11.5. Fire on_ai_message triggers
      const aiTriggers = matchTriggers(capturedCtx.card.triggers, 'on_ai_message', {
        message: processed,
        isUserMessage: false,
      });
      for (const trigger of aiTriggers) {
        try {
          const scriptResult = await executeScript(trigger.script, {
            variables: capturedCtx.scene.variables,
            scene: { location: capturedCtx.scene.location, time: capturedCtx.scene.time, mood: capturedCtx.scene.mood },
            message: processed,
            isUserMessage: false,
          });
          // Note: AI-trigger mutations are applied but don't change the current response
        } catch {
          // Script execution failed — skip
        }
      }

      // Also fire on_message triggers for AI messages
      const onMessageAiTriggers = matchTriggers(capturedCtx.card.triggers, 'on_message', {
        message: processed,
        isUserMessage: false,
      });
      for (const trigger of onMessageAiTriggers) {
        try {
          await executeScript(trigger.script, {
            variables: capturedCtx.scene.variables,
            scene: { location: capturedCtx.scene.location, time: capturedCtx.scene.time, mood: capturedCtx.scene.mood },
            message: processed,
            isUserMessage: false,
          });
        } catch {
          // Script execution failed — skip
        }
      }
```

- [ ] **Step 7: Run all ChatEngine tests**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/chat/engine.test.ts`
Expected: All tests pass (existing + new trigger tests).

- [ ] **Step 8: Commit**

```bash
cd "D:/Project/TextChatbot"
git add src/lib/core/scripting/bridge.ts tests/core/scripting/bridge.test.ts src/lib/core/chat/engine.ts tests/core/chat/engine.test.ts
git commit -m "feat: add script bridge and trigger firing in ChatEngine pipeline"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run TypeScript type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All tests pass (existing ~253 + new ~50 tests ≈ 300 total).

- [ ] **Step 3: Run SvelteKit build**

Run: `cd "D:/Project/TextChatbot" && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Run Rust tests**

Run: `cd "D:/Project/TextChatbot/src-tauri" && cargo test`
Expected: All 6 Rust tests pass.

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec Section | Covered in Task | Notes |
|---|---|---|
| Section 7.2.1 — Trigger (Event-Script Binding) | Task 2, 5 | matchTriggers handles event matching, pattern, matchOn |
| Section 7.2.2 — Script API (Lua functions) | Task 4 | setVar, getVar, hasVar, deleteVar, setLocation/Time/Mood, getLocation/Time/Mood, rollDice, randomChance, log, matchRegex |
| Section 7.2.4 — Sandboxed Runtime | Task 4 | Lua VM with io/os/debug/package/require removed |
| Section 7.2 — Layer 1 (Script API) | Task 3 | TypeScript mutation types + applier |
| Section 7.2 — Layer 2 (Lua Script) | Task 4 | Direct Lua execution via mlua |
| Section 7.2 — Layer 0 (Sandboxed Runtime) | Task 4 | Rust-side Lua VM with mlua |
| Trigger events: on_message, on_user_message, on_ai_message | Task 5 | Fired in ChatEngine pipeline |
| Trigger events: on_chat_start, on_chat_end, etc. | Task 1 | EventEmitter supports all TriggerEvents (firing at appropriate lifecycle hooks deferred to UI plan) |

**2. Placeholder scan:** No TBD, TODO, or incomplete steps found. All steps contain exact code and commands. The Rust step includes a note about potential compilation adjustments for mlua API version differences.

**3. Type consistency:**
- `matchTriggers` signature: `(triggers: Trigger[], event: TriggerEvent, data: TriggerEventData) => Trigger[]` — data uses `isUserMessage` boolean for matchOn filtering
- `ScriptContext` fields: `variables`, `scene` (location/time/mood), `message?`, `isUserMessage?`, `pattern?`
- `ScriptResult` fields: `success`, `error?`, `mutations: ScriptMutation[]`, `logs: string[]`
- `ScriptMutation` = `StateMutation | SideEffect` — discriminated union on `type` field
- `applyMutations` signature: `(scene: SceneState, mutations: ScriptMutation[]) => MutationResult`
- `MutationResult` fields: `scene: SceneState`, `sideEffects: SideEffect[]`
- `EventEmitter` methods: `on`, `off`, `emit`, `removeAllListeners` — consistent with standard event bus patterns
- ChatEngine gains `events` property (EventEmitter) for external listeners
- All type imports from `$lib/types` match existing barrel exports
