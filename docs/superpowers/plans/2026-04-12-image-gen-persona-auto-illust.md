# Image Gen UI + Persona System + Auto Illustration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign image generation settings with dropdowns and multi-preset, add user persona system with template variables, and implement hybrid `[illust]` tag auto-illustration.

**Architecture:** Three subsystems in dependency order: (1) NovelAI constants + config types as foundation, (2) Image Gen UI + provider fix using those types, (3) Persona system + template engine + prompt assembly as the largest new feature, (4) Auto-illustration `[illust]` tag system connecting all parts.

**Tech Stack:** SvelteKit 2 + Svelte 5, TypeScript 5, Vitest, Tauri v2 plugin-fs

---

## File Structure

### New files:
- `src/lib/core/image-gen/novelai-constants.ts` — NOVELAI_MODELS, NOVELAI_SAMPLERS, NOVELAI_NOISE_SCHEDULES + compatibility helpers
- `src/lib/types/persona.ts` — UserPersona type
- `src/lib/storage/personas.ts` — Persona CRUD (follows characters.ts pattern)
- `src/routes/settings/personas/+page.svelte` — Persona list + editor page
- `tests/core/image-gen/novelai-constants.test.ts` — Tests for constants + compatibility filtering
- `tests/storage/personas.test.ts` — Tests for persona CRUD
- `tests/core/chat/template-engine.test.ts` — Updated with persona template variable tests

### Modified files:
- `src/lib/types/image-config.ts` — Add noiseSchedule to novelai config
- `src/lib/types/art-style.ts` — Add isBuiltIn, remove 'custom' preset
- `src/lib/types/character.ts` — Add defaultPersonaId
- `src/lib/types/message.ts` — Add GeneratedImage[], images field
- `src/lib/types/config.ts` — No changes needed (UserConfig is extensible)
- `src/lib/types/index.ts` — Export new types
- `src/lib/storage/paths.ts` — Add persona paths
- `src/lib/storage/settings.ts` — Add defaultPersonaId, customArtStylePresets to AppSettings
- `src/lib/stores/settings.ts` — Migration for new fields
- `src/lib/core/chat/template-engine.ts` — Add persona variables, single-brace support
- `src/lib/core/chat/prompt-assembler.ts` — Accept persona, populate template vars
- `src/lib/core/presets/defaults.ts` — Add user_persona prompt item
- `src/lib/core/chat/use-chat.ts` — [illust] tag parsing, new image flow
- `src/lib/core/image/generator.ts` — Context-aware prompt gen for [illust] tags
- `src/lib/plugins/image-providers/novelai.ts` — noise_schedule from config
- `src/lib/components/MessageItem.svelte` — Interleave images at tag positions
- `src/routes/settings/image-generation/+page.svelte` — Dropdowns, multi-preset UI
- `src/routes/settings/+page.svelte` — Add Personas link

---

### Task 1: NovelAI Constants + Config Type Update

**Files:**
- Create: `src/lib/core/image-gen/novelai-constants.ts`
- Modify: `src/lib/types/image-config.ts`
- Test: `tests/core/image-gen/novelai-constants.test.ts`

- [ ] **Step 1: Write failing tests for NovelAI constants**

```typescript
// tests/core/image-gen/novelai-constants.test.ts
import { describe, it, expect } from 'vitest';
import {
  NOVELAI_MODELS,
  NOVELAI_SAMPLERS,
  NOVELAI_NOISE_SCHEDULES,
  getModelGroup,
  getCompatibleNoiseSchedules,
} from '$lib/core/image-gen/novelai-constants';

describe('NOVELAI_MODELS', () => {
  it('has at least 10 models', () => {
    expect(NOVELAI_MODELS.length).toBeGreaterThanOrEqual(10);
  });

  it('each model has value, label, and group', () => {
    for (const m of NOVELAI_MODELS) {
      expect(m.value).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.group).toBeTruthy();
    }
  });

  it('includes nai-diffusion-4-5-full', () => {
    expect(NOVELAI_MODELS.some(m => m.value === 'nai-diffusion-4-5-full')).toBe(true);
  });
});

describe('NOVELAI_SAMPLERS', () => {
  it('has 18 samplers', () => {
    expect(NOVELAI_SAMPLERS).toHaveLength(18);
  });

  it('each sampler has value and label', () => {
    for (const s of NOVELAI_SAMPLERS) {
      expect(s.value).toBeTruthy();
      expect(s.label).toBeTruthy();
    }
  });

  it('includes k_euler_ancestral', () => {
    expect(NOVELAI_SAMPLERS.some(s => s.value === 'k_euler_ancestral')).toBe(true);
  });
});

describe('NOVELAI_NOISE_SCHEDULES', () => {
  it('has 4 schedules', () => {
    expect(NOVELAI_NOISE_SCHEDULES).toHaveLength(4);
  });

  it('includes karras', () => {
    expect(NOVELAI_NOISE_SCHEDULES.some(s => s.value === 'karras')).toBe(true);
  });
});

describe('getModelGroup', () => {
  it('returns v4_5 for nai-diffusion-4-5-full', () => {
    expect(getModelGroup('nai-diffusion-4-5-full')).toBe('v4_5');
  });

  it('returns v4 for nai-diffusion-4-full', () => {
    expect(getModelGroup('nai-diffusion-4-full')).toBe('v4');
  });

  it('returns v3 for nai-diffusion-3', () => {
    expect(getModelGroup('nai-diffusion-3')).toBe('v3');
  });

  it('returns v2 for nai-diffusion-2', () => {
    expect(getModelGroup('nai-diffusion-2')).toBe('v2');
  });

  it('returns v1 for nai-diffusion', () => {
    expect(getModelGroup('nai-diffusion')).toBe('v1');
  });

  it('returns v4_5 as default for unknown', () => {
    expect(getModelGroup('unknown-model')).toBe('v4_5');
  });
});

describe('getCompatibleNoiseSchedules', () => {
  it('excludes native for v4_5 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-4-5-full', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(false);
  });

  it('excludes native for v3 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-3', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(false);
  });

  it('includes native for v2 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-2', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(true);
  });

  it('includes native for v1 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(true);
  });

  it('limits to exponential/polyexponential for k_dpm_2 sampler', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-4-5-full', 'k_dpm_2');
    expect(schedules).toHaveLength(2);
    expect(schedules.every(s => ['exponential', 'polyexponential'].includes(s.value))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/image-gen/novelai-constants.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write NovelAI constants implementation**

```typescript
// src/lib/core/image-gen/novelai-constants.ts
export interface NovelAIModel {
  value: string;
  label: string;
  group: string;
}

export interface NovelAISampler {
  value: string;
  label: string;
}

export interface NovelAINoiseSchedule {
  value: string;
  label: string;
}

export const NOVELAI_MODELS: NovelAIModel[] = [
  // V4.5 (Latest)
  { value: 'nai-diffusion-4-5-full', label: 'NAI Diffusion 4.5 Full', group: 'V4.5 (Latest)' },
  { value: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion 4.5 Curated', group: 'V4.5 (Latest)' },
  // V4
  { value: 'nai-diffusion-4-full', label: 'NAI Diffusion 4 Full', group: 'V4' },
  { value: 'nai-diffusion-4-curated-preview', label: 'NAI Diffusion 4 Curated', group: 'V4' },
  // V3
  { value: 'nai-diffusion-3', label: 'NAI Diffusion 3', group: 'V3' },
  { value: 'nai-diffusion-furry-3', label: 'NAI Diffusion Furry 3', group: 'V3' },
  // V2
  { value: 'nai-diffusion-2', label: 'NAI Diffusion 2', group: 'V2' },
  // V1
  { value: 'nai-diffusion', label: 'NAI Diffusion', group: 'V1' },
  { value: 'safe-diffusion', label: 'Safe Diffusion', group: 'V1' },
  { value: 'nai-diffusion-furry', label: 'NAI Diffusion Furry', group: 'V1' },
  // Special
  { value: 'custom', label: 'Custom', group: 'Special' },
  { value: 'stable-diffusion', label: 'Stable Diffusion', group: 'Special' },
];

export const NOVELAI_SAMPLERS: NovelAISampler[] = [
  { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
  { value: 'k_euler', label: 'Euler' },
  { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
  { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
  { value: 'k_dpmpp_sde', label: 'DPM++ SDE' },
  { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
  { value: 'k_dpmpp_3m_sde', label: 'DPM++ 3M SDE' },
  { value: 'ddim', label: 'DDIM' },
  { value: 'k_lms', label: 'LMS' },
  { value: 'k_heun', label: 'Heun' },
  { value: 'k_dpm_2', label: 'DPM2' },
  { value: 'k_dpm_2_ancestral', label: 'DPM2 Ancestral' },
  { value: 'k_dpm_adaptive', label: 'DPM Adaptive' },
  { value: 'k_dpm_fast', label: 'DPM Fast' },
  { value: 'ddim_v3', label: 'DDIM v3' },
  { value: 'plms', label: 'PLMS' },
  { value: 'nai_smea', label: 'SMEA' },
  { value: 'nai_smea_dyn', label: 'SMEA DYN' },
];

export const NOVELAI_NOISE_SCHEDULES: NovelAINoiseSchedule[] = [
  { value: 'native', label: 'Native' },
  { value: 'karras', label: 'Karras' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'polyexponential', label: 'Polyexponential' },
];

export type ModelGroup = 'v4_5' | 'v4' | 'v3' | 'v2' | 'v1' | 'special';

export function getModelGroup(model: string): ModelGroup {
  if (model.startsWith('nai-diffusion-4-5')) return 'v4_5';
  if (model.startsWith('nai-diffusion-4')) return 'v4';
  if (model.includes('diffusion-3') || model.includes('furry-3')) return 'v3';
  if (model.startsWith('nai-diffusion-2')) return 'v2';
  if (model === 'custom' || model === 'stable-diffusion') return 'special';
  return 'v1';
}

/** Models where native noise schedule is not available */
const NATIVE_EXCLUDED_GROUPS: ModelGroup[] = ['v4_5', 'v4', 'v3'];

/** Samplers that only support exponential/polyexponential */
const DPM2_SAMPLERS = ['k_dpm_2', 'k_dpm_2_ancestral'];

export function getCompatibleNoiseSchedules(model: string, sampler: string): NovelAINoiseSchedule[] {
  // DPM2 samplers only support exponential/polyexponential
  if (DPM2_SAMPLERS.includes(sampler)) {
    return NOVELAI_NOISE_SCHEDULES.filter(s =>
      s.value === 'exponential' || s.value === 'polyexponential'
    );
  }

  // V3+ models exclude native
  const group = getModelGroup(model);
  if (NATIVE_EXCLUDED_GROUPS.includes(group)) {
    return NOVELAI_NOISE_SCHEDULES.filter(s => s.value !== 'native');
  }

  return [...NOVELAI_NOISE_SCHEDULES];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/image-gen/novelai-constants.test.ts`
Expected: All PASS

- [ ] **Step 5: Update ImageGenerationConfig to add noiseSchedule**

Modify `src/lib/types/image-config.ts`:

```typescript
// In the novelai section, add noiseSchedule field:
novelai: {
  apiKey: string;
  model: string;
  width: number;
  height: number;
  steps: number;
  scale: number;
  sampler: string;
  noiseSchedule: string;  // NEW
};
```

Update `DEFAULT_IMAGE_CONFIG` to include `noiseSchedule: 'karras'` in the novelai section.

- [ ] **Step 6: Run all tests to verify no breakage**

Run: `npx vitest run`
Expected: All existing tests pass (tests that construct ImageGenerationConfig may need noiseSchedule added)

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/image-gen/novelai-constants.ts tests/core/image-gen/novelai-constants.test.ts src/lib/types/image-config.ts
git commit -m "feat: add NovelAI constants (models, samplers, noise schedules) and noiseSchedule config"
```

---

### Task 2: NovelAI Provider Fix + Config Migration

**Files:**
- Modify: `src/lib/plugins/image-providers/novelai.ts:88-96`
- Modify: `src/lib/stores/settings.ts`
- Modify: `src/lib/core/image/generator.ts:93-106`

- [ ] **Step 1: Fix noise_schedule in novelai.ts**

In `src/lib/plugins/image-providers/novelai.ts`, change line 91 from:
```typescript
noise_schedule: 'native',
```
to:
```typescript
noise_schedule: (config.noiseSchedule as string) || 'karras',
```

- [ ] **Step 2: Update buildProviderConfig in generator.ts**

In `src/lib/core/image/generator.ts`, add `noiseSchedule` to the novelai provider config at line ~103:
```typescript
sampler: ctx.imageConfig.novelai.sampler,
noiseSchedule: ctx.imageConfig.novelai.noiseSchedule,
```

- [ ] **Step 3: Add migration in settings store**

In `src/lib/stores/settings.ts`, inside the `load()` method after the promptPresets migration, add:
```typescript
// Migrate: add noiseSchedule to novelai config if missing
if (settings.imageGeneration?.novelai && !(settings.imageGeneration.novelai as any).noiseSchedule) {
  settings.imageGeneration.novelai.noiseSchedule = 'karras';
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/plugins/image-providers/novelai.ts src/lib/core/image/generator.ts src/lib/stores/settings.ts
git commit -m "fix: use configurable noise_schedule instead of hardcoded 'native' for NovelAI"
```

---

### Task 3: Art Style Preset — Multi-Preset Support

**Files:**
- Modify: `src/lib/types/art-style.ts`
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/storage/settings.ts`

- [ ] **Step 1: Update ArtStylePreset type and presets**

In `src/lib/types/art-style.ts`:

```typescript
export interface ArtStylePreset {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  isBuiltIn?: boolean;
}

export const DEFAULT_ART_PRESETS: ArtStylePreset[] = [
  {
    id: 'anime',
    name: 'Anime',
    positivePrompt: 'masterpiece, best quality, anime style, detailed',
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, normal quality, jpeg artifacts',
    isBuiltIn: true,
  },
  {
    id: 'realistic',
    name: 'Realistic',
    positivePrompt: 'photorealistic, detailed, high quality, 8k, sharp focus',
    negativePrompt: 'anime, cartoon, illustration, painting, drawing, art, sketch, lowres, bad anatomy, text',
    isBuiltIn: true,
  },
];
```

Remove the 'custom' preset. Add `isBuiltIn: true` to anime and realistic.

- [ ] **Step 2: Add customArtStylePresets to AppSettings**

In `src/lib/storage/settings.ts`, add to `AppSettings`:
```typescript
customArtStylePresets?: ArtStylePreset[];
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All PASS (existing tests reference DEFAULT_ART_PRESETS which still has anime/realistic)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/art-style.ts src/lib/storage/settings.ts src/lib/types/index.ts
git commit -m "feat: add isBuiltIn to ArtStylePreset, prepare for multi-custom-preset support"
```

---

### Task 4: Image Generation Settings Page — Dropdown UI

**Files:**
- Modify: `src/routes/settings/image-generation/+page.svelte`

- [ ] **Step 1: Rewrite the NovelAI settings section with dropdowns**

Replace the entire `<script>` and template of `src/routes/settings/image-generation/+page.svelte` with:

**Script changes:**
- Import `NOVELAI_MODELS, NOVELAI_SAMPLERS, NOVELAI_NOISE_SCHEDULES, getCompatibleNoiseSchedules` from `$lib/core/image-gen/novelai-constants`
- Add `let novelaiNoiseSchedule = $state('karras');`
- Add custom preset state: `let customPresets = $state<ArtStylePreset[]>([]);`
- Add preset editing state: `let editingPreset: ArtStylePreset | null = $state(null);`
- Add `let showPresetEditor = $state(false);`
- Compute `allPresets = $derived([...DEFAULT_ART_PRESETS, ...customPresets])`
- Compute `compatibleSchedules = $derived(getCompatibleNoiseSchedules(novelaiModel, novelaiSampler))`
- Update `loadFromStore()` to load noiseSchedule and customPresets
- Update `buildConfig()` to include noiseSchedule
- Add `handleNewPreset()`, `handleEditPreset(id)`, `handleDeletePreset(id)`, `handleSavePreset(preset)` functions

**Template changes:**
- Replace Model text input with `<select>` using `<optgroup>` from NOVELAI_MODELS groups
- Replace Sampler text input with `<select>` from NOVELAI_SAMPLERS
- Add Noise Schedule `<select>` from compatibleSchedules
- Replace Art Style Preset dropdown with built-in + custom optgroups
- Add New/Edit/Delete buttons for custom presets
- Add inline preset editor (collapsible form for name, positive, negative prompts)
- Load from and save `customPresets` to `settingsStore`

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/settings/image-generation/+page.svelte
git commit -m "feat: image generation settings with dropdown selectors and multi-preset UI"
```

---

### Task 5: UserPersona Type + Storage

**Files:**
- Create: `src/lib/types/persona.ts`
- Create: `src/lib/storage/personas.ts`
- Modify: `src/lib/storage/paths.ts`
- Modify: `src/lib/types/index.ts`
- Test: `tests/storage/personas.test.ts`

- [ ] **Step 1: Write failing tests for persona storage**

```typescript
// tests/storage/personas.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readDir: vi.fn().mockResolvedValue([]),
  exists: vi.fn().mockResolvedValue(false),
  remove: vi.fn().mockResolvedValue(undefined),
  BaseDirectory: { AppData: 1 },
}));

import { listPersonas, loadPersona, savePersona, deletePersona, createPersona } from '$lib/storage/personas';
import type { UserPersona } from '$lib/types/persona';

const mockPersona: UserPersona = {
  name: 'TestUser',
  shortDescription: 'A test persona',
  detailedSettings: 'Detailed test settings',
  exampleDialogue: 'TestUser: "Hello world"',
};

describe('persona storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createPersona generates id and saves', async () => {
    const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
    const id = await createPersona(mockPersona);
    expect(id).toBeTruthy();
    expect(mkdir).toHaveBeenCalled();
    expect(writeTextFile).toHaveBeenCalled();
  });

  it('loadPersona reads and parses JSON', async () => {
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    (exists as any).mockResolvedValue(true);
    (readTextFile as any).mockResolvedValue(JSON.stringify(mockPersona));
    const result = await loadPersona('test-id');
    expect(result.name).toBe('TestUser');
  });

  it('listPersonas returns persona names', async () => {
    const { readDir, readTextFile, exists } = await import('@tauri-apps/plugin-fs');
    (exists as any).mockResolvedValue(true);
    (readDir as any).mockResolvedValue([{ name: 'p1', isDirectory: true }]);
    (readTextFile as any).mockResolvedValue(JSON.stringify({ ...mockPersona, name: 'Alice' }));
    const result = await listPersonas();
    expect(result).toEqual([{ id: 'p1', name: 'Alice' }]);
  });

  it('deletePersona removes directory', async () => {
    const { remove, exists } = await import('@tauri-apps/plugin-fs');
    (exists as any).mockResolvedValue(true);
    await deletePersona('test-id');
    expect(remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage/personas.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create UserPersona type**

```typescript
// src/lib/types/persona.ts
export interface UserPersona {
  name: string;
  shortDescription: string;
  detailedSettings: string;
  exampleDialogue: string;
}
```

- [ ] **Step 4: Add persona paths to paths.ts**

In `src/lib/storage/paths.ts`, add:
```typescript
// Personas
personas: 'personas',
personaDir: (id: string) => `personas/${id}`,
personaFile: (id: string) => `personas/${id}/persona.json`,
```

- [ ] **Step 5: Create persona storage**

```typescript
// src/lib/storage/personas.ts
import type { UserPersona } from '$lib/types/persona';
import { readJson, writeJson, ensureDir, listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listPersonas(): Promise<{ id: string; name: string }[]> {
  const dirs = await listDirs(PATHS.personas);
  const personas: { id: string; name: string }[] = [];

  for (const id of dirs) {
    try {
      const persona = await readJson<UserPersona>(PATHS.personaFile(id));
      personas.push({ id, name: persona.name });
    } catch {
      // Skip directories with invalid/corrupt data
    }
  }

  return personas;
}

export async function loadPersona(id: string): Promise<UserPersona> {
  return readJson<UserPersona>(PATHS.personaFile(id));
}

export async function savePersona(id: string, persona: UserPersona): Promise<void> {
  await ensureDir(PATHS.personaDir(id));
  await writeJson(PATHS.personaFile(id), persona);
}

export async function deletePersona(id: string): Promise<void> {
  await removePath(PATHS.personaDir(id));
}

export async function createPersona(persona: UserPersona): Promise<string> {
  const id = crypto.randomUUID();
  await savePersona(id, persona);
  return id;
}
```

- [ ] **Step 6: Export from types/index.ts**

In `src/lib/types/index.ts`, add:
```typescript
// Persona
export type { UserPersona } from './persona';
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/storage/personas.test.ts`
Expected: All PASS

- [ ] **Step 8: Add defaultPersonaId to AppSettings**

In `src/lib/storage/settings.ts`, add to `AppSettings` interface:
```typescript
defaultPersonaId?: string;
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/types/persona.ts src/lib/storage/personas.ts src/lib/storage/paths.ts src/lib/types/index.ts src/lib/storage/settings.ts tests/storage/personas.test.ts
git commit -m "feat: add UserPersona type and persona CRUD storage"
```

---

### Task 6: Persona Management UI

**Files:**
- Create: `src/routes/settings/personas/+page.svelte`
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Create persona management page**

Create `src/routes/settings/personas/+page.svelte` with:

**Features:**
- List personas loaded from `listPersonas()` storage
- Each persona card shows: name, short description
- Default persona highlighted with badge
- Actions: Edit, Set Default, Delete
- "New Persona" button at top
- Inline editor (toggle with state) with fields: Name, Short Description, Detailed Settings, Example Dialogue
- Save creates new or updates existing persona
- "Back to Settings" link

**Script:**
- `onMount`: load persona list via `listPersonas()`
- `loadPersonaFull(id)`: load full persona data for editing
- `handleNew()`: open editor with blank persona
- `handleEdit(id)`: load persona, open editor
- `handleSave()`: call `savePersona()` or `createPersona()`, refresh list
- `handleDelete(id)`: confirm, call `deletePersona()`, refresh list
- `handleSetDefault(id)`: update `settingsStore.update({ defaultPersonaId: id })`

- [ ] **Step 2: Add Personas link to settings page**

In `src/routes/settings/+page.svelte`, add after the Prompt Builder section:
```svelte
<!-- Personas -->
<section>
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-sm font-medium text-text">User Personas</h2>
    <a
      href="/settings/personas"
      class="text-mauve hover:text-lavender text-sm"
    >
      Manage Personas &rarr;
    </a>
  </div>
  <p class="text-xs text-subtext0">
    Create and manage user personas for roleplay identity.
  </p>
</section>
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/personas/+page.svelte src/routes/settings/+page.svelte
git commit -m "feat: add persona management UI with list, editor, and default selection"
```

---

### Task 7: Character Editor — Persona Dropdown

**Files:**
- Modify: `src/lib/types/character.ts`
- Modify: Character Editor prompts tab (wherever it renders system prompt fields)

- [ ] **Step 1: Add defaultPersonaId to CharacterCard**

In `src/lib/types/character.ts`, add after `depthPrompt`:
```typescript
defaultPersonaId?: string;
```

- [ ] **Step 2: Add persona dropdown to Character Editor**

Find the prompts tab in the CharacterEditor component. Add a "Default User Persona" dropdown:
- Load persona list via `listPersonas()` in onMount
- Dropdown options: "Use Global Default" (empty value) + all personas
- Bound to `card.defaultPersonaId`
- Call `onchange()` directly in `onchange` handler (not $effect — per feedback_style.md memory)

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/character.ts
git commit -m "feat: add defaultPersonaId to CharacterCard for per-character persona linking"
```

---

### Task 8: Template Engine — Persona Variables + Single-Brace

**Files:**
- Modify: `src/lib/core/chat/template-engine.ts`
- Modify: `tests/core/chat/template-engine.test.ts`

- [ ] **Step 1: Write failing tests for new template variables**

Add to `tests/core/chat/template-engine.test.ts`:

```typescript
it('replaces {{user_persona}}', () => {
  const vars = makeVars({ userPersona: 'A brave warrior.' });
  expect(substituteVariables('Persona: {{user_persona}}', vars)).toBe('Persona: A brave warrior.');
});

it('replaces {{user_description}}', () => {
  const vars = makeVars({ userDescription: 'Tall and strong.' });
  expect(substituteVariables('Desc: {{user_description}}', vars)).toBe('Desc: Tall and strong.');
});

it('replaces {{user_example_dialogue}}', () => {
  const vars = makeVars({ userExampleDialogue: 'Bob: "Hello!"' });
  expect(substituteVariables('Ex: {{user_example_dialogue}}', vars)).toBe('Ex: Bob: "Hello!"');
});

it('replaces {user} single-brace with user name', () => {
  expect(substituteVariables('Hello {user}!', makeVars())).toBe('Hello Bob!');
});

it('replaces {char} single-brace with char name', () => {
  expect(substituteVariables('{char} is here.', makeVars())).toBe('Alice is here.');
});

it('does not replace unknown single-brace patterns', () => {
  expect(substituteVariables('Use {variable} here.', makeVars())).toBe('Use {variable} here.');
});
```

Update `makeVars` to include new fields:
```typescript
function makeVars(overrides: Partial<TemplateVariables> = {}): TemplateVariables {
  return {
    char: 'Alice',
    user: 'Bob',
    description: 'A curious girl.',
    personality: 'Cheerful and brave.',
    scenario: 'Wonderland.',
    exampleMessages: 'Hello!',
    slot: 'main',
    sceneLocation: 'Garden',
    sceneTime: 'Afternoon',
    sceneMood: 'Dreamy',
    variables: {},
    userPersona: '',
    userDescription: '',
    userExampleDialogue: '',
    ...overrides,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/chat/template-engine.test.ts`
Expected: FAIL — type errors for new fields

- [ ] **Step 3: Update TemplateVariables and substituteVariables**

In `src/lib/core/chat/template-engine.ts`:

Add to `TemplateVariables`:
```typescript
userPersona: string;
userDescription: string;
userExampleDialogue: string;
```

Add to `buildReplacements()` (before existing simple variables, since they're longer):
```typescript
{ pattern: /\{\{user_example_dialogue\}\}/g, value: vars.userExampleDialogue },
{ pattern: /\{\{user_description\}\}/g, value: vars.userDescription },
{ pattern: /\{\{user_persona\}\}/g, value: vars.userPersona },
```

Add single-brace support after step 3 (unknown cleanup). Before the final `return result;`, add:
```typescript
// 4. Single-brace support for known variables only
const singleBraceKnown = ['user', 'char', 'scene', 'slot'];
for (const key of singleBraceKnown) {
  const varMap: Record<string, string> = {
    user: vars.user,
    char: vars.char,
    scene: vars.sceneLocation,
    slot: vars.slot,
  };
  result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), varMap[key]);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/chat/template-engine.test.ts`
Expected: All PASS

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/core/chat/template-engine.ts tests/core/chat/template-engine.test.ts
git commit -m "feat: add persona template variables and single-brace {user} support"
```

---

### Task 9: Prompt Assembly — Persona Resolution

**Files:**
- Modify: `src/lib/core/chat/prompt-assembler.ts`
- Modify: `tests/core/chat/prompt-assembler.test.ts`

- [ ] **Step 1: Add persona to AssemblyContext**

In `src/lib/core/chat/prompt-assembler.ts`, update `AssemblyContext`:
```typescript
export interface AssemblyContext {
  card: CharacterCard;
  scene: SceneState;
  messages: Message[];
  lorebookMatches: LorebookEntry[];
  persona?: UserPersona;
}
```

Import `UserPersona` from `$lib/types/persona`.

- [ ] **Step 2: Update buildTemplateVars to use persona**

In `buildTemplateVars`, change:
```typescript
function buildTemplateVars(card: CharacterCard, scene: SceneState, slot: string, persona?: UserPersona): TemplateVariables {
  return {
    char: card.name,
    user: persona?.name || 'User',
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    exampleMessages: card.exampleMessages,
    slot,
    sceneLocation: scene.location || '',
    sceneTime: scene.time || '',
    sceneMood: scene.mood || '',
    variables: scene.variables || {},
    userPersona: persona?.shortDescription || '',
    userDescription: persona?.detailedSettings || '',
    userExampleDialogue: persona?.exampleDialogue || '',
  };
}
```

Update ALL call sites of `buildTemplateVars` throughout the file to pass `ctx.persona` as the fourth argument.

- [ ] **Step 3: Implement the 'persona' case in resolveItem**

The `'persona'` case currently returns `null`. Replace it:
```typescript
case 'persona': {
  const p = ctx.persona;
  if (!p || (!p.shortDescription && !p.detailedSettings && !p.exampleDialogue)) return null;
  const parts: string[] = [];
  parts.push(`[${p.name}'s Persona]`);
  if (p.shortDescription) parts.push(p.shortDescription);
  if (p.detailedSettings) parts.push(p.detailedSettings);
  if (p.exampleDialogue) {
    parts.push(`<example_dialogue>`);
    parts.push(p.exampleDialogue);
    parts.push(`</example_dialogue>`);
  }
  return sysMsg(parts.join('\n'));
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/chat/prompt-assembler.ts
git commit -m "feat: persona resolution in prompt assembly with template variable population"
```

---

### Task 10: Default Preset — User Persona Item

**Files:**
- Modify: `src/lib/core/presets/defaults.ts`
- Modify: `tests/core/presets/defaults.test.ts`

- [ ] **Step 1: Add persona PromptItem to default preset**

In `src/lib/core/presets/defaults.ts`, insert a new item AFTER the "Lorebook (Before Scenario)" item and BEFORE the "Description" item:

```typescript
{
  id: uid(),
  type: 'persona',
  name: 'User Persona',
  enabled: true,
  role: 'system',
  content: '',
},
```

This places persona information before character description in the prompt.

- [ ] **Step 2: Update defaults test**

In `tests/core/presets/defaults.test.ts`, update the item count check from 14 to 15 (or whatever the current count is + 1).

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/core/presets/defaults.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/core/presets/defaults.ts tests/core/presets/defaults.test.ts
git commit -m "feat: add User Persona prompt item to default preset"
```

---

### Task 11: Chat Engine — Persona Loading + [illust] Tag System

**Files:**
- Modify: `src/lib/types/message.ts`
- Modify: `src/lib/core/chat/use-chat.ts`
- Modify: `src/lib/core/image/generator.ts`
- Modify: `src/lib/components/MessageItem.svelte`

- [ ] **Step 1: Update Message type for multi-image support**

In `src/lib/types/message.ts`, add:

```typescript
export interface GeneratedImage {
  id: string;
  path: string;
  prompt: string;
  tagIndex: number;
  charId: string;
  sessionId: string;
  timestamp: number;
}
```

Add to `Message` interface:
```typescript
images?: GeneratedImage[];
```

Keep existing `image?: { filename: string; prompt: string; }` for backward compatibility.

Export `GeneratedImage` from `src/lib/types/index.ts`.

- [ ] **Step 2: Add [illust] tag parsing to use-chat.ts**

In `src/lib/core/chat/use-chat.ts`, add helper:

```typescript
const ILLUST_TAG = /\[illust\]/gi;

function parseIllustTags(text: string): { cleanText: string; tagCount: number } {
  const matches = text.match(ILLUST_TAG);
  return {
    cleanText: text.replace(ILLUST_TAG, '').trim(),
    tagCount: matches ? matches.length : 0,
  };
}
```

- [ ] **Step 3: Add persona resolution helper**

In `use-chat.ts`, add:

```typescript
async function resolvePersona(card: CharacterCard): Promise<UserPersona | undefined> {
  const settings = get(settingsStore);
  const personaId = card.defaultPersonaId || settings.defaultPersonaId;
  if (!personaId) return undefined;
  try {
    return await loadPersona(personaId);
  } catch {
    return undefined;
  }
}
```

Import `loadPersona` from `$lib/storage/personas` and `UserPersona` from `$lib/types/persona`.

- [ ] **Step 4: Update sendMessage flow**

In `sendMessage()`, after getting `assistantMessage`:

Replace the current auto-generate block (lines 111-133) with:

```typescript
// Parse [illust] tags
const { cleanText, tagCount } = parseIllustTags(assistantMessage.content);
assistantMessage.content = cleanText;

// Auto-generate illustrations for [illust] tags
if (tagCount > 0 && imageConfig?.autoGenerate && imageConfig.provider !== 'none') {
  try {
    const artStyle = resolveArtStyle(
      imageConfig.artStylePresetId,
      settings.imageGeneration?.customArtStylePresets as ArtStylePreset[] | undefined,
    );
    const generator = new ImageGenerator(getRegistry());
    assistantMessage.images = [];

    for (let i = 0; i < tagCount; i++) {
      const imgResult = await generator.generateForChat({
        messages: [...state.messages, result.userMessage, { ...assistantMessage, content: cleanText }],
        artStyle,
        imageConfig,
        config,
        charId: charState.current.id,
        sessionId: state.sessionId || 'default',
      });
      if (imgResult) {
        assistantMessage.images.push({
          id: crypto.randomUUID(),
          path: imgResult.filename,
          prompt: imgResult.prompt,
          tagIndex: i,
          charId: charState.current.id,
          sessionId: state.sessionId || 'default',
          timestamp: Date.now(),
        });
      }
    }
  } catch {
    // Image generation failed — non-critical
  }
}
```

Also pass persona to engine.send:
```typescript
const persona = await resolvePersona(charState.current);

const result = await engine.send({
  input,
  type,
  card: charState.current,
  scene,
  config,
  messages: state.messages,
  preset: activePreset,
  persona,  // NEW
});
```

- [ ] **Step 5: Update engine.ts to pass persona through to assembly**

In `src/lib/core/chat/engine.ts`, the `ChatEngine.send()` method needs to accept and pass `persona` to `assembleWithPreset`. Find where `assembleWithPreset` is called and add `persona` to the `AssemblyContext`.

- [ ] **Step 6: Update [illust] system prompt injection**

When `autoGenerate` is enabled, the system prompt should include the illustration instruction. Add to the system prompt (or as a new PromptItem) when auto-generate is on:

In `use-chat.ts`, after resolving the preset, if autoGenerate is enabled, find or append an instruction to the system messages:

```typescript
const ILLUST_INSTRUCTION = 'You may insert [illust] tags at appropriate moments in your response to request scene illustrations. Place them on their own line. Use them sparingly — only for visually significant moments like scene changes, dramatic reveals, or important character actions. Do not use them for every response.';
```

Append this to the last system message in the assembled messages.

- [ ] **Step 7: Update MessageItem.svelte for multi-image rendering**

In `src/lib/components/MessageItem.svelte`, update to handle `message.images`:

```svelte
{#if message.images && message.images.length > 0}
  {#each message.images as img, i}
    <div class="mt-2">
      <button onclick={() => showImage = true} class="block max-w-xs cursor-pointer bg-transparent border-none p-0">
        <img
          src={`https://asset.localhost/${img.path}`}
          alt="Generated illustration"
          class="rounded-lg max-w-full hover:opacity-90 transition-opacity"
        />
      </button>
    </div>
  {/each}
{/if}
```

- [ ] **Step 8: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/types/message.ts src/lib/types/index.ts src/lib/core/chat/use-chat.ts src/lib/core/chat/engine.ts src/lib/components/MessageItem.svelte
git commit -m "feat: [illust] tag system, persona loading in chat, multi-image message rendering"
```

---

### Task 12: Final Integration + Cleanup

**Files:**
- Various — type check, test verification, settings migration

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test via `npm run tauri dev`**

- Settings → Image Generation: dropdowns work, presets work
- Settings → Personas: create/edit/delete personas
- Character Editor → Prompts tab: persona dropdown visible
- Chat with auto-generate on: [illust] tags trigger image generation
- Template variables {{user}}, {user}, {{user_persona}} resolve correctly

- [ ] **Step 5: Final commit if any fixes needed**
