# Image Gen UI + Persona System + Auto Illustration Redesign

**Date:** 2026-04-12
**Status:** Approved

## Overview

This spec covers 8 feedback items grouped into three subsystems:

1. **Image Generation UI** — dropdown selectors, multi-preset, noise schedule config
2. **Auto Illustration** — hybrid `[illust]` tag + separate prompt generation
3. **User Persona System** — global persona list, template variables, character linking

---

## 1. Image Generation UI Improvements

### 1.1 NovelAI Model Dropdown

**Current:** Text input, default `nai-diffusion-4-5-full`
**Change:** `<select>` dropdown with `<optgroup>` labels by version.

Models grouped as:
- **V4.5 (Latest):** nai-diffusion-4-5-full, nai-diffusion-4-5-curated
- **V4:** nai-diffusion-4-full, nai-diffusion-4-curated-preview
- **V3:** nai-diffusion-3, nai-diffusion-furry-3
- **V2:** nai-diffusion-2
- **V1:** nai-diffusion, safe-diffusion, nai-diffusion-furry
- **Special:** custom, stable-diffusion

Inpainting variants excluded from UI (not relevant for auto-illustration).

Display human-readable names (e.g., "NAI Diffusion 4.5 Full"). Store API string values internally.

**Data structure:** Add `NOVELAI_MODELS` constant — array of `{ value: string, label: string, group: string }`.

### 1.2 NovelAI Sampler Dropdown

**Current:** Text input, default `k_euler_ancestral`
**Change:** `<select>` dropdown with all 18 samplers.

Samplers ordered by popularity:
1. k_euler_ancestral (Euler Ancestral)
2. k_euler (Euler)
3. k_dpmpp_2m (DPM++ 2M)
4. k_dpmpp_2s_ancestral (DPM++ 2S Ancestral)
5. k_dpmpp_sde (DPM++ SDE)
6. k_dpmpp_2m_sde (DPM++ 2M SDE)
7. k_dpmpp_3m_sde (DPM++ 3M SDE)
8. ddim (DDIM)
9. k_lms (LMS)
10. k_heun (Heun)
11. k_dpm_2 (DPM2)
12. k_dpm_2_ancestral (DPM2 Ancestral)
13. k_dpm_adaptive (DPM Adaptive)
14. k_dpm_fast (DPM Fast)
15. ddim_v3 (DDIM v3)
16. plms (PLMS)
17. nai_smea (SMEA)
18. nai_smea_dyn (SMEA DYN)

**Data structure:** Add `NOVELAI_SAMPLERS` constant — array of `{ value: string, label: string }`.

### 1.3 Noise Schedule Dropdown

**Current:** Hardcoded to `'native'` in `novelai.ts:91`. No UI control.
**Change:** `<select>` dropdown with 4 options. Default: `karras` (compatible with all model families).

Options:
| API Value | Display Name | Notes |
|-----------|-------------|-------|
| `native` | Native | NOT available for V3/V4/V4.5 |
| `karras` | Karras | Default, works with most samplers |
| `exponential` | Exponential | Only option for k_dpm_2/k_dpm_2_ancestral |
| `polyexponential` | Polyexponential | Only option for k_dpm_2/k_dpm_2_ancestral |

**Compatibility filtering:** When model is V3/V4/V4.5 family, `native` is excluded from dropdown. When sampler is `k_dpm_2` or `k_dpm_2_ancestral`, only `exponential` and `polyexponential` are shown.

**Data structure:** Add `NOVELAI_NOISE_SCHEDULES` constant. Add `noiseSchedule` field to `ImageGenerationConfig.novelai` with default `'karras'`.

### 1.4 Multi Art Style Preset

**Current:** 3 built-in presets (Anime, Realistic, Custom). No user-created presets.
**Change:** Support multiple user-created custom presets, visually separated from built-in.

**Data structure changes:**
```typescript
interface ArtStylePreset {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  isBuiltIn?: boolean;  // true for Anime, Realistic
}
```

- Built-in presets: `anime`, `realistic` (unchangeable, no delete)
- Remove `custom` built-in — replaced by user-created presets
- Custom presets stored in `AppSettings.customArtStylePresets: ArtStylePreset[]`
- UI: dropdown with `<optgroup label="Built-in">` and `<optgroup label="My Presets">`
- Buttons: New Preset, Edit (custom only), Delete (custom only)

### 1.5 NovelAI 500 Error Fix

**Root cause:** `noise_schedule: 'native'` is hardcoded in `novelai.ts:91`. V4/V4.5 models do not support `native`.

**Fix:**
- Read `noiseSchedule` from config instead of hardcoding
- Default to `'karras'` in config migration
- Pass configured value to API call

---

## 2. Auto Illustration Redesign

### 2.1 Hybrid Approach: Chat LLM Position + Separate LLM Prompt

**Current flow:**
1. After AI message → separate LLM call generates image prompt
2. Image provider generates image
3. Image appended after AI message

**New flow:**
1. Chat LLM generates response with `[illust]` tags at desired positions
2. System detects `[illust]` tags in AI response
3. For each tag, separate LLM call generates detailed image prompt using surrounding context + `imagePromptInstructions`
4. Image provider generates image from prompt
5. On render, `[illust]` tags replaced with generated images

**Chat LLM system prompt addition** (when auto-generate is enabled):
> "You may insert `[illust]` tags at appropriate moments in your response to request scene illustrations. Place them on their own line. Use them sparingly — only for visually significant moments like scene changes, dramatic reveals, or important character actions. Do not use them for every response."

**Image prompt generation** uses existing `ImageGenerator.generateImagePrompt()` logic — context window from surrounding messages, art style preset, `imagePromptInstructions`.

### 2.2 Tag Format

```
[illust]
```

Simple tag on its own line. The image prompt is generated by the separate LLM based on the context surrounding the tag position.

If the chat LLM doesn't insert any `[illust]` tags, no image is generated. This gives the LLM full control over when illustrations appear.

### 2.3 Response Processing

After AI response streams in:
1. Parse response for `[illust]` tags
2. For each tag, collect context (previous chat messages + AI response text up to that tag position)
3. Call `generateImagePrompt()` with that context
4. Call image provider to generate image
5. Store images with metadata linking to tag positions
6. Strip `[illust]` tags from stored message text
7. Render images at tag positions in `MessageItem.svelte`

### 2.4 Message Data Structure

```typescript
interface GeneratedImage {
  id: string;
  path: string;           // local file path
  prompt: string;         // generated image prompt
  tagIndex: number;       // which [illust] tag this corresponds to
  charId: string;
  sessionId: string;
  timestamp: number;
}
```

Images stored in message metadata: `message.images: GeneratedImage[]`.

### 2.5 Rendering

`MessageItem.svelte` splits message text by `[illust]` positions and interleaves text segments with `<img>` elements. Each image is clickable for full-size modal.

---

## 3. User Persona System

### 3.1 Data Model

```typescript
interface UserPersona {
  id: string;
  name: string;
  shortDescription: string;
  detailedSettings: string;
  exampleDialogue: string;
  isDefault?: boolean;  // deprecated — use AppSettings.defaultPersonaId instead
}
```

**Storage:** `personas/{id}.json` via Tauri FS (consistent with character storage pattern).

**Global settings:** `AppSettings.defaultPersonaId: string` — which persona is the global default.

### 3.2 Character Linking

Add to `CharacterCard`:
```typescript
defaultPersonaId?: string;  // linked persona, overrides global default
```

**Resolution order:**
1. `character.defaultPersonaId` → use this persona
2. Fallback to `AppSettings.defaultPersonaId` → global default
3. Fallback to hardcoded `{ name: 'User', ... }`

### 3.3 Persona Management UI

**Route:** `/settings/personas`

- List of persona cards showing: name, short description, linked character count
- Default persona badge
- Actions: Edit, Set Default, Delete
- "New Persona" button

**Persona Editor:**
- Name (text input)
- Short Description (textarea, ~1-2 sentences)
- Detailed Settings (textarea, full persona description)
- Example Dialogue (list of `<name>: "<dialogue>"` entries, add/remove)

### 3.4 Character Editor Integration

In Character Editor → Prompts tab, add "Default User Persona" dropdown:
- Lists all personas
- "Use Global Default" option (when no character-specific override)
- Selection saved as `character.defaultPersonaId`

### 3.5 Template Engine Changes

**File:** `src/lib/core/chat/template-engine.ts`

Add to `TemplateVariables`:
```typescript
interface TemplateVariables {
  // ... existing fields
  user: string;              // persona name (was hardcoded "User")
  userDescription: string;   // persona detailedSettings
  userPersona: string;       // persona shortDescription
  userExampleDialogue: string; // persona exampleDialogue
}
```

**Single-brace support:** `{user}` → treated same as `{{user}}`. Add processing step in template engine for `{user}` pattern. Only known variable names are expanded to avoid false positives: `{user}`, `{char}`, `{scene}`, `{slot}`.

**Named template mappings:**
- `{{user}}`, `{user}` → persona name
- `{{user_persona}}` → shortDescription
- `{{user_description}}` → detailedSettings
- `{{user_example_dialogue}}` → exampleDialogue

### 3.6 Prompt Assembly Changes

**File:** `src/lib/core/chat/prompt-assembler.ts`

- `assembleWithPreset()` receives active persona (resolved from character → global → fallback)
- Populates TemplateVariables with persona fields
- Default preset (`defaults.ts`) updated to include persona section in system prompt:

```
[{{user}}'s Persona]
{{user_persona}}

{{user_description}}

<example_dialogue>
{{user_example_dialogue}}
</example_dialogue>
```

This section is added as a new PromptItem (role: system, type: user_persona) in the default preset, positioned before the character description item. Only rendered when persona data is available (non-fallback).

### 3.7 Default Prompt Re-check

The "User Scope default prompt not applied" issue is likely stale save data. After persona system is implemented:
1. Data migration adds persona support
2. User clears app data (Tauri AppData directory)
3. Re-test with fresh defaults
4. If issue persists, investigate preset loading in `use-chat.ts`

---

## 4. Files to Modify

### New files:
- `src/lib/types/persona.ts` — UserPersona type
- `src/lib/storage/personas.ts` — Persona CRUD storage
- `src/lib/core/image-gen/novelai-constants.ts` — MOVELAI_MODELS, NOVELAI_SAMPLERS, NOVELAI_NOISE_SCHEDULES
- `src/routes/settings/personas/+page.svelte` — Persona management page

### Modified files:
- `src/routes/settings/image-generation/+page.svelte` — dropdown UI, multi-preset
- `src/lib/plugins/image-providers/novelai.ts` — noise_schedule from config
- `src/lib/types/image-config.ts` — add noiseSchedule, remove hardcoded
- `src/lib/types/art-style.ts` — isBuiltIn flag, custom presets
- `src/lib/types/character.ts` — add defaultPersonaId
- `src/lib/core/chat/template-engine.ts` — persona variables, single-brace support
- `src/lib/core/chat/prompt-assembler.ts` — persona resolution, variable population
- `src/lib/core/presets/defaults.ts` — persona section in system prompt
- `src/lib/core/chat/use-chat.ts` — [illust] tag parsing, image insertion flow
- `src/lib/core/image-gen/image-generator.ts` — context-based prompt generation
- `src/lib/components/MessageItem.svelte` — [illust] position image rendering
- `src/lib/types/message.ts` — GeneratedImage in message metadata
- `src/lib/types/config.ts` — AppSettings: defaultPersonaId, customArtStylePresets
- `src/routes/settings/+page.svelte` — link to personas page
- Character Editor prompts tab — persona dropdown
