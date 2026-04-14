import { describe, it, expect, vi } from 'vitest';

import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
import type { ProviderPlugin, ImageProviderPlugin } from '$lib/types/plugin';
import type { PluginRegistry } from '$lib/plugins/registry';
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
  it('generates image via 2-pass flow and returns dataUrl', async () => {
    const mockImage = new ArrayBuffer(8);
    const registry = createMockRegistry(['1girl, sitting, detailed'], mockImage);
    const generator = new ImageGenerator(registry);

    const artStyle = DEFAULT_ART_PRESETS[0];
    const result = await generator.generateForChat({
      messages: [
        { role: 'user', content: 'Hello', type: 'dialogue', timestamp: 0 },
      ],
      artStyle,
      imageConfig: defaultImageConfig,
      config: { providerId: 'mock-llm' } as UserConfig,
    });

    expect(result).not.toBeNull();
    expect(result!.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('returns null when provider is none', async () => {
    const registry = createMockRegistry([], new ArrayBuffer(0));
    const generator = new ImageGenerator(registry);

    const result = await generator.generateForChat({
      messages: [],
      artStyle: DEFAULT_ART_PRESETS[0],
      imageConfig: { ...defaultImageConfig, provider: 'none' },
      config: { providerId: 'mock-llm' } as UserConfig,
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

describe('planIllustrations', () => {
  it('parses LLM JSON output into illustration plans', async () => {
    const llmOutput = '[{"afterParagraph":1,"prompt":"1girl, forest"},{"afterParagraph":3,"prompt":"1girl, sunset"}]';
    const registry = createMockRegistry([llmOutput], new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);

    const plans = await generator.planIllustrations('Some text\n\nMore text\n\nEven more', { providerId: 'mock-llm' } as UserConfig);

    expect(plans).toHaveLength(2);
    expect(plans[0].afterParagraph).toBe(1);
    expect(plans[0].prompt).toBe('1girl, forest');
    expect(plans[1].afterParagraph).toBe(3);
  });

  it('returns empty array when LLM produces no output', async () => {
    const registry = createMockRegistry([], new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);

    const plans = await generator.planIllustrations('text', { providerId: 'mock-llm' } as UserConfig);
    expect(plans).toEqual([]);
  });

  it('returns empty array for invalid JSON', async () => {
    const registry = createMockRegistry(['not json at all'], new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);

    const plans = await generator.planIllustrations('text', { providerId: 'mock-llm' } as UserConfig);
    expect(plans).toEqual([]);
  });

  it('filters out entries with missing fields', async () => {
    const llmOutput = '[{"afterParagraph":1,"prompt":"valid"},{"bad":"entry"},{"afterParagraph":2}]';
    const registry = createMockRegistry([llmOutput], new ArrayBuffer(8));
    const generator = new ImageGenerator(registry);

    const plans = await generator.planIllustrations('text', { providerId: 'mock-llm' } as UserConfig);
    expect(plans).toHaveLength(1);
    expect(plans[0].prompt).toBe('valid');
  });
});

describe('buildSegments', () => {
  it('interleaves text and images at correct paragraph positions', () => {
    const registry = createMockRegistry([], new ArrayBuffer(0));
    const generator = new ImageGenerator(registry);

    const text = 'Paragraph 0\n\nParagraph 1\n\nParagraph 2\n\nParagraph 3';
    const plans = [
      { afterParagraph: 0, prompt: 'img0' },
      { afterParagraph: 2, prompt: 'img2' },
    ];
    const results = new Map([
      [0, { dataUrl: 'data:img0', prompt: 'img0' }],
      [2, { dataUrl: 'data:img2', prompt: 'img2' }],
    ]);

    const segments = generator.buildSegments(text, plans, results);

    expect(segments).toHaveLength(6);
    expect(segments[0]).toEqual({ type: 'text', text: 'Paragraph 0' });
    expect(segments[1]).toEqual({ type: 'image', dataUrl: 'data:img0', prompt: 'img0', id: expect.any(String) });
    expect(segments[2]).toEqual({ type: 'text', text: 'Paragraph 1' });
    expect(segments[3]).toEqual({ type: 'text', text: 'Paragraph 2' });
    expect(segments[4]).toEqual({ type: 'image', dataUrl: 'data:img2', prompt: 'img2', id: expect.any(String) });
    expect(segments[5]).toEqual({ type: 'text', text: 'Paragraph 3' });
  });

  it('returns only text segments when no results match', () => {
    const registry = createMockRegistry([], new ArrayBuffer(0));
    const generator = new ImageGenerator(registry);

    const text = 'Paragraph 0\n\nParagraph 1';
    const plans = [{ afterParagraph: 0, prompt: 'img0' }];
    const results = new Map<number, { dataUrl: string; prompt: string }>();

    const segments = generator.buildSegments(text, plans, results);
    expect(segments).toHaveLength(2);
    expect(segments.every((s) => s.type === 'text')).toBe(true);
  });
});
