# Lorebook + Variable Store — Implementation Plan 6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the lorebook matcher with full spec features (selective mode, regex, scope filtering, recursive scanning, full-word matching) and add a pure variable store module with template substitution for `{{var.*}}` in prompts.

**Architecture:** Enhance existing `lorebook.ts` matcher to support all spec-defined matching strategies. Add a new `variables.ts` pure-function module for variable CRUD (foundation for scripting engine in Plan 7). Update the prompt builder's `substituteTemplates` to handle `{{var.*}}` substitution using the variable store.

**Tech Stack:** TypeScript, Vitest

---

## Prerequisites

- Plan 1 completed (types + PluginRegistry)
- Plan 2 completed (storage + stores)
- Plan 3 completed (AI providers)
- Plan 4 completed (card formats + prompt builder)
- Plan 5 completed (chat engine + pipeline)
- Working directory: `D:/Project/TextChatbot`

---

## File Structure (created/modified by this plan)

```
D:/Project/TextChatbot/
├── src/lib/core/chat/lorebook.ts            [MODIFIED] Enhanced matcher
├── src/lib/core/variables.ts                [NEW] Variable store pure functions
├── src/lib/plugins/prompt-builder/default.ts [MODIFIED] Add {{var.*}} substitution
├── tests/core/chat/lorebook.test.ts         [MODIFIED] Add tests for new features
├── tests/core/variables.test.ts             [NEW] Variable store tests
├── tests/plugins/prompt-builder/default.test.ts [MODIFIED] Add {{var.*}} tests
```

**Key type references (already exist, do NOT modify):**
- `LorebookEntry`, `LorebookSettings`, `LorebookMode`, `LorebookScope` — `src/lib/types/lorebook.ts`
- `VariableStore`, `VariableValue` — `src/lib/types/script.ts`
- `SceneState` — `src/lib/types/scene.ts`
- `CharacterCard` — `src/lib/types/character.ts`
- `Message` — `src/lib/types/message.ts`
- `PromptBuilderPlugin` — `src/lib/types/plugin.ts`
- `PluginRegistry` — `src/lib/plugins/registry.ts`

**Existing code to modify:**
- `src/lib/core/chat/lorebook.ts` — current `matchLorebook` function (basic keyword matching)
- `src/lib/plugins/prompt-builder/default.ts` — current `substituteTemplates` function

---

### Task 1: Enhanced Lorebook Matcher (TDD)

**Files:**
- Modify: `src/lib/core/chat/lorebook.ts`
- Modify: `tests/core/chat/lorebook.test.ts`

**Current `matchLorebook` supports:** keyword matching, constant entries, scanDepth, priority sorting, token budget, activationPercent, case sensitivity.

**New features to add:**
1. **Selective mode** — when `mode === 'selective'`, require both `keywords` AND `secondaryKeywords` to match
2. **Regex matching** — use `entry.regex` field for pattern matching
3. **Scope filtering** — filter by `scope` ('global' | 'character' | 'scenario') and `characterIds`
4. **Recursive scanning** — when `settings.recursiveScanning`, matched entries' content is scanned for further keyword matches
5. **Full-word matching** — when `settings.fullWordMatching`, match whole words only

**New `matchLorebook` signature (backward compatible):**
```typescript
export function matchLorebook(
  messages: Message[],
  entries: LorebookEntry[],
  settings: LorebookSettings,
  characterId?: string,
): LorebookEntry[]
```

- [ ] **Step 1: Write failing tests for enhanced lorebook matcher**

Add the following tests to `tests/core/chat/lorebook.test.ts` (append new describe blocks after existing ones):

```typescript
describe('matchLorebook — selective mode', () => {
  it('requires both keywords AND secondaryKeywords in selective mode', () => {
    const messages = [makeMessage('The dragon used magic')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        secondaryKeywords: ['magic'],
        mode: 'selective',
        content: 'Dragon magic lore',
      }),
    ];

    // Both 'dragon' AND 'magic' present → match
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Dragon magic lore');
  });

  it('does not match selective entry when only primary keyword present', () => {
    const messages = [makeMessage('The dragon attacked')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        secondaryKeywords: ['magic'],
        mode: 'selective',
        content: 'Dragon magic lore',
      }),
    ];

    // Only 'dragon' present, 'magic' missing → no match
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('does not match selective entry when only secondary keyword present', () => {
    const messages = [makeMessage('Some magic spell')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        secondaryKeywords: ['magic'],
        mode: 'selective',
        content: 'Dragon magic lore',
      }),
    ];

    // Only 'magic' present, 'dragon' missing → no match
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('normal mode ignores secondaryKeywords', () => {
    const messages = [makeMessage('The dragon attacked')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        secondaryKeywords: ['magic'],
        mode: 'normal',
        content: 'Dragon lore',
      }),
    ];

    // Normal mode: secondaryKeywords ignored, primary matches → match
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
  });
});

describe('matchLorebook — regex matching', () => {
  it('matches entry using regex pattern', () => {
    const messages = [makeMessage('Damage: 42 points')];
    const entries = [
      makeEntry({
        keywords: [],
        regex: 'Damage:\\s*\\d+',
        content: 'Combat lore',
      }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Combat lore');
  });

  it('does not match when regex does not match', () => {
    const messages = [makeMessage('Healing: 10 points')];
    const entries = [
      makeEntry({
        keywords: [],
        regex: 'Damage:\\s*\\d+',
        content: 'Combat lore',
      }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });

  it('matches when either keywords or regex matches', () => {
    const messages = [makeMessage('The dragon breathed fire')];
    const entries = [
      makeEntry({
        keywords: ['unicorn'],
        regex: 'dragon',
        content: 'Dragon lore',
      }),
    ];

    // Keywords don't match, but regex does → match
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
  });

  it('skips invalid regex patterns gracefully', () => {
    const messages = [makeMessage('Hello world')];
    const entries = [
      makeEntry({
        keywords: [],
        regex: '[invalid',
        content: 'Broken lore',
      }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });
});

describe('matchLorebook — scope filtering', () => {
  it('includes global scope entries regardless of characterId', () => {
    const messages = [makeMessage('The dragon appeared')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        scope: 'global',
        content: 'Global dragon lore',
      }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings, 'char-alice');
    expect(result).toHaveLength(1);
  });

  it('includes character scope entry when characterId matches', () => {
    const messages = [makeMessage('The dragon appeared')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        scope: 'character',
        characterIds: ['char-alice', 'char-bob'],
        content: 'Alice-specific dragon lore',
      }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings, 'char-alice');
    expect(result).toHaveLength(1);
  });

  it('excludes character scope entry when characterId does not match', () => {
    const messages = [makeMessage('The dragon appeared')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        scope: 'character',
        characterIds: ['char-bob'],
        content: 'Bob-specific dragon lore',
      }),
    ];

    const result = matchLorebook(messages, entries, defaultSettings, 'char-alice');
    expect(result).toHaveLength(0);
  });

  it('excludes character scope entry when no characterId provided', () => {
    const messages = [makeMessage('The dragon appeared')];
    const entries = [
      makeEntry({
        keywords: ['dragon'],
        scope: 'character',
        characterIds: ['char-alice'],
        content: 'Alice dragon lore',
      }),
    ];

    // No characterId → character-scoped entries excluded
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(0);
  });
});

describe('matchLorebook — full-word matching', () => {
  const fullWordSettings: LorebookSettings = {
    ...defaultSettings,
    fullWordMatching: true,
  };

  it('matches whole words only when fullWordMatching is true', () => {
    const messages = [makeMessage('The cat sat down')];
    const entries = [
      makeEntry({ keywords: ['cat'], content: 'Cat lore' }),
    ];

    const result = matchLorebook(messages, entries, fullWordSettings);
    expect(result).toHaveLength(1);
  });

  it('does not match partial words when fullWordMatching is true', () => {
    const messages = [makeMessage('The category is wrong')];
    const entries = [
      makeEntry({ keywords: ['cat'], content: 'Cat lore' }),
    ];

    // 'cat' appears inside 'category' → not a full word match
    const result = matchLorebook(messages, entries, fullWordSettings);
    expect(result).toHaveLength(0);
  });

  it('matches word boundaries at punctuation', () => {
    const messages = [makeMessage('The cat, sat down')];
    const entries = [
      makeEntry({ keywords: ['cat'], content: 'Cat lore' }),
    ];

    // 'cat' followed by comma → word boundary → match
    const result = matchLorebook(messages, entries, fullWordSettings);
    expect(result).toHaveLength(1);
  });
});

describe('matchLorebook — recursive scanning', () => {
  const recursiveSettings: LorebookSettings = {
    ...defaultSettings,
    recursiveScanning: true,
  };

  it('matches entries triggered by matched entry content', () => {
    const messages = [makeMessage('The elf used magic')];
    const entries = [
      makeEntry({ keywords: ['elf'], content: 'Elves are magical beings from the forest.' }),
      makeEntry({ keywords: ['forest'], content: 'The forest is ancient.' }),
    ];

    // First pass: 'elf' matches entry 1 → content contains 'forest'
    // Second pass: 'forest' matches entry 2
    const result = matchLorebook(messages, entries, recursiveSettings);
    expect(result).toHaveLength(2);
    expect(result.some((e) => e.content === 'The forest is ancient.')).toBe(true);
  });

  it('does not recurse when recursiveScanning is false', () => {
    const messages = [makeMessage('The elf used magic')];
    const entries = [
      makeEntry({ keywords: ['elf'], content: 'Elves are magical beings from the forest.' }),
      makeEntry({ keywords: ['forest'], content: 'The forest is ancient.' }),
    ];

    // No recursion → only 'elf' entry matches
    const result = matchLorebook(messages, entries, defaultSettings);
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('Elves');
  });

  it('prevents infinite recursion via visited set', () => {
    const messages = [makeMessage('alpha')];
    const entries = [
      makeEntry({ keywords: ['alpha'], content: 'alpha and beta' }),
      makeEntry({ keywords: ['beta'], content: 'beta and alpha' }),
    ];

    // Should not loop infinitely — each entry only added once
    const result = matchLorebook(messages, entries, recursiveSettings);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/chat/lorebook.test.ts`
Expected: New tests FAIL — selective mode, regex, scope, fullWord, recursive scanning not implemented.

- [ ] **Step 3: Implement enhanced lorebook matcher**

Replace the entire `src/lib/core/chat/lorebook.ts` with:

```typescript
/**
 * Lorebook matching — scans messages for keyword/regex matches against lorebook entries.
 * Returns matched entries sorted by priority within the token budget.
 *
 * Features: selective mode, regex matching, scope filtering,
 * recursive scanning, full-word matching.
 */

import type { Message, LorebookEntry, LorebookSettings } from '$lib/types';

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function matchesKeywords(
  text: string,
  keywords: string[],
  caseSensitive: boolean,
  fullWord: boolean,
): boolean {
  const search = caseSensitive ? text : text.toLowerCase();
  return keywords.some((kw) => {
    const k = caseSensitive ? kw : kw.toLowerCase();
    if (fullWord) {
      // Word boundary matching
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      return regex.test(search);
    }
    return search.includes(k);
  });
}

function matchesRegex(text: string, pattern: string, caseSensitive: boolean): boolean {
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    return regex.test(text);
  } catch {
    return false;
  }
}

function entryMatches(
  text: string,
  entry: LorebookEntry,
  fullWord: boolean,
): boolean {
  // Selective mode: require both primary AND secondary keywords
  if (entry.mode === 'selective') {
    const primaryMatch = entry.keywords.length > 0
      && matchesKeywords(text, entry.keywords, entry.caseSensitive, fullWord);
    const secondaryMatch = entry.secondaryKeywords && entry.secondaryKeywords.length > 0
      && matchesKeywords(text, entry.secondaryKeywords, entry.caseSensitive, fullWord);
    return primaryMatch && secondaryMatch;
  }

  // Normal/other modes: keyword OR regex match
  const keywordMatch = entry.keywords.length > 0
    && matchesKeywords(text, entry.keywords, entry.caseSensitive, fullWord);

  if (keywordMatch) return true;

  // Try regex pattern if present
  if (entry.regex) {
    return matchesRegex(text, entry.regex, entry.caseSensitive);
  }

  return false;
}

function isInScope(entry: LorebookEntry, characterId?: string): boolean {
  if (entry.scope === 'global') return true;
  if (entry.scope === 'character') {
    if (!characterId || !entry.characterIds?.length) return false;
    return entry.characterIds.includes(characterId);
  }
  // 'scenario' scope is always included (scenario filtering done at higher level)
  return true;
}

export function matchLorebook(
  messages: Message[],
  entries: LorebookEntry[],
  settings: LorebookSettings,
  characterId?: string,
): LorebookEntry[] {
  const recent = messages.slice(-settings.scanDepth);
  const text = recent.map((m) => m.content).join(' ');

  const matched: LorebookEntry[] = [];
  const matchedIds = new Set<string>();

  function scan(scanText: string): void {
    for (const entry of entries) {
      if (!entry.enabled) continue;
      if (matchedIds.has(entry.id)) continue;
      if (!isInScope(entry, characterId)) continue;

      // Constant entries always match
      if (entry.constant) {
        matchedIds.add(entry.id);
        matched.push(entry);
        continue;
      }

      // Non-constant entries need keywords or regex
      if (entry.keywords.length === 0 && !entry.regex) continue;

      if (entryMatches(scanText, entry, settings.fullWordMatching)) {
        // Apply activationPercent (stochastic activation)
        if (entry.activationPercent !== undefined && entry.activationPercent < 100) {
          if (Math.random() * 100 > entry.activationPercent) continue;
        }
        matchedIds.add(entry.id);
        matched.push(entry);

        // Recursive scanning: scan matched content for more entries
        if (settings.recursiveScanning && entry.content) {
          scan(entry.content);
        }
      }
    }
  }

  scan(text);

  // Sort by priority (higher first)
  matched.sort((a, b) => b.priority - a.priority);

  // Enforce token budget
  let used = 0;
  const result: LorebookEntry[] = [];
  for (const entry of matched) {
    const cost = entry.tokenLimit ?? estimateTokens(entry.content);
    if (used + cost > settings.tokenBudget) continue;
    used += cost;
    result.push(entry);
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/chat/lorebook.test.ts`
Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/core/chat/lorebook.ts tests/core/chat/lorebook.test.ts
git commit -m "feat: enhance lorebook matcher with selective mode, regex, scope, recursion, full-word"
```

---

### Task 2: Variable Store Module (TDD)

**Files:**
- Create: `src/lib/core/variables.ts`
- Create: `tests/core/variables.test.ts`

**Pure functions operating on `VariableStore` (Record<string, VariableValue>)**. These are the foundation for the scripting engine API (Plan 7) and template substitution (Task 3).

- [ ] **Step 1: Write failing tests for variable store**

Write `tests/core/variables.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getVar,
  setVar,
  deleteVar,
  hasVar,
  listVars,
  formatVarValue,
} from '$lib/core/variables';
import type { VariableStore } from '$lib/types';

describe('getVar', () => {
  it('returns value for existing key', () => {
    const store: VariableStore = { 'player.hp': 100, name: 'Alice' };
    expect(getVar(store, 'player.hp')).toBe(100);
    expect(getVar(store, 'name')).toBe('Alice');
  });

  it('returns undefined for missing key', () => {
    const store: VariableStore = { name: 'Alice' };
    expect(getVar(store, 'missing')).toBeUndefined();
  });

  it('returns undefined for empty store', () => {
    expect(getVar({}, 'any')).toBeUndefined();
  });
});

describe('setVar', () => {
  it('sets a new key-value pair', () => {
    const store: VariableStore = {};
    const result = setVar(store, 'player.hp', 100);
    expect(result['player.hp']).toBe(100);
  });

  it('overwrites existing value', () => {
    const store: VariableStore = { count: 5 };
    const result = setVar(store, 'count', 10);
    expect(result.count).toBe(10);
  });

  it('does not mutate original store', () => {
    const store: VariableStore = { a: 1 };
    const result = setVar(store, 'b', 2);
    expect(store).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles string values', () => {
    const store: VariableStore = {};
    const result = setVar(store, 'location', 'dark_forest');
    expect(result.location).toBe('dark_forest');
  });

  it('handles boolean values', () => {
    const store: VariableStore = {};
    const result = setVar(store, 'flags.met_king', true);
    expect(result['flags.met_king']).toBe(true);
  });
});

describe('deleteVar', () => {
  it('removes a key from the store', () => {
    const store: VariableStore = { a: 1, b: 2 };
    const result = deleteVar(store, 'a');
    expect(result).toEqual({ b: 2 });
  });

  it('returns unchanged store when key does not exist', () => {
    const store: VariableStore = { a: 1 };
    const result = deleteVar(store, 'missing');
    expect(result).toEqual({ a: 1 });
  });

  it('does not mutate original store', () => {
    const store: VariableStore = { a: 1, b: 2 };
    deleteVar(store, 'a');
    expect(store).toEqual({ a: 1, b: 2 });
  });
});

describe('hasVar', () => {
  it('returns true for existing key', () => {
    const store: VariableStore = { hp: 100 };
    expect(hasVar(store, 'hp')).toBe(true);
  });

  it('returns false for missing key', () => {
    const store: VariableStore = { hp: 100 };
    expect(hasVar(store, 'mp')).toBe(false);
  });

  it('returns true for falsy values', () => {
    const store: VariableStore = { count: 0, flag: false, name: '' };
    expect(hasVar(store, 'count')).toBe(true);
    expect(hasVar(store, 'flag')).toBe(true);
    expect(hasVar(store, 'name')).toBe(true);
  });
});

describe('listVars', () => {
  it('returns all keys and values', () => {
    const store: VariableStore = { hp: 100, name: 'Alice', active: true };
    const list = listVars(store);
    expect(list).toEqual([
      ['hp', 100],
      ['name', 'Alice'],
      ['active', true],
    ]);
  });

  it('returns empty array for empty store', () => {
    expect(listVars({})).toEqual([]);
  });
});

describe('formatVarValue', () => {
  it('formats string value', () => {
    expect(formatVarValue('hello')).toBe('hello');
  });

  it('formats number value', () => {
    expect(formatVarValue(42)).toBe('42');
  });

  it('formats boolean value', () => {
    expect(formatVarValue(true)).toBe('true');
    expect(formatVarValue(false)).toBe('false');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/variables.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement variable store module**

Write `src/lib/core/variables.ts`:

```typescript
/**
 * Variable store — pure functions for CRUD operations on VariableStore.
 * Foundation for the scripting engine API (Plan 7) and template substitution.
 */

import type { VariableStore, VariableValue } from '$lib/types';

export function getVar(store: VariableStore, key: string): VariableValue | undefined {
  return store[key];
}

export function setVar(store: VariableStore, key: string, value: VariableValue): VariableStore {
  return { ...store, [key]: value };
}

export function deleteVar(store: VariableStore, key: string): VariableStore {
  const { [key]: _, ...rest } = store;
  return rest;
}

export function hasVar(store: VariableStore, key: string): boolean {
  return key in store;
}

export function listVars(store: VariableStore): [string, VariableValue][] {
  return Object.entries(store);
}

export function formatVarValue(value: VariableValue): string {
  return String(value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/core/variables.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/core/variables.ts tests/core/variables.test.ts
git commit -m "feat: add variable store module with pure CRUD functions"
```

---

### Task 3: Template Substitution Enhancement (TDD)

**Files:**
- Modify: `src/lib/plugins/prompt-builder/default.ts`
- Modify: `tests/plugins/prompt-builder/default.test.ts`

Add `{{var.*}}` template substitution to the prompt builder. The `substituteTemplates` function gains a `variables` parameter from `VariableStore`.

- [ ] **Step 1: Write failing tests for {{var.*}} substitution**

Add the following tests to `tests/plugins/prompt-builder/default.test.ts` (append new describe blocks after existing ones):

```typescript
describe('buildSystemPrompt — variable substitution', () => {
  const cardWithVars: CharacterCard = {
    ...mockCard,
    systemPrompt: 'HP: {{var.player.hp}}, Location: {{var.location}}, Name: {{var.name}}',
  };
  const sceneWithVars: SceneState = {
    ...mockScene,
    variables: {
      'player.hp': 85,
      location: 'dark_forest',
      name: 'Alice',
      active: true,
    },
  };

  it('substitutes {{var.key}} with variable values', () => {
    const prompt = defaultPromptBuilder.buildSystemPrompt(cardWithVars, sceneWithVars);
    expect(prompt).toBe('HP: 85, Location: dark_forest, Name: Alice');
  });

  it('replaces unknown variable with empty string', () => {
    const card = { ...mockCard, systemPrompt: 'Value: {{var.unknown_key}}' };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, { ...mockScene, variables: {} });
    expect(prompt).toBe('Value: ');
  });

  it('handles boolean variable values', () => {
    const card = { ...mockCard, systemPrompt: 'Active: {{var.active}}' };
    const scene = { ...mockScene, variables: { active: true } };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, scene);
    expect(prompt).toBe('Active: true');
  });

  it('handles empty variables object', () => {
    const card = { ...mockCard, systemPrompt: '{{var.test}}' };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, { ...mockScene, variables: {} });
    expect(prompt).toBe('');
  });

  it('works alongside other template variables', () => {
    const card = {
      ...mockCard,
      systemPrompt: '{{char}} has {{var.player.hp}} HP. User: {{user}}',
    };
    const scene = { ...mockScene, variables: { 'player.hp': 100 } };
    const prompt = defaultPromptBuilder.buildSystemPrompt(card, scene);
    expect(prompt).toBe('Alice has 100 HP. User: User');
  });
});

describe('buildContext — variable substitution', () => {
  it('substitutes {{var.*}} in message content', () => {
    const messages: Message[] = [
      { role: 'user', content: 'HP is {{var.player.hp}}', type: 'dialogue', timestamp: 1000 },
    ];
    const scene: SceneState = {
      ...mockScene,
      variables: { 'player.hp': 75 },
    };
    const context = defaultPromptBuilder.buildContext(messages, scene);
    expect(context).toContain('HP is 75');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/prompt-builder/default.test.ts`
Expected: New tests FAIL — `{{var.*}}` not substituted.

- [ ] **Step 3: Implement {{var.*}} template substitution**

Modify `src/lib/plugins/prompt-builder/default.ts`.

Replace the `substituteTemplates` function with:

```typescript
function substituteTemplates(
  text: string,
  card: CharacterCard,
  scene: SceneState,
): string {
  return text
    .replace(/\{\{char\.name\}\}/g, card.name)
    .replace(/\{\{char\}\}/g, card.name)
    .replace(/\{\{user\}\}/g, 'User')
    .replace(/\{\{scene\.location\}\}/g, scene.location || '')
    .replace(/\{\{scene\.time\}\}/g, scene.time || '')
    .replace(/\{\{scene\.mood\}\}/g, scene.mood || '')
    .replace(/\{\{var\.([a-zA-Z0-9_.]+)\}\}/g, (_, key: string) => {
      const value = scene.variables[key];
      return value !== undefined ? String(value) : '';
    });
}
```

The only change is adding the `.replace()` call for `{{var.*}}` at the end. The rest of the file stays exactly the same.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run tests/plugins/prompt-builder/default.test.ts`
Expected: All tests pass (existing + new).

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/prompt-builder/default.ts tests/plugins/prompt-builder/default.test.ts
git commit -m "feat: add {{var.*}} template substitution to prompt builder"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Run type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All tests pass (existing ~210 + new ~40 tests).

- [ ] **Step 3: Run SvelteKit build**

Run: `cd "D:/Project/TextChatbot" && npm run build`
Expected: Build succeeds.

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec Section | Covered in Task | Notes |
|---|---|---|
| Section 7.1 — Selective mode (keywords AND secondaryKeywords) | Task 1 | `mode === 'selective'` requires both primary and secondary match |
| Section 7.1 — Regex matching | Task 1 | `entry.regex` field used for pattern matching |
| Section 7.1 — Scope filtering (global/character/scenario) | Task 1 | `isInScope` checks scope + characterIds |
| Section 7.1 — Recursive scanning | Task 1 | `settings.recursiveScanning` enables recursive content scanning |
| Section 7.1 — Full-word matching | Task 1 | `settings.fullWordMatching` uses `\b` word boundaries |
| Section 7.1 — Token budget + priority | Task 1 | Existing, preserved |
| Section 7.3 — Variable Store CRUD | Task 2 | `getVar`, `setVar`, `deleteVar`, `hasVar`, `listVars`, `formatVarValue` |
| Section 7.3 — Variable access in prompts | Task 3 | `{{var.key}}` template substitution |
| Section 7.2.2 — Script API: setVar/getVar/deleteVar/hasVar/listVars | Task 2 | Pure functions ready for Lua bridge in Plan 7 |

**2. Placeholder scan:** No TBD, TODO, or incomplete steps found. All steps contain exact code and commands.

**3. Type consistency:**
- `matchLorebook` signature: `(messages, entries, settings, characterId?)` — new optional parameter, backward compatible
- `substituteTemplates` signature unchanged — reads `scene.variables` directly
- `VariableStore` = `Record<string, VariableValue>` from `src/lib/types/script.ts`
- `VariableValue` = `string | number | boolean` from `src/lib/types/script.ts`
- All imports from `$lib/types` match existing type definitions
