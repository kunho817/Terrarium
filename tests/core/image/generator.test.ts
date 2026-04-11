import { describe, it, expect, vi } from 'vitest';

// Mock Tauri FS
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
import type { PluginRegistry, ProviderPlugin, ImageProviderPlugin } from '$lib/types/plugin';
import type { Message, UserConfig } from '$lib/types';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import { DEFAULT_ART_PRESETS } from '$lib/types/art-style';

function createMockRegistry(
  llmTokens: string[],
  imageData: ArrayBuffer,
): PluginRegistry {
  const mockLLM: ProviderPlugin = {
    id: 'mock-llm',
    name: 'Mock LLM',
    requiredConfig: [],
    validateConfig: async () => true,
    chat: async function* () {
      for (const t of llmTokens) yield t;
    },
    chatWithCard: async function* () {
      for (const t of llmTokens) yield t;
    },
  };

  const mockImage: ImageProviderPlugin = {
    id: 'novelai',
    name: 'NovelAI',
    requiredConfig: [],
    generateImage: vi.fn().mockResolvedValue(imageData),
  };

  return {
    getProvider: () => mockLLM,
    getImageProvider: () => mockImage,
  } as unknown as PluginRegistry;
}

const defaultImageConfig: ImageGenerationConfig = {
  provider: 'novelai',
  autoGenerate: false,
  artStylePresetId: 'anime',
  imagePromptInstructions: 'Generate image prompt',
  novelai: {
    apiKey: 'test',
    model: 'test',
    width: 832,
    height: 1216,
    steps: 28,
    scale: 5,
    sampler: 'k_euler',
    noiseSchedule: 'karras',
  },
  comfyui: { url: '', workflow: '', timeout: 30 },
};

describe('ImageGenerator', () => {
  it('generates image via 2-pass flow and returns filename', async () => {
    const mockImage = new ArrayBuffer(8);
    const registry = createMockRegistry(['1girl, sitting, detailed'], mockImage);
    const generator = new ImageGenerator(registry);

    const artStyle = DEFAULT_ART_PRESETS[0]; // anime
    const result = await generator.generateForChat({
      messages: [
        { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 0 },
      ],
      artStyle,
      imageConfig: defaultImageConfig,
      config: { providerId: 'mock-llm' } as UserConfig,
      charId: 'char1',
      sessionId: 'sess1',
    });

    expect(result).not.toBeNull();
    expect(result!.filename).toContain('images/char1/sess1/');
    expect(result!.filename).toMatch(/\.png$/);
  });

  it('returns null when provider is none', async () => {
    const registry = createMockRegistry([], new ArrayBuffer(0));
    const generator = new ImageGenerator(registry);

    const result = await generator.generateForChat({
      messages: [],
      artStyle: DEFAULT_ART_PRESETS[0],
      imageConfig: { ...defaultImageConfig, provider: 'none' },
      config: { providerId: 'mock-llm' } as UserConfig,
      charId: 'char1',
      sessionId: 'sess1',
    });

    expect(result).toBeNull();
  });

  it('returns null when LLM produces no output', async () => {
    const registry = createMockRegistry([], new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);

    const result = await generator.generateForChat({
      messages: [],
      artStyle: DEFAULT_ART_PRESETS[0],
      imageConfig: defaultImageConfig,
      config: { providerId: 'mock-llm' } as UserConfig,
      charId: 'char1',
      sessionId: 'sess1',
    });

    expect(result).toBeNull();
  });

  it('combine art style positive prompt with LLM output', async () => {
    const registry = createMockRegistry(['1girl, classroom'], new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);
    const artStyle: ArtStylePreset = {
      ...DEFAULT_ART_PRESETS[0],
      positivePrompt: 'masterpiece, best quality',
    };

    const result = await generator.generateForChat({
      messages: [],
      artStyle,
      imageConfig: defaultImageConfig,
      config: { providerId: 'mock-llm' } as UserConfig,
      charId: 'char1',
      sessionId: 'sess1',
    });

    expect(result!.prompt).toContain('masterpiece, best quality');
    expect(result!.prompt).toContain('1girl, classroom');
  });
});

describe('resolveArtStyle', () => {
  it('finds preset by id', () => {
    const result = resolveArtStyle('anime');
    expect(result.id).toBe('anime');
  });

  it('falls back to first default', () => {
    const result = resolveArtStyle('nonexistent');
    expect(result).toBe(DEFAULT_ART_PRESETS[0]);
  });
});
