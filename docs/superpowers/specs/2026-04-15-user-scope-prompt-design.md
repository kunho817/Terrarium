# User Scope Prompt Improvement — Design Spec

**Date:** 2026-04-15
**Status:** Draft

## Goal

Improve the default system prompt to produce richer, more immersive roleplay output across creativity, emotional depth, body awareness, and sensory detail. Add a global output language selector that auto-injects a language instruction into prompt assembly.

## Scope

1. **Rewritten default system prompt** — single improved prompt incorporating all quality aspects
2. **Global language selector** — dropdown on the Settings hub page, auto-injects language instruction
3. No new pages, no toggleable snippets, no additional UI beyond the language dropdown

## 1. Default System Prompt

Replace `DEFAULT_SYSTEM_PROMPT` in `src/lib/core/presets/defaults.ts` with an improved version that bakes in:

- **Core roleplay rules** — perspective, user agency, dialogue formatting
- **Creativity enhancement** — varied prose, fresh metaphors, subverted clichés
- **Emotional perception** — micro-expressions, internal monologue, emotional subtext
- **Body awareness** — physicality, posture, touch, somatic sensation
- **Sensory immersion** — five senses, atmosphere, texture, temperature
- **Response length** — detailed, multi-paragraph

### New Default System Prompt

```
1. This is roleplay. You are the actor and novelist. Never write as or for {{user}} — only the user controls {{user}}'s actions, words, and decisions.

2. Write from third-person omniscient perspective. Narrate through characters' senses, thoughts, emotions, and physical experience. Make every moment feel lived-in and tangible.

3. Prose quality: Vary sentence structure, rhythm, and vocabulary across responses. Avoid repeating descriptive patterns, emotional beats, or sentence openings. Introduce fresh metaphors, unexpected character reactions, and non-obvious developments. Subvert clichés rather than leaning on them.

4. Emotional depth: Convey the inner emotional landscape through micro-expressions, changes in tone, hesitation, physiological reactions (flushed skin, trembling, held breath), and shifts in behavior — not just stated feelings. Layer conflicting emotions when characters experience them. Let emotional subtext and tension drive scenes alongside action.

5. Physical presence: Describe body language, posture shifts, gestures, proximity changes, touch pressure, muscle tension or relaxation, breathing patterns, and somatic sensations. Convey how characters inhabit their bodies — fatigue, energy, warmth, pain, grounding. Weave physical description naturally into action and dialogue.

6. Sensory immersion: Engage all five senses in every scene — not just sight. Include texture, temperature, weight, ambient sound, air quality, scent, taste where relevant. Build atmosphere through accumulated sensory detail rather than abstract description. Let the environment feel tangible.

7. Always wrap character dialogue in quotation marks ("Like this."). Keep narrative description separate from dialogue. Never use quotation marks for narration, thoughts, or actions — only for spoken words.

8. Write long, detailed responses (4+ paragraphs, 400+ words). Develop scenes slowly with rich sensory and emotional detail. Do not summarize or rush through events. Each response should feel like a full scene, not a brief exchange.

9. Leave room for {{user}} interaction. Don't rush scenes — unfold them gradually. React to what {{user}} does, don't script around it.
```

### Migration

`migratePresetItems()` handles updating the system prompt. The existing `OLD_SYSTEM_PROMPT_MARKER` (`'Write a 3+ paragraph response with detailed dialogue'`) detects the v0 prompt. To migrate from the current v1 prompt to v2, add a second marker (`OLD_SYSTEM_PROMPT_MARKER_V2 = 'Actively research and utilize diverse cultural content'` — a distinctive phrase from the current v1 prompt). The migration logic becomes:

```ts
const isOldV0 = item.content.includes(OLD_SYSTEM_PROMPT_MARKER);
const isOldV1 = item.content.includes(OLD_SYSTEM_PROMPT_MARKER_V2);
const isEmpty = item.content === '';
const isAlreadyV2 = item.content === DEFAULT_SYSTEM_PROMPT;
if ((isEmpty || isOldV0 || isOldV1) && !isAlreadyV2) {
  item.content = DEFAULT_SYSTEM_PROMPT;
}
```

This ensures users on v0 and v1 both get migrated to v2.

## 2. Output Language Selector

### Settings Storage

Add to `AppSettings`:

```ts
outputLanguage?: string;  // e.g. "Korean", "Japanese", "English" — empty = no injection
```

Default: `''` (no language instruction).

### UI

Add a **Language** section to the existing Settings hub page (`src/routes/settings/+page.svelte`), after the Theme section. Contains:

- A `<select>` dropdown with common languages:
  - `""` (No language override)
  - English
  - Korean
  - Japanese
  - Chinese (Simplified)
  - Chinese (Traditional)
  - Spanish
  - French
  - German
  - Portuguese
  - Russian
  - Italian
  - Thai
  - Vietnamese
  - Indonesian
  - Arabic
  - Turkish
  - Dutch
  - Polish

On change, calls `settingsStore.update({ outputLanguage: value })` then `settingsStore.save()`.

### Prompt Assembly Injection

In `src/lib/core/chat/prompt-assembler.ts`, the `assembleWithPreset` function reads the output language from settings and injects a system message.

The injection happens **after** all preset items are resolved but **before** the `additionalPrompt` (memory) injection. This positions language after the system prompt but before memory context.

Language instruction format:

```
Write all narrative prose and dialogue in {language}. Maintain natural phrasing and cultural authenticity appropriate to the language.
```

The settings store is read via `get(settingsStore)` (Svelte 4 writable pattern, consistent with memory-agent.ts).

### Implementation Details

The prompt assembler currently doesn't read settings directly — it receives an `AssemblyContext`. Two options:

**Option A (recommended):** Add `outputLanguage?: string` to `AssemblyContext`. The engine reads it from settings and passes it through. Clean separation — assembler stays testable.

**Option B:** Assembler reads `settingsStore` directly. Simpler but harder to test.

Use Option A. In `engine.ts`, when building the context for `assembleWithPreset`:

```ts
additionalPrompt: ctx.additionalPrompt,
outputLanguage: get(settingsStore).outputLanguage || '',
```

## 3. Files Changed

| File | Change |
|------|--------|
| `src/lib/core/presets/defaults.ts` | Rewrite `DEFAULT_SYSTEM_PROMPT`, update migration markers |
| `src/lib/types/prompt-preset.ts` | No changes needed (AssemblyContext is in prompt-assembler.ts) |
| `src/lib/core/chat/prompt-assembler.ts` | Add `outputLanguage` to `AssemblyContext`, inject language instruction |
| `src/lib/core/chat/engine.ts` | Pass `outputLanguage` to assembly context |
| `src/lib/storage/settings.ts` | Add `outputLanguage` to `AppSettings` |
| `src/lib/stores/settings.ts` | Add `outputLanguage` default and migration |
| `src/routes/settings/+page.svelte` | Add Language dropdown section |
| `tests/core/chat/prompt-assembler.test.ts` | Add tests for language injection |

## 4. Testing

- Unit test: `assembleWithPreset` with `outputLanguage` set → includes language system message
- Unit test: `assembleWithPreset` with empty `outputLanguage` → no language injection
- Unit test: language message position (after preset items, before additionalPrompt)
- Existing 504 tests should all pass (migration is backward-compatible)
