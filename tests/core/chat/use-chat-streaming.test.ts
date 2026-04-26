import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { streamAndFinalize } from '$lib/core/chat/use-chat-streaming';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { Message } from '$lib/types';

const chatRepoMocks = vi.hoisted(() => ({
  saveMessages: vi.fn(),
}));

const illustrationMocks = vi.hoisted(() => ({
  enqueueAutoIllustrations: vi.fn(),
}));

vi.mock('$lib/repositories/chat-repo', () => ({
  chatRepo: chatRepoMocks,
}));

vi.mock('$lib/core/chat/use-chat-illustration', () => ({
  enqueueAutoIllustrations: illustrationMocks.enqueueAutoIllustrations,
}));

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

async function* makeStream(tokens: string[]): AsyncGenerator<string, void, unknown> {
  for (const token of tokens) {
    yield token;
  }
}

async function* makeFailingStream(tokens: string[], error: Error): AsyncGenerator<string, void, unknown> {
  for (const token of tokens) {
    yield token;
  }
  throw error;
}

describe('streamAndFinalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatStore.clear();
  });

  it('waits for afterGeneration before starting auto illustrations', async () => {
    let resolveAfterGeneration!: () => void;
    const afterGeneration = new Promise<void>((resolve) => {
      resolveAfterGeneration = resolve;
    });

    const assistantMessage: Message = {
      role: 'assistant',
      content: 'Rain gathers on the bridge.',
      type: 'dialogue',
      timestamp: Date.now(),
    };

    await streamAndFinalize(
      makeStream(['Rain', ' gathers']),
      Promise.resolve(assistantMessage),
      afterGeneration,
      { providerId: 'openai', apiKey: 'test', model: 'gpt-4o-mini' },
      imageConfig,
      true,
      [],
    );

    expect(chatRepoMocks.saveMessages).toHaveBeenCalled();
    expect(illustrationMocks.enqueueAutoIllustrations).not.toHaveBeenCalled();

    resolveAfterGeneration();
    await vi.waitFor(() => {
      expect(illustrationMocks.enqueueAutoIllustrations).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: 'Rain gathers on the bridge.',
          type: 'dialogue',
        }),
        { providerId: 'openai', apiKey: 'test', model: 'gpt-4o-mini' },
        imageConfig,
        [],
        expect.any(String),
      );
    });
  });

  it('keeps a partial assistant message when the response stream fails after yielding tokens', async () => {
    const assistantMessage: Message = {
      role: 'assistant',
      content: 'The lantern flickers in the rain.',
      type: 'dialogue',
      timestamp: Date.now(),
      generationInfo: {
        model: 'gpt-4o-mini',
      },
    };

    await expect(
      streamAndFinalize(
        makeFailingStream(['The lantern', ' flickers'], new Error('error decoding response body')),
        Promise.resolve(assistantMessage),
        Promise.resolve(),
        { providerId: 'openai', apiKey: 'test', model: 'gpt-4o-mini' },
        imageConfig,
        false,
        [],
      ),
    ).resolves.toBeUndefined();

    expect(chatRepoMocks.saveMessages).toHaveBeenCalled();
    const latestMessages = get(chatStore).messages;

    expect(latestMessages).toHaveLength(1);
    expect(latestMessages[0].content).toBe('The lantern flickers in the rain.');
    expect(latestMessages[0].generationInfo?.streamError).toBe('error decoding response body');
  });
});
