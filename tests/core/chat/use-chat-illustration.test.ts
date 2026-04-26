import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const imageGeneratorMocks = vi.hoisted(() => ({
  planIllustrations: vi.fn(),
  generateForChat: vi.fn(),
  generateIllustration: vi.fn(),
  buildSegments: vi.fn(),
}));

const chatRepoMocks = vi.hoisted(() => ({
  saveMessages: vi.fn(),
}));

vi.mock('$lib/core/image/generator', () => ({
  ImageGenerator: class {
    cardName?: string;
    cardDescription?: string;
    personaName?: string;
    agentContext?: Record<string, unknown>;

    planIllustrations = imageGeneratorMocks.planIllustrations;
    generateForChat = imageGeneratorMocks.generateForChat;
    generateIllustration = imageGeneratorMocks.generateIllustration;
    buildSegments = imageGeneratorMocks.buildSegments;
  },
  resolveArtStyle: vi.fn(() => ({
    id: 'anime',
    name: 'Anime',
    positivePrompt: 'anime style',
    negativePrompt: 'bad anatomy',
  })),
}));

vi.mock('$lib/repositories/chat-repo', () => ({
  chatRepo: chatRepoMocks,
}));

vi.mock('$lib/storage/session-agent-state', () => ({
  loadSessionState: vi.fn(async () => null),
}));

vi.mock('$lib/core/agents/injection', () => ({
  buildAgentImageContext: vi.fn(() => ({})),
}));

vi.mock('$lib/core/bootstrap', () => ({
  getRegistry: vi.fn(() => ({})),
}));

vi.mock('$lib/core/chat/use-chat-helpers', () => ({
  resolveActiveCard: vi.fn(() => ({
    card: {
      name: 'Alice',
      description: 'Traveler with a lantern',
    },
    worldCard: undefined,
  })),
  resolvePersona: vi.fn(async () => ({ name: 'Player' })),
  getSessionPersonaId: vi.fn(async () => undefined),
}));

import { chatStore } from '$lib/stores/chat';
import { sceneStore } from '$lib/stores/scene';
import { generateAndInsertIllustrations } from '$lib/core/chat/use-chat-illustration';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { Message } from '$lib/types';

const imageConfig: ImageGenerationConfig = {
  provider: 'novelai',
  autoGenerate: true,
  artStylePresetId: 'anime',
  maxTokens: 64000,
  imagePromptInstructions: 'Generate image prompt',
  novelai: {
    apiKey: 'test-key',
    model: 'nai-diffusion-4-5-full',
    width: 832,
    height: 1216,
    steps: 28,
    scale: 5,
    sampler: 'k_euler_ancestral',
    noiseSchedule: 'karras',
  },
  comfyui: {
    url: 'http://localhost:8188',
    workflow: '',
    timeout: 60,
  },
};

describe('generateAndInsertIllustrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    chatStore.clear();
    sceneStore.reset();
    imageGeneratorMocks.planIllustrations.mockResolvedValue([]);
    imageGeneratorMocks.generateForChat.mockResolvedValue({
      dataUrl: 'data:image/png;base64,abc',
      prompt: 'rainy street, lantern glow',
    });
    imageGeneratorMocks.buildSegments.mockImplementation((text: string, _plans, results: Map<number, { dataUrl: string; prompt: string }>) => [
      { type: 'text', text },
      ...Array.from(results.values()).map((result) => ({
        type: 'image',
        dataUrl: result.dataUrl,
        prompt: result.prompt,
        id: 'img-1',
      })),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to a single scene image when the planner returns no placements', async () => {
    const assistantMessage: Message = {
      role: 'assistant',
      content: 'Rain gathers on the bridge.',
      type: 'dialogue',
      timestamp: Date.now(),
    };

    chatStore.setSessionState('char-1' as any, 'sess-1' as any, [assistantMessage], 'character');

    await generateAndInsertIllustrations(
      assistantMessage,
      { providerId: 'openai', apiKey: 'test', model: 'gpt-4o-mini' },
      imageConfig,
      [],
    );

    expect(imageGeneratorMocks.planIllustrations).toHaveBeenCalledOnce();
    expect(imageGeneratorMocks.generateForChat).toHaveBeenCalledOnce();
    expect(get(chatStore).messages[0].segments).toEqual([
      { type: 'text', text: 'Rain gathers on the bridge.' },
      { type: 'image', dataUrl: 'data:image/png;base64,abc', prompt: 'rainy street, lantern glow', id: 'img-1' },
    ]);
    expect(chatRepoMocks.saveMessages).toHaveBeenCalled();
  });

  it('retries illustration planning after a rate limit error', async () => {
    vi.useFakeTimers();

    const assistantMessage: Message = {
      role: 'assistant',
      content: 'Rain gathers on the bridge.',
      type: 'dialogue',
      timestamp: Date.now(),
    };

    chatStore.setSessionState('char-1' as any, 'sess-1' as any, [assistantMessage], 'character');
    imageGeneratorMocks.planIllustrations
      .mockRejectedValueOnce(new Error('NovelAI API error (429): Too Many Requests'))
      .mockResolvedValueOnce([]);

    const pending = generateAndInsertIllustrations(
      assistantMessage,
      { providerId: 'openai', apiKey: 'test', model: 'gpt-4o-mini' },
      imageConfig,
      [],
    );

    await vi.advanceTimersByTimeAsync(3000);
    await pending;

    expect(imageGeneratorMocks.planIllustrations).toHaveBeenCalledTimes(2);
    expect(imageGeneratorMocks.generateForChat).toHaveBeenCalledOnce();
  });
});
