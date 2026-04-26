import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenCodeGoProvider } from '$lib/plugins/providers/opencode-go';
import type { ChatMetadata } from '$lib/types/plugin';
import type { CharacterCard, Message, UserConfig } from '$lib/types';
import { settingsStore } from '$lib/stores/settings';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('$lib/plugins/providers/sse', () => ({
  parseSSE: vi.fn().mockImplementation(async function* () {
    yield '{"choices":[{"delta":{"content":"Hello"}}]}';
    yield '{"choices":[{"delta":{"content":" world"}}]}';
  }),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mockFetch,
}));

const mockMessages: Message[] = [
  { role: 'user', content: 'Hi', type: 'dialogue', timestamp: 1000 },
  { role: 'assistant', content: 'Hello', type: 'dialogue', timestamp: 2000 },
];

const mockCard: CharacterCard = {
  name: 'Alice',
  description: 'A friendly character',
  personality: 'Cheerful',
  scenario: 'A quiet room',
  firstMessage: 'Hi there!',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: {
    tokenBudget: 2048,
    scanDepth: 5,
    recursiveScanning: false,
    fullWordMatching: false,
  },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

function createMockStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

describe('OpenCode Go provider', () => {
  const provider = createOpenCodeGoProvider();

  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.reset();
  });

  it('exposes the current Go model list as select options', () => {
    const modelField = provider.requiredConfig.find((field) => field.key === 'model');

    expect(modelField?.type).toBe('select');
    expect(modelField?.options).toEqual(
      expect.arrayContaining([
        { label: 'GLM-5.1', value: 'glm-5.1' },
        { label: 'MiniMax M2.7', value: 'minimax-m2.7' },
        { label: 'Qwen3.6 Plus', value: 'qwen3.6-plus' },
      ]),
    );
  });

  it('uses the chat/completions endpoint for OpenAI-compatible Go models', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createMockStream(),
    });

    const tokens: string[] = [];
    for await (const token of provider.chat(mockMessages, {
      providerId: 'opencode-go',
      apiKey: 'go-key',
      model: 'glm-5.1',
      maxTokens: 64000,
      temperature: 0.2,
    } satisfies UserConfig)) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hello', ' world']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer go-key');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('glm-5.1');
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.max_tokens).toBe(64000);
  });

  it('inherits provider apiKey when the model card apiKey is blank', async () => {
    settingsStore.update({
      providers: {
        'opencode-go': {
          apiKey: 'go-inherited-key',
        },
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      body: createMockStream(),
    });

    for await (const _ of provider.chat(mockMessages, {
      providerId: 'opencode-go',
      apiKey: '',
      model: 'glm-5.1',
    } satisfies UserConfig)) {
    }

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer go-inherited-key');
  });

  it('uses the messages endpoint for MiniMax Go models', async () => {
    const { parseSSE } = await import('$lib/plugins/providers/sse');
    vi.mocked(parseSSE).mockImplementationOnce(async function* () {
      yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
      yield '{"type":"message_delta","usage":{"output_tokens":9}}';
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: createMockStream(),
    });

    const metadata: ChatMetadata = {};
    const tokens: string[] = [];
    for await (const token of provider.chat(mockMessages, {
      providerId: 'opencode-go',
      apiKey: 'go-key',
      model: 'minimax-m2.7',
      maxTokens: 32000,
    } satisfies UserConfig, metadata)) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hi']);
    expect(metadata.outputTokens).toBe(9);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://opencode.ai/zen/go/v1/messages');
    expect(init.headers['x-api-key']).toBe('go-key');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('minimax-m2.7');
    expect(body.max_tokens).toBe(32000);
  });

  it('uses the Alibaba-flavored chat/completions payload for Qwen Go models', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createMockStream(),
    });

    const tokens: string[] = [];
    for await (const token of provider.chat(mockMessages, {
      providerId: 'opencode-go',
      apiKey: 'go-key',
      model: 'qwen3.6-plus',
      maxTokens: 64000,
      temperature: 0.3,
    } satisfies UserConfig)) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['Hello', ' world']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('qwen3.6-plus');
    expect(body.enable_thinking).toBe(false);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it('includes the response body in Go API errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue('{"error":"invalid model"}'),
    });

    await expect(async () => {
      for await (const _ of provider.chat(mockMessages, {
        providerId: 'opencode-go',
        apiKey: 'go-key',
        model: 'qwen3.5-plus',
      } satisfies UserConfig)) {
      }
    }).rejects.toThrow('OpenCode Go API error (400): {"error":"invalid model"}');
  });

  it('inherits provider apiKey for MiniMax transport when the model card apiKey is blank', async () => {
    settingsStore.update({
      providers: {
        'opencode-go': {
          apiKey: 'go-inherited-key',
        },
      },
    });
    const { parseSSE } = await import('$lib/plugins/providers/sse');
    vi.mocked(parseSSE).mockImplementationOnce(async function* () {
      yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: createMockStream(),
    });

    for await (const _ of provider.chat(mockMessages, {
      providerId: 'opencode-go',
      apiKey: '',
      model: 'minimax-m2.7',
    } satisfies UserConfig)) {
    }

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['x-api-key']).toBe('go-inherited-key');
  });

  it('validates when apiKey is inherited from provider settings', async () => {
    settingsStore.update({
      providers: {
        'opencode-go': {
          apiKey: 'go-inherited-key',
        },
      },
    });

    const result = await provider.validateConfig({
      providerId: 'opencode-go',
      apiKey: '',
    } satisfies UserConfig);

    expect(result).toBe(true);
  });

  it('prepends card prompt through chatWithCard', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: createMockStream(),
    });

    for await (const _ of provider.chatWithCard(mockMessages, mockCard, {
      providerId: 'opencode-go',
      apiKey: 'go-key',
      model: 'glm-5',
    } satisfies UserConfig)) {
    }

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('Alice');
  });

  it('returns the static model list through listModels', async () => {
    const models = await provider.listModels!({ providerId: 'opencode-go' });

    expect(models).toHaveLength(10);
    expect(models).toEqual(
      expect.arrayContaining([
        { id: 'glm-5.1', name: 'GLM-5.1' },
        { id: 'minimax-m2.5', name: 'MiniMax M2.5' },
      ]),
    );
  });
});
