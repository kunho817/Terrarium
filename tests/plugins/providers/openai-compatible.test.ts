import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenAICompatibleProvider } from '$lib/plugins/providers/openai-compatible';
import type { Message, UserConfig, CharacterCard } from '$lib/types';

// Mock SSE parser
vi.mock('$lib/plugins/providers/sse', () => ({
  parseSSE: vi.fn().mockImplementation(async function* () {
    yield '{"choices":[{"delta":{"content":"Hello"}}]}';
    yield '{"choices":[{"delta":{"content":" world"}}]}';
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockConfig: UserConfig = {
  providerId: 'openai',
  model: 'gpt-4',
  apiKey: 'test-key',
  temperature: 0.7,
  maxTokens: 2048,
};

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

describe('OpenAI-compatible provider', () => {
  let provider: ReturnType<typeof createOpenAICompatibleProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createOpenAICompatibleProvider({
      id: 'openai',
      name: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      requiresApiKey: true,
    });
  });

  describe('properties', () => {
    it('has correct id and name', () => {
      expect(provider.id).toBe('openai');
      expect(provider.name).toBe('OpenAI');
    });

    it('has required config fields', () => {
      const keys = provider.requiredConfig.map((f) => f.key);
      expect(keys).toContain('apiKey');
      expect(keys).toContain('model');
    });
  });

  describe('validateConfig', () => {
    it('returns true when apiKey is present and requiresApiKey is true', async () => {
      const result = await provider.validateConfig(mockConfig);
      expect(result).toBe(true);
    });

    it('returns false when apiKey is missing and requiresApiKey is true', async () => {
      const result = await provider.validateConfig({ providerId: 'openai' });
      expect(result).toBe(false);
    });

    it('returns true without apiKey when requiresApiKey is false', async () => {
      const noKeyProvider = createOpenAICompatibleProvider({
        id: 'local',
        name: 'Local',
        defaultBaseUrl: 'http://localhost:11434/v1',
        requiresApiKey: false,
      });
      const result = await noKeyProvider.validateConfig({ providerId: 'local' });
      expect(result).toBe(true);
    });
  });

  describe('chat', () => {
    it('sends correct request format and yields tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const tokens: string[] = [];
      for await (const token of provider.chat(mockMessages, mockConfig)) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['Hello', ' world']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-key');
      const body = JSON.parse(init.body);
      expect(body.model).toBe('gpt-4');
      expect(body.stream).toBe(true);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('uses custom baseUrl when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const config = { ...mockConfig, baseUrl: 'http://localhost:11434/v1' };

      for await (const _ of provider.chat(mockMessages, config)) {
        // consume
      }

      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://localhost:11434/v1/chat/completions'
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        (async () => {
          for await (const _ of provider.chat(mockMessages, mockConfig)) {
            // consume
          }
        })()
      ).rejects.toThrow('OpenAI API error (401)');
    });

    it('maps narrator role to assistant', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const narratorMsg: Message = {
        role: 'narrator',
        content: 'The room was dark.',
        type: 'narrator',
        timestamp: 3000,
      };

      for await (const _ of provider.chat([narratorMsg], mockConfig)) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].role).toBe('assistant');
    });
  });

  describe('chatWithCard', () => {
    it('prepends system prompt from card fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      for await (const _ of provider.chatWithCard(
        mockMessages,
        mockCard,
        mockConfig
      )) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('Alice');
    });

    it('uses card.systemPrompt when set', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const card = { ...mockCard, systemPrompt: 'Custom system prompt' };

      for await (const _ of provider.chatWithCard(
        mockMessages,
        card,
        mockConfig
      )) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toBe('Custom system prompt');
    });
  });

  describe('listModels', () => {
    it('returns model list from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
          ],
        }),
      });

      const models = await provider.listModels!(mockConfig);

      expect(models).toEqual([
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ]);
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.openai.com/v1/models'
      );
    });

    it('returns empty array on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const models = await provider.listModels!(mockConfig);
      expect(models).toEqual([]);
    });
  });
});
