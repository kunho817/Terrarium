# User Scope Prompt Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the default system prompt with improved creativity/emotion/body/sensory instructions, and add a global output language selector that auto-injects a language instruction into prompt assembly.

**Architecture:** The system prompt is rewritten in `defaults.ts` with a migration path from v1 to v2. Language selection is stored in `AppSettings.outputLanguage`, passed through `AssemblyContext` to the assembler, and injected as a system message during assembly.

**Tech Stack:** SvelteKit 5, Vitest, existing preset/assembly system

---

## File Structure

### Modified Files

| File | Change |
|------|--------|
| `src/lib/core/presets/defaults.ts` | Rewrite `DEFAULT_SYSTEM_PROMPT`, add v2 migration marker |
| `src/lib/core/chat/prompt-assembler.ts` | Add `outputLanguage` to `AssemblyContext`, inject language message |
| `src/lib/core/chat/engine.ts` | Pass `outputLanguage` from settings to assembly context |
| `src/lib/storage/settings.ts` | Add `outputLanguage` to `AppSettings` interface |
| `src/lib/stores/settings.ts` | Add `outputLanguage` default, add migration for missing field |
| `src/routes/settings/+page.svelte` | Add Language dropdown section after Theme |
| `tests/core/chat/prompt-assembler.test.ts` | Add 3 tests for language injection |

---

### Task 1: Rewrite Default System Prompt & Migration

**Files:**
- Modify: `src/lib/core/presets/defaults.ts`

- [ ] **Step 1: Replace `DEFAULT_SYSTEM_PROMPT` and update migration logic**

In `src/lib/core/presets/defaults.ts`, replace the `DEFAULT_SYSTEM_PROMPT` constant and add the v2 migration marker. Replace the old constant and migration code:

```ts
/** Current system prompt content — exported for use in settings migration. */
export const DEFAULT_SYSTEM_PROMPT = `1. This is roleplay. You are the actor and novelist. Never write as or for {{user}} — only the user controls {{user}}'s actions, words, and decisions.

2. Write from third-person omniscient perspective. Narrate through characters' senses, thoughts, emotions, and physical experience. Make every moment feel lived-in and tangible.

3. Prose quality: Vary sentence structure, rhythm, and vocabulary across responses. Avoid repeating descriptive patterns, emotional beats, or sentence openings. Introduce fresh metaphors, unexpected character reactions, and non-obvious developments. Subvert clichés rather than leaning on them.

4. Emotional depth: Convey the inner emotional landscape through micro-expressions, changes in tone, hesitation, physiological reactions (flushed skin, trembling, held breath), and shifts in behavior — not just stated feelings. Layer conflicting emotions when characters experience them. Let emotional subtext and tension drive scenes alongside action.

5. Physical presence: Describe body language, posture shifts, gestures, proximity changes, touch pressure, muscle tension or relaxation, breathing patterns, and somatic sensations. Convey how characters inhabit their bodies — fatigue, energy, warmth, pain, grounding. Weave physical description naturally into action and dialogue.

6. Sensory immersion: Engage all five senses in every scene — not just sight. Include texture, temperature, weight, ambient sound, air quality, scent, taste where relevant. Build atmosphere through accumulated sensory detail rather than abstract description. Let the environment feel tangible.

7. Always wrap character dialogue in quotation marks ("Like this."). Keep narrative description separate from dialogue. Never use quotation marks for narration, thoughts, or actions — only for spoken words.

8. Write long, detailed responses (4+ paragraphs, 400+ words). Develop scenes slowly with rich sensory and emotional detail. Do not summarize or rush through events. Each response should feel like a full scene, not a brief exchange.

9. Leave room for {{user}} interaction. Don't rush scenes — unfold them gradually. React to what {{user}} does, don't script around it.`;
```

Add the v2 marker constant after the existing `OLD_AUTHORS_NOTE_MARKER`:

```ts
/** Old system prompt markers — used to detect outdated presets during migration. */
const OLD_SYSTEM_PROMPT_MARKER = 'Write a 3+ paragraph response with detailed dialogue';
const OLD_SYSTEM_PROMPT_MARKER_V2 = 'Actively research and utilize diverse cultural content';
const OLD_AUTHORS_NOTE_MARKER = 'Use markdown formatting';
```

Update the `migratePresetItems` function to handle v0, v1, and v2 migration:

```ts
export function migratePresetItems(items: PromptItem[]): boolean {
  let changed = false;

  for (const item of items) {
    if (item.type === 'system' && item.name === 'System Prompt') {
      const isOldV0 = item.content.includes(OLD_SYSTEM_PROMPT_MARKER);
      const isOldV1 = item.content.includes(OLD_SYSTEM_PROMPT_MARKER_V2);
      const isEmpty = item.content === '';
      const isAlreadyCurrent = item.content === DEFAULT_SYSTEM_PROMPT;
      if ((isEmpty || isOldV0 || isOldV1) && !isAlreadyCurrent) {
        item.content = DEFAULT_SYSTEM_PROMPT;
        changed = true;
      }
    }
    if (item.type === 'postHistoryInstructions' && item.name === "Author's Note") {
      const isOld = item.content.includes(OLD_AUTHORS_NOTE_MARKER);
      const isEmpty = item.content === '';
      const isAlreadyCurrent = item.content === DEFAULT_AUTHORS_NOTE;
      if ((isEmpty || isOld) && !isAlreadyCurrent) {
        item.content = DEFAULT_AUTHORS_NOTE;
        changed = true;
      }
    }
  }

  return changed;
}
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All 504 tests pass. The migration logic is backward-compatible — existing tests that check for `'This is roleplay'` will still pass since the new prompt also starts with that phrase.

- [ ] **Step 3: Commit**

```bash
git add src/lib/core/presets/defaults.ts
git commit -m "feat: rewrite default system prompt with creativity, emotion, body, sensory instructions"
```

---

### Task 2: Settings Storage for Output Language

**Files:**
- Modify: `src/lib/storage/settings.ts`
- Modify: `src/lib/stores/settings.ts`

- [ ] **Step 1: Add `outputLanguage` to `AppSettings` interface**

In `src/lib/storage/settings.ts`, add the field to the `AppSettings` interface (after `memorySettings`):

```ts
  outputLanguage?: string;
```

So the interface becomes:

```ts
export interface AppSettings {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  promptPresets?: PromptPresetSettings;
  developerMode?: boolean;
  imageGeneration?: ImageGenerationConfig;
  defaultPersonaId?: string;
  customArtStylePresets?: ArtStylePreset[];
  modelSlots?: Record<string, ModelSlot>;
  memorySettings?: MemorySettings;
  outputLanguage?: string;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Add default and migration in settings store**

In `src/lib/stores/settings.ts`, add `outputLanguage: ''` to the initial state in `writable<AppSettings>({...})`, and add a migration block in the `load()` method.

Add to the initial state object (after `memorySettings`):

```ts
    outputLanguage: '',
```

Add migration in `load()` (after the `memorySettings` migration block, before `set(settings)`):

```ts
      if (settings.outputLanguage === undefined) {
        settings.outputLanguage = '';
      }
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All 504 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/settings.ts src/lib/stores/settings.ts
git commit -m "feat: add outputLanguage setting with default and migration"
```

---

### Task 3: Prompt Assembly Language Injection

**Files:**
- Modify: `src/lib/core/chat/prompt-assembler.ts`
- Modify: `src/lib/core/chat/engine.ts`
- Modify: `tests/core/chat/prompt-assembler.test.ts`

- [ ] **Step 1: Write failing tests for language injection**

In `tests/core/chat/prompt-assembler.test.ts`, add a new describe block inside the existing `describe('assembleWithPreset', () => { ... })` block (before the closing `});` at line 753):

```ts
  describe('outputLanguage injection', () => {
    it('injects language instruction when outputLanguage is set', () => {
      const preset = createDefaultPreset();
      const { messages } = assembleWithPreset(preset, {
        card: minimalCard,
        scene: baseScene,
        messages: [],
        lorebookMatches: [],
        outputLanguage: 'Korean',
      });

      const contents = messages.map((m) => m.content);
      const langMsg = contents.find((c) => c.includes('Write all narrative prose and dialogue in Korean'));
      expect(langMsg).toBeDefined();
      expect(langMsg).toContain('Maintain natural phrasing and cultural authenticity');
    });

    it('does not inject language instruction when outputLanguage is empty', () => {
      const preset = createDefaultPreset();
      const { messages } = assembleWithPreset(preset, {
        card: minimalCard,
        scene: baseScene,
        messages: [],
        lorebookMatches: [],
        outputLanguage: '',
      });

      const contents = messages.map((m) => m.content);
      const langMsg = contents.find((c) => c.includes('Write all narrative prose and dialogue in'));
      expect(langMsg).toBeUndefined();
    });

    it('places language instruction after preset items and before additionalPrompt', () => {
      const preset = createDefaultPreset();
      const { messages } = assembleWithPreset(preset, {
        card: minimalCard,
        scene: baseScene,
        messages: [],
        lorebookMatches: [],
        additionalPrompt: '[Memory] test memory',
        outputLanguage: 'Japanese',
      });

      const contents = messages.map((m) => m.content);
      const langIdx = contents.findIndex((c) => c.includes('Write all narrative prose and dialogue in Japanese'));
      const memIdx = contents.findIndex((c) => c.includes('[Memory] test memory'));
      expect(langIdx).toBeGreaterThanOrEqual(0);
      expect(memIdx).toBeGreaterThanOrEqual(0);
      expect(langIdx).toBeLessThan(memIdx);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/chat/prompt-assembler.test.ts`
Expected: FAIL — `outputLanguage` is not in `AssemblyContext`, TypeScript error or test assertion failure.

- [ ] **Step 3: Add `outputLanguage` to `AssemblyContext` and implement injection**

In `src/lib/core/chat/prompt-assembler.ts`, add `outputLanguage` to the `AssemblyContext` interface:

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
}
```

In `assembleWithPreset`, inject the language message **before** the `additionalPrompt` injection. Replace the current injection block:

```ts
  if (ctx.additionalPrompt) {
    messages.push(sysMsg(ctx.additionalPrompt));
  }
```

With:

```ts
  if (ctx.outputLanguage) {
    messages.push(sysMsg(
      `Write all narrative prose and dialogue in ${ctx.outputLanguage}. Maintain natural phrasing and cultural authenticity appropriate to the language.`,
    ));
  }

  if (ctx.additionalPrompt) {
    messages.push(sysMsg(ctx.additionalPrompt));
  }
```

- [ ] **Step 4: Pass `outputLanguage` from engine**

In `src/lib/core/chat/engine.ts`, add import at the top:

```ts
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
```

In the `send` method, where `assembleWithPreset` is called (around line 190), add `outputLanguage` to the context object:

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

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/core/chat/prompt-assembler.test.ts`
Expected: All tests pass including the 3 new language injection tests.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All 507 tests pass (504 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/chat/prompt-assembler.ts src/lib/core/chat/engine.ts tests/core/chat/prompt-assembler.test.ts
git commit -m "feat: add output language injection to prompt assembly"
```

---

### Task 4: Language Dropdown UI

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Add Language section to Settings hub**

In `src/routes/settings/+page.svelte`, add a new section after the Theme section (after the closing `</section>` of the Theme block, before the Developer Mode section). Insert:

```svelte
      <!-- Output Language -->
      <section class="space-y-3">
        <h2 class="text-sm font-medium text-text">Output Language</h2>
        <select
          value={$settingsStore.outputLanguage || ''}
          onchange={(e) => {
            settingsStore.update({ outputLanguage: (e.target as HTMLSelectElement).value });
            handleSave();
          }}
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve"
        >
          <option value="">No language override</option>
          <option value="English">English</option>
          <option value="Korean">Korean</option>
          <option value="Japanese">Japanese</option>
          <option value="Chinese (Simplified)">Chinese (Simplified)</option>
          <option value="Chinese (Traditional)">Chinese (Traditional)</option>
          <option value="Spanish">Spanish</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Portuguese">Portuguese</option>
          <option value="Russian">Russian</option>
          <option value="Italian">Italian</option>
          <option value="Thai">Thai</option>
          <option value="Vietnamese">Vietnamese</option>
          <option value="Indonesian">Indonesian</option>
          <option value="Arabic">Arabic</option>
          <option value="Turkish">Turkish</option>
          <option value="Dutch">Dutch</option>
          <option value="Polish">Polish</option>
        </select>
        <p class="text-xs text-subtext0">
          Forces the AI to write responses in the selected language.
        </p>
      </section>
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All 507 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add output language dropdown to settings page"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All 507 tests pass (504 existing + 3 new language tests).

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1`
Expected: No new errors beyond pre-existing ones.

- [ ] **Step 3: Commit (if any fixups needed)**
