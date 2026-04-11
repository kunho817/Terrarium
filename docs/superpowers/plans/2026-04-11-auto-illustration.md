# Auto Illustration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NovelAI + ComfyUI image generation to chat, with 2-pass LLM-driven prompt construction, inline display, and configurable art style presets.

**Architecture:** ImageGenerator orchestrates a 2-pass flow — first calls the chat LLM to produce an image prompt from context, then calls an ImageProviderPlugin (NovelAI or ComfyUI) to generate the image. Images are stored on disk via Tauri FS, referenced by relative path in Message. Auto-trigger after AI responses (toggleable) + manual button.

**Tech Stack:** SvelteKit 2, Svelte 5, Tauri v2 (Rust), TypeScript 5, Tailwind CSS v4, Catppuccin Mocha, Vitest

**Spec:** `docs/superpowers/specs/2026-04-11-auto-illustration-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/types/art-style.ts` | ArtStylePreset type |
| `src/lib/types/image-config.ts` | ImageGenerationConfig type |
| `src/lib/core/image/generator.ts` | ImageGenerator class (2-pass orchestration) |
| `src/lib/plugins/image-providers/novelai.ts` | NovelAI API provider |
| `src/lib/plugins/image-providers/comfyui.ts` | ComfyUI API provider |
| `src/lib/plugins/image-providers/builtin.ts` | Register built-in image providers |
| `src/routes/settings/image-generation/+page.svelte` | Image generation settings page |
| `src/lib/components/ImageModal.svelte` | Full-size image viewer modal |
| `tests/core/image/generator.test.ts` | ImageGenerator tests |
| `tests/plugins/image-providers/novelai.test.ts` | NovelAI provider tests |
| `tests/plugins/image-providers/comfyui.test.ts` | ComfyUI provider tests |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/types/message.ts` | Add `image?` field to Message |
| `src/lib/types/index.ts` | Re-export new types |
| `src/lib/storage/settings.ts` | Add `imageGeneration` to AppSettings + defaults |
| `src/lib/stores/settings.ts` | Add `imageGeneration` to initial state |
| `src/lib/core/bootstrap.ts` | Register image providers |
| `src/lib/components/MessageItem.svelte` | Show inline images + click-to-expand |
| `src/lib/components/InputArea.svelte` | Add image generate button |
| `src/lib/core/chat/use-chat.ts` | Wire auto-generate after AI response |

---

## Task 1: Add image types and Message extension

**Files:**
- Create: `src/lib/types/art-style.ts`
- Create: `src/lib/types/image-config.ts`
- Modify: `src/lib/types/message.ts`
- Modify: `src/lib/types/index.ts`

- [ ] **Step 1: Create ArtStylePreset type**

`src/lib/types/art-style.ts`:
```typescript
export interface ArtStylePreset {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
}

export const DEFAULT_ART_PRESETS: ArtStylePreset[] = [
  {
    id: 'anime',
    name: 'Anime',
    positivePrompt: 'masterpiece, best quality, anime style, detailed',
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, normal quality, jpeg artifacts',
  },
  {
    id: 'realistic',
    name: 'Realistic',
    positivePrompt: 'photorealistic, detailed, high quality, 8k, sharp focus',
    negativePrompt: 'anime, cartoon, illustration, painting, drawing, art, sketch, lowres, bad anatomy, text',
  },
  {
    id: 'custom',
    name: 'Custom',
    positivePrompt: '',
    negativePrompt: '',
  },
];
```

- [ ] **Step 2: Create ImageGenerationConfig type**

`src/lib/types/image-config.ts`:
```typescript
export interface ImageGenerationConfig {
  provider: 'novelai' | 'comfyui' | 'none';
  autoGenerate: boolean;
  artStylePresetId: string;
  imagePromptInstructions: string;
  novelai: {
    apiKey: string;
    model: string;
    width: number;
    height: number;
    steps: number;
    scale: number;
    sampler: string;
  };
  comfyui: {
    url: string;
    workflow: string;
    timeout: number;
  };
}

export const DEFAULT_IMAGE_CONFIG: ImageGenerationConfig = {
  provider: 'none',
  autoGenerate: false,
  artStylePresetId: 'anime',
  imagePromptInstructions: `You are an image prompt generator for a roleplay scene. Based on the conversation context, generate a detailed image prompt describing the current scene. Focus on:
- Character appearance and pose
- Environment and atmosphere
- Lighting and mood
- Composition and camera angle

Output ONLY the image prompt text, nothing else. Keep it under 200 tokens. Use comma-separated tags and descriptive phrases. Do not include any explanations or meta-text.`,
  novelai: {
    apiKey: '',
    model: 'nai-diffusion-4-5-full',
    width: 832,
    height: 1216,
    steps: 28,
    scale: 5,
    sampler: 'k_euler_ancestral',
  },
  comfyui: {
    url: 'http://localhost:8188',
    workflow: '',
    timeout: 60,
  },
};
```

- [ ] **Step 3: Add image field to Message type**

Modify `src/lib/types/message.ts` — add `image` field to `Message`:
```typescript
export interface Message {
  role: MessageRole;
  characterId?: string;
  content: string;
  action?: string;
  type: MessageType;
  timestamp: number;
  generationInfo?: GenerationInfo;
  image?: {
    filename: string;   // relative path in AppData: images/{charId}/{sessionId}/{ts}.png
    prompt: string;     // the image prompt used
  };
}
```

- [ ] **Step 4: Re-export new types from index**

Add to `src/lib/types/index.ts`:
```typescript
export type { ArtStylePreset } from './art-style';
export { DEFAULT_ART_PRESETS } from './art-style';
export type { ImageGenerationConfig } from './image-config';
export { DEFAULT_IMAGE_CONFIG } from './image-config';
```

- [ ] **Step 5: Run type check and tests**

Run: `cd D:/Project/TextChatbot && npx vitest run`
Expected: All existing tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/art-style.ts src/lib/types/image-config.ts src/lib/types/message.ts src/lib/types/index.ts
git commit -m "feat: add image generation types (ArtStylePreset, ImageGenerationConfig, Message.image)"
```

---

## Task 2: Add imageGeneration to settings

**Files:**
- Modify: `src/lib/storage/settings.ts`
- Modify: `src/lib/stores/settings.ts`

- [ ] **Step 1: Add imageGeneration to AppSettings and defaults**

In `src/lib/storage/settings.ts`:
- Import `ImageGenerationConfig` and `DEFAULT_IMAGE_CONFIG` from `./image-config`... wait, that's circular — image-config is in types. Import from `$lib/types/image-config`.
- Add `imageGeneration?: ImageGenerationConfig;` to `AppSettings` interface
- Add `imageGeneration: { ...DEFAULT_IMAGE_CONFIG }` to `DEFAULT_SETTINGS`

```typescript
import type { ImageGenerationConfig } from '$lib/types/image-config';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';

export interface AppSettings {
  defaultProvider: string;
  theme: string;
  providers: Record<string, Record<string, unknown>>;
  promptPresets?: PromptPresetSettings;
  developerMode?: boolean;
  imageGeneration?: ImageGenerationConfig;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: '',
  theme: 'default',
  providers: {},
  promptPresets: undefined,
  developerMode: false,
  imageGeneration: { ...DEFAULT_IMAGE_CONFIG },
};
```

- [ ] **Step 2: Add imageGeneration to settings store initial state**

In `src/lib/stores/settings.ts`, add `imageGeneration: { ...DEFAULT_IMAGE_CONFIG }` to the initial writable state. Import `DEFAULT_IMAGE_CONFIG` from `$lib/types/image-config`.

- [ ] **Step 3: Run tests**

Run: `cd D:/Project/TextChatbot && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/settings.ts src/lib/stores/settings.ts
git commit -m "feat: add imageGeneration config to settings"
```

---

## Task 3: Create NovelAI image provider

**Files:**
- Create: `src/lib/plugins/image-providers/novelai.ts`
- Create: `tests/plugins/image-providers/novelai.test.ts`

- [ ] **Step 1: Write NovelAI provider tests**

`tests/plugins/image-providers/novelai.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNovelAIProvider } from '$lib/plugins/image-providers/novelai';
import type { UserConfig } from '$lib/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('createNovelAIProvider', () => {
  const provider = createNovelAIProvider();

  it('has correct id and name', () => {
    expect(provider.id).toBe('novelai');
    expect(provider.name).toBe('NovelAI');
  });

  it('has requiredConfig with apiKey and image parameters', () => {
    const keys = provider.requiredConfig.map((c) => c.key);
    expect(keys).toContain('apiKey');
  });

  it('validateConfig returns false without apiKey', async () => {
    const result = await provider.validateConfig({ providerId: 'novelai' } as UserConfig);
    expect(result).toBe(false);
  });

  it('validateConfig returns true with apiKey', async () => {
    const result = await provider.validateConfig({
      providerId: 'novelai',
      apiKey: 'pst-test123',
    } as UserConfig);
    expect(result).toBe(true);
  });

  it('generateImage sends correct request and returns image buffer', async () => {
    // Create a minimal valid ZIP file (just headers for test)
    const mockImageBuffer = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => mockImageBuffer,
    });

    const result = await provider.generateImage(
      'test prompt, anime style',
      { apiKey: 'pst-test' } as UserConfig,
    );
    expect(result).toBe(mockImageBuffer);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://image.novelai.net/ai/generate-image');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.input).toContain('test prompt');
    expect(body.parameters.width).toBeDefined();
  });

  it('generateImage throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(
      provider.generateImage('test', { apiKey: 'bad' } as UserConfig),
    ).rejects.toThrow('NovelAI API error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Project/TextChatbot && npx vitest run tests/plugins/image-providers/novelai.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement NovelAI provider**

`src/lib/plugins/image-providers/novelai.ts`:
```typescript
/**
 * NovelAI image generation provider.
 * Uses the NovelAI image generation API.
 * Response is a ZIP file containing the generated image(s).
 */

import type { ImageProviderPlugin } from '$lib/types/plugin';
import type { UserConfig, ConfigField } from '$lib/types';

const DEFAULT_BASE_URL = 'https://image.novelai.net/ai/generate-image';

export function createNovelAIProvider(): ImageProviderPlugin {
  const requiredConfig: ConfigField[] = [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'model', label: 'Model', type: 'text', defaultValue: 'nai-diffusion-4-5-full' },
    { key: 'width', label: 'Width', type: 'number', defaultValue: 832 },
    { key: 'height', label: 'Height', type: 'number', defaultValue: 1216 },
    { key: 'steps', label: 'Steps', type: 'number', defaultValue: 28 },
    { key: 'scale', label: 'CFG Scale', type: 'number', defaultValue: 5 },
    { key: 'sampler', label: 'Sampler', type: 'text', defaultValue: 'k_euler_ancestral' },
  ];

  return {
    id: 'novelai',
    name: 'NovelAI',
    requiredConfig,

    async validateConfig(config: UserConfig): Promise<boolean> {
      return !!config.apiKey;
    },

    async generateImage(prompt: string, config: UserConfig): Promise<ArrayBuffer> {
      const url = (config.baseUrl as string) || DEFAULT_BASE_URL;

      const body = {
        action: 'generate',
        input: prompt,
        model: config.model || 'nai-diffusion-4-5-full',
        parameters: {
          params_version: 3,
          add_original_image: true,
          cfg_rescale: 0,
          controlnet_strength: 1,
          dynamic_thresholding: false,
          n_samples: 1,
          width: config.width ?? 832,
          height: config.height ?? 1216,
          sampler: config.sampler || 'k_euler_ancestral',
          steps: config.steps ?? 28,
          scale: config.scale ?? 5,
          negative_prompt: config.negativePrompt || '',
          noise_schedule: 'native',
          legacy_v3_extend: false,
          skip_cfg_above_sigma: null,
          seed: Math.floor(Math.random() * 2147483647),
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey || ''}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`NovelAI API error (${response.status}): ${response.statusText}`);
      }

      return response.arrayBuffer();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/Project/TextChatbot && npx vitest run tests/plugins/image-providers/novelai.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/plugins/image-providers/novelai.ts tests/plugins/image-providers/novelai.test.ts
git commit -m "feat: add NovelAI image provider"
```

---

## Task 4: Create ComfyUI image provider

**Files:**
- Create: `src/lib/plugins/image-providers/comfyui.ts`
- Create: `tests/plugins/image-providers/comfyui.test.ts`

- [ ] **Step 1: Write ComfyUI provider tests**

`tests/plugins/image-providers/comfyui.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createComfyUIProvider } from '$lib/plugins/image-providers/comfyui';
import type { UserConfig } from '$lib/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('createComfyUIProvider', () => {
  const provider = createComfyUIProvider();

  it('has correct id and name', () => {
    expect(provider.id).toBe('comfyui');
    expect(provider.name).toBe('ComfyUI');
  });

  it('validateConfig returns true (always valid — local service)', async () => {
    const result = await provider.validateConfig({ providerId: 'comfyui' } as UserConfig);
    expect(result).toBe(true);
  });

  it('generateImage submits workflow and retrieves image', async () => {
    const promptId = 'test-prompt-123';

    // Mock: submit workflow
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ prompt_id: promptId }),
    });

    // Mock: first poll — not ready
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    // Mock: second poll — ready with image output
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [promptId]: {
          outputs: {
            '9': { images: [{ filename: 'test.png', subfolder: '', type: 'output' }] },
          },
        },
      }),
    });

    // Mock: retrieve image
    const mockImage = new ArrayBuffer(8);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => mockImage,
    });

    const workflow = JSON.stringify({
      '3': { inputs: { seed: 123, steps: 20, cfg: 7, sampler: 'euler', scheduler: 'normal' } },
      '6': { inputs: { text: '{{risu_prompt}}', seed: 456 } },
      '7': { inputs: { text: '{{risu_neg}}' } },
    });

    const result = await provider.generateImage(
      'anime girl, detailed',
      {
        comfyuiUrl: 'http://localhost:8188',
        comfyuiWorkflow: workflow,
        comfyuiTimeout: 5,
        negativePrompt: 'bad quality',
      } as unknown as UserConfig,
    );

    expect(result).toBe(mockImage);

    // Verify workflow was submitted with prompt replaced
    const submitCall = mockFetch.mock.calls[0];
    const submittedBody = JSON.parse(submitCall[1].body);
    expect(submittedBody.prompt['6'].inputs.text).toBe('anime girl, detailed');
    expect(submittedBody.prompt['7'].inputs.text).toBe('bad quality');
  });

  it('generateImage throws on timeout', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ prompt_id: 'timeout-test' }),
    });

    // Poll always returns empty — will timeout
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => ({}) }),
    );

    await expect(
      provider.generateImage('test', {
        comfyuiUrl: 'http://localhost:8188',
        comfyuiWorkflow: '{"6":{"inputs":{"text":"{{risu_prompt}}"}}}',
        comfyuiTimeout: 1,
      } as unknown as UserConfig),
    ).rejects.toThrow('timeout');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Project/TextChatbot && npx vitest run tests/plugins/image-providers/comfyui.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ComfyUI provider**

`src/lib/plugins/image-providers/comfyui.ts`:
```typescript
/**
 * ComfyUI image generation provider.
 * Connects to a local ComfyUI instance via REST API.
 * Uses workflow JSON with {{risu_prompt}} and {{risu_neg}} placeholders.
 */

import type { ImageProviderPlugin } from '$lib/types/plugin';
import type { UserConfig, ConfigField } from '$lib/types';

export function createComfyUIProvider(): ImageProviderPlugin {
  const requiredConfig: ConfigField[] = [
    { key: 'comfyuiUrl', label: 'ComfyUI URL', type: 'text', defaultValue: 'http://localhost:8188' },
    { key: 'comfyuiWorkflow', label: 'Workflow JSON', type: 'text', defaultValue: '' },
    { key: 'comfyuiTimeout', label: 'Timeout (s)', type: 'number', defaultValue: 60 },
  ];

  return {
    id: 'comfyui',
    name: 'ComfyUI',
    requiredConfig,

    async validateConfig(_config: UserConfig): Promise<boolean> {
      return true; // Always valid — local service
    },

    async generateImage(prompt: string, config: UserConfig): Promise<ArrayBuffer> {
      const baseUrl = ((config.comfyuiUrl as string) || 'http://localhost:8188').replace(/\/$/, '');
      const workflowRaw = (config.comfyuiWorkflow as string) || '{}';
      const timeout = ((config.comfyuiTimeout as number) || 60) * 1000;
      const negativePrompt = (config.negativePrompt as string) || '';

      // 1. Prepare workflow — replace placeholders and randomize seeds
      const workflow = JSON.parse(workflowRaw);
      for (const nodeId of Object.keys(workflow)) {
        const node = workflow[nodeId];
        if (!node.inputs) continue;
        for (const inputKey of Object.keys(node.inputs)) {
          const val = node.inputs[inputKey];
          if (typeof val === 'string') {
            node.inputs[inputKey] = val
              .replace(/\{\{risu_prompt\}\}/g, prompt)
              .replace(/\{\{risu_neg\}\}/g, negativePrompt);
          }
          // Randomize 'seed' fields
          if (inputKey === 'seed' && typeof val === 'number') {
            node.inputs[inputKey] = Math.floor(Math.random() * 2147483647);
          }
        }
      }

      // 2. Submit workflow
      const submitRes = await fetch(`${baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!submitRes.ok) {
        throw new Error(`ComfyUI submit error (${submitRes.status}): ${submitRes.statusText}`);
      }

      const { prompt_id } = await submitRes.json();

      // 3. Poll for completion
      const startTime = Date.now();
      let result: any = null;

      while (Date.now() - startTime < timeout) {
        const historyRes = await fetch(`${baseUrl}/history/${prompt_id}`);
        if (historyRes.ok) {
          const history = await historyRes.json();
          if (history[prompt_id]) {
            result = history[prompt_id];
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!result) {
        throw new Error(`ComfyUI image generation timed out after ${timeout / 1000}s`);
      }

      // 4. Retrieve image from outputs
      const outputs = Object.values(result.outputs) as any[];
      const imageInfo = outputs.flatMap((o: any) => o.images || [])[0];
      if (!imageInfo) {
        throw new Error('ComfyUI returned no images');
      }

      const params = new URLSearchParams({
        filename: imageInfo.filename,
        subfolder: imageInfo.subfolder || '',
        type: imageInfo.type || 'output',
      });

      const imgRes = await fetch(`${baseUrl}/view?${params}`);
      if (!imgRes.ok) {
        throw new Error(`ComfyUI image retrieval error (${imgRes.status})`);
      }

      return imgRes.arrayBuffer();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/Project/TextChatbot && npx vitest run tests/plugins/image-providers/comfyui.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/plugins/image-providers/comfyui.ts tests/plugins/image-providers/comfyui.test.ts
git commit -m "feat: add ComfyUI image provider"
```

---

## Task 5: Register image providers in bootstrap

**Files:**
- Create: `src/lib/plugins/image-providers/builtin.ts`
- Modify: `src/lib/core/bootstrap.ts`

- [ ] **Step 1: Create builtin image providers registration**

`src/lib/plugins/image-providers/builtin.ts`:
```typescript
import type { PluginRegistry } from '$lib/plugins/registry';
import { createNovelAIProvider } from './novelai';
import { createComfyUIProvider } from './comfyui';

export function registerBuiltinImageProviders(registry: PluginRegistry): void {
  registry.registerImageProvider(createNovelAIProvider());
  registry.registerImageProvider(createComfyUIProvider());
}
```

- [ ] **Step 2: Update bootstrap to register image providers**

In `src/lib/core/bootstrap.ts`, add import and call:
```typescript
import { registerBuiltinImageProviders } from '$lib/plugins/image-providers/builtin';

// Inside getRegistry(), after registerBuiltinPromptBuilders:
registerBuiltinImageProviders(_registry);
```

- [ ] **Step 3: Run all tests**

Run: `cd D:/Project/TextChatbot && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/plugins/image-providers/builtin.ts src/lib/core/bootstrap.ts
git commit -m "feat: register NovelAI and ComfyUI image providers in bootstrap"
```

---

## Task 6: Create ImageGenerator core service

**Files:**
- Create: `src/lib/core/image/generator.ts`
- Create: `tests/core/image/generator.test.ts`

- [ ] **Step 1: Write ImageGenerator tests**

`tests/core/image/generator.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { ImageGenerator } from '$lib/core/image/generator';
import type { PluginRegistry } from '$lib/plugins/registry';
import type { ImageProviderPlugin, ProviderPlugin } from '$lib/types/plugin';
import type { Message, CharacterCard, SceneState, UserConfig } from '$lib/types';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';

function createMockRegistry(llmResponse: string, imageData: ArrayBuffer): PluginRegistry {
  const mockLLMProvider: ProviderPlugin = {
    id: 'mock-llm',
    name: 'Mock LLM',
    requiredConfig: [],
    validateConfig: async () => true,
    chat: async function* () { yield llmResponse; },
    chatWithCard: async function* () { yield llmResponse; },
  };

  const mockImageProvider: ImageProviderPlugin = {
    id: 'novelai',
    name: 'NovelAI',
    requiredConfig: [],
    generateImage: vi.fn().mockResolvedValue(imageData),
  };

  return {
    getProvider: () => mockLLMProvider,
    getImageProvider: () => mockImageProvider,
  } as unknown as PluginRegistry;
}

describe('ImageGenerator', () => {
  it('generates image via 2-pass flow', async () => {
    const mockImage = new ArrayBuffer(8);
    const registry = createMockRegistry(
      '1girl, sitting, classroom, sunlight, detailed',
      mockImage,
    );
    const generator = new ImageGenerator(registry);

    const artStyle: ArtStylePreset = {
      id: 'anime',
      name: 'Anime',
      positivePrompt: 'masterpiece, best quality',
      negativePrompt: 'lowres, bad anatomy',
    };

    const imageConfig: ImageGenerationConfig = {
      provider: 'novelai',
      autoGenerate: false,
      artStylePresetId: 'anime',
      imagePromptInstructions: 'Generate image prompt',
      novelai: { apiKey: 'test', model: 'test', width: 832, height: 1216, steps: 28, scale: 5, sampler: 'k_euler' },
      comfyui: { url: '', workflow: '', timeout: 30 },
    };

    const result = await generator.generateImagePrompt(registry.getProvider('mock-llm'), {
      messages: [{ role: 'user', content: 'Hello', type: 'dialogue', timestamp: 0 }],
      artStyle,
      imageConfig,
      config: { providerId: 'mock-llm' } as UserConfig,
    });

    expect(result).toContain('1girl');
    expect(result).toContain('masterpiece');
  });

  it('returns null when provider is none', async () => {
    const registry = createMockRegistry('test', new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);

    const result = await generator.generateForChat({
      messages: [],
      card: {} as CharacterCard,
      scene: {} as SceneState,
      config: { providerId: 'mock-llm' } as UserConfig,
      artStyle: { id: 'anime', name: 'Anime', positivePrompt: '', negativePrompt: '' },
      imageConfig: { ...{} as ImageGenerationConfig, provider: 'none' },
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd D:/Project/TextChatbot && npx vitest run tests/core/image/generator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement ImageGenerator**

`src/lib/core/image/generator.ts`:
```typescript
/**
 * ImageGenerator — 2-pass image generation orchestration.
 * Pass 1: Calls chat LLM to generate an image prompt from context.
 * Pass 2: Calls image provider (NovelAI/ComfyUI) with the prompt.
 */

import type { PluginRegistry, ProviderPlugin } from '$lib/types/plugin';
import type { Message, UserConfig } from '$lib/types';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import { mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { PATHS } from '$lib/storage/paths';

export interface ImageGenContext {
  messages: Message[];
  artStyle: ArtStylePreset;
  imageConfig: ImageGenerationConfig;
  config: UserConfig;
  charId?: string;
  sessionId?: string;
}

export class ImageGenerator {
  constructor(private registry: PluginRegistry) {}

  /**
   * Pass 1: Generate image prompt via LLM.
   * Returns the combined prompt (LLM output + art style).
   */
  async generateImagePrompt(
    llmProvider: ProviderPlugin,
    ctx: Omit<ImageGenContext, 'charId' | 'sessionId'>,
  ): Promise<string | null> {
    // Build context from recent messages
    const recentMessages = ctx.messages.slice(-10);
    const chatContext = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // Collect LLM response (non-streaming)
    let llmOutput = '';
    const messages: Message[] = [
      {
        role: 'system',
        content: ctx.imageConfig.imagePromptInstructions,
        type: 'system',
        timestamp: 0,
      },
      {
        role: 'user',
        content: chatContext,
        type: 'dialogue',
        timestamp: 0,
      },
    ];

    for await (const token of llmProvider.chat(messages, ctx.config)) {
      llmOutput += token;
    }

    if (!llmOutput.trim()) return null;

    // Combine with art style
    const parts = [ctx.artStyle.positivePrompt, llmOutput.trim()].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Full 2-pass generation: LLM prompt → image provider → save to disk.
   */
  async generateForChat(ctx: ImageGenContext): Promise<{ filename: string; prompt: string } | null> {
    if (ctx.imageConfig.provider === 'none') return null;

    const llmProvider = this.registry.getProvider(ctx.config.providerId);
    const combinedPrompt = await this.generateImagePrompt(llmProvider, ctx);
    if (!combinedPrompt) return null;

    const imageProvider = this.registry.getImageProvider(ctx.imageConfig.provider);

    // Build provider-specific config
    const providerConfig = this.buildProviderConfig(ctx);

    const imageData = await imageProvider.generateImage(combinedPrompt, providerConfig);

    // Save image to disk
    const filename = await this.saveImage(imageData, ctx.charId || 'unknown', ctx.sessionId || 'default');

    return { filename, prompt: combinedPrompt };
  }

  private buildProviderConfig(ctx: ImageGenContext): UserConfig {
    if (ctx.imageConfig.provider === 'novelai') {
      return {
        providerId: 'novelai',
        apiKey: ctx.imageConfig.novelai.apiKey,
        model: ctx.imageConfig.novelai.model,
        width: ctx.imageConfig.novelai.width,
        height: ctx.imageConfig.novelai.height,
        steps: ctx.imageConfig.novelai.steps,
        scale: ctx.imageConfig.novelai.scale,
        sampler: ctx.imageConfig.novelai.sampler,
        negativePrompt: ctx.artStyle.negativePrompt,
      } as UserConfig;
    }

    if (ctx.imageConfig.provider === 'comfyui') {
      return {
        providerId: 'comfyui',
        comfyuiUrl: ctx.imageConfig.comfyui.url,
        comfyuiWorkflow: ctx.imageConfig.comfyui.workflow,
        comfyuiTimeout: ctx.imageConfig.comfyui.timeout,
        negativePrompt: ctx.artStyle.negativePrompt,
      } as UserConfig;
    }

    return { providerId: 'none' } as UserConfig;
  }

  private async saveImage(data: ArrayBuffer, charId: string, sessionId: string): Promise<string> {
    const dir = `images/${charId}/${sessionId}`;
    const timestamp = Date.now();
    const filename = `${dir}/${timestamp}.png`;
    const fullPath = `${PATHS.appData}/${filename}`;

    // Ensure directory exists
    const dirPath = `${PATHS.appData}/${dir}`;
    await mkdir(dirPath, { recursive: true });

    await writeFile(fullPath, new Uint8Array(data));

    return filename;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd D:/Project/TextChatbot && npx vitest run tests/core/image/generator.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/core/image/generator.ts tests/core/image/generator.test.ts
git commit -m "feat: add ImageGenerator 2-pass orchestration service"
```

---

## Task 7: Update MessageItem for inline image display + ImageModal

**Files:**
- Create: `src/lib/components/ImageModal.svelte`
- Modify: `src/lib/components/MessageItem.svelte`

- [ ] **Step 1: Create ImageModal component**

`src/lib/components/ImageModal.svelte`:
```svelte
<script lang="ts">
  let { src, onclose } = $props<{
    src: string;
    onclose: () => void;
  }>();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <div class="max-w-[90vw] max-h-[90vh]">
    <img {src} alt="Generated illustration" class="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
  </div>
</div>
```

- [ ] **Step 2: Update MessageItem to show inline images**

Modify `src/lib/components/MessageItem.svelte` — add image display below text content:

```svelte
<script lang="ts">
  import type { Message } from '$lib/types';
  import { settingsStore } from '$lib/stores/settings';
  import GenerationInfoBadge from './GenerationInfoBadge.svelte';
  import GenerationInfoPanel from './GenerationInfoPanel.svelte';
  import ImageModal from './ImageModal.svelte';

  let { message } = $props<{ message: Message }>();

  let showPanel = $state(false);
  let showImage = $state(false);

  const roleStyles: Record<string, string> = {
    user: 'border-l-2 border-l-blue pl-3',
    assistant: 'border-l-2 border-l-mauve pl-3',
    narrator: 'border-l-2 border-l-overlay0 pl-3 bg-surface0/30 rounded-r-lg italic',
    system: 'border-l-2 border-l-yellow pl-3 text-subtext0 text-sm',
  };

  // Convert relative image path to asset protocol URL for Tauri
  let imageSrc = $derived(
    message.image?.filename
      ? `https://asset.localhost/${message.image.filename}`
      : ''
  );
</script>

<div class="py-2 {roleStyles[message.role] || ''}">
  <p class="text-text text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

  {#if message.image && imageSrc}
    <div class="mt-2">
      <button
        onclick={() => showImage = true}
        class="block max-w-xs cursor-pointer bg-transparent border-none p-0"
      >
        <img
          src={imageSrc}
          alt="Generated illustration"
          class="rounded-lg max-w-full hover:opacity-90 transition-opacity"
        />
      </button>
    </div>
  {/if}

  {#if $settingsStore.developerMode && message.role === 'assistant' && message.generationInfo}
    <div class="mt-1.5">
      <GenerationInfoBadge info={message.generationInfo} onclick={() => showPanel = true} />
    </div>
  {/if}
</div>

{#if showPanel && message.generationInfo}
  <GenerationInfoPanel info={message.generationInfo} onclose={() => showPanel = false} />
{/if}

{#if showImage && imageSrc}
  <ImageModal src={imageSrc} onclose={() => showImage = false} />
{/if}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ImageModal.svelte src/lib/components/MessageItem.svelte
git commit -m "feat: add inline image display in MessageItem with ImageModal"
```

---

## Task 8: Add generate button to InputArea + wire auto-generate

**Files:**
- Modify: `src/lib/components/InputArea.svelte`
- Modify: `src/lib/core/chat/use-chat.ts`

- [ ] **Step 1: Add image generate button to InputArea**

Modify `src/lib/components/InputArea.svelte` — add a camera/image button next to the send button:

Add props:
```typescript
let { onSend, onGenerateImage, disabled = false, imageProviderAvailable = false } = $props<{
  onSend: (text: string, type: MessageType) => void;
  onGenerateImage?: () => void;
  disabled?: boolean;
  imageProviderAvailable?: boolean;
}>();
```

Add button before the Send button:
```svelte
{#if imageProviderAvailable}
  <button
    onclick={onGenerateImage}
    disabled={disabled}
    class="px-2 py-1.5 bg-surface0 text-text rounded-md text-sm
           hover:bg-surface1 disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors"
    title="Generate illustration"
  >
    <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 00-1.06 0L2.5 11.06zm10-3.56a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clip-rule="evenodd" />
    </svg>
  </button>
{/if}
```

- [ ] **Step 2: Wire auto-generate and manual generate in use-chat**

Modify `src/lib/core/chat/use-chat.ts`:

1. Import `ImageGenerator` from `$lib/core/image/generator`
2. Import settings store
3. Import `DEFAULT_ART_PRESETS` from `$lib/types`
4. After `sendMessage` completes (after streaming finishes), check if `imageGeneration.autoGenerate` is true
5. If auto, call `imageGenerator.generateForChat()` with context
6. Add the returned image data to the assistant message
7. Export a new `generateIllustration()` function for manual trigger

The key additions:
```typescript
// After streaming completes in sendMessage:
const imageConfig = $settingsStore.imageGeneration;
if (imageConfig?.autoGenerate && imageConfig.provider !== 'none') {
  const artStyle = DEFAULT_ART_PRESETS.find(p => p.id === imageConfig.artStylePresetId) || DEFAULT_ART_PRESETS[0];
  const generator = new ImageGenerator(getRegistry());
  const result = await generator.generateForChat({
    messages: [...messages, userMessage, assistantMessage],
    card,
    scene,
    config,
    artStyle,
    imageConfig,
    charId,
    sessionId: $chatStore.sessionId,
  });
  if (result) {
    assistantMessage.image = result;
  }
}
```

- [ ] **Step 3: Wire in chat page**

Modify `src/routes/chat/[id]/+page.svelte`:
- Pass `onGenerateImage` to `InputArea`
- Pass `imageProviderAvailable` based on settings
- Add `handleGenerateImage` function that calls the manual generate

- [ ] **Step 4: Run all tests**

Run: `cd D:/Project/TextChatbot && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/InputArea.svelte src/lib/core/chat/use-chat.ts src/routes/chat/[id]/+page.svelte
git commit -m "feat: wire image generation into chat (auto + manual)"
```

---

## Task 9: Create Image Generation Settings page

**Files:**
- Create: `src/routes/settings/image-generation/+page.svelte`

- [ ] **Step 1: Create settings page**

`src/routes/settings/image-generation/+page.svelte`:

Full page with sections:
1. **Provider selector** — dropdown: None / NovelAI / ComfyUI
2. **Auto-generate toggle** — on/off switch
3. **Art Style section** — dropdown for preset + text fields for positive/negative prompt
4. **Provider settings** — conditional sections:
   - NovelAI: API key, model, width, height, steps, scale, sampler
   - ComfyUI: URL, workflow textarea, timeout
5. **Prompt Instructions** — textarea for LLM image prompt instructions
6. Save button (same pattern as existing settings pages)

Use Catppuccin Mocha colors, Tailwind, Svelte 5 runes. Follow the pattern in `src/routes/settings/+page.svelte`.

- [ ] **Step 2: Add navigation link**

Modify `src/routes/settings/+page.svelte` or layout to add a link to `/settings/image-generation`.

- [ ] **Step 3: Run all tests**

Run: `cd D:/Project/TextChatbot && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/image-generation/+page.svelte
git commit -m "feat: add image generation settings page"
```

---

## Task 10: Integration test and final verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run full test suite**

Run: `cd D:/Project/TextChatbot && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `cd D:/Project/TextChatbot && npx tsc --noEmit 2>&1 | grep -v "Cannot find type definition"`
Expected: No errors (except pre-existing node type issue)

- [ ] **Step 3: Verify build**

Run: `cd D:/Project/TextChatbot && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "feat: auto illustration system complete (NovelAI + ComfyUI)"
```
