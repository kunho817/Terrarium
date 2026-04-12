import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeProvider } from '$lib/plugins/providers/claude';
import type { Message, UserConfig, CharacterCard } from '$lib/types';
import type { ChatMetadata } from '$lib/types/plugin';

// Mock SSE parser
vi.mock('$lib/plugins/providers/sse', () => ({
  parseSSE: vi.fn().mockImplementation(async function* () {
    yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
    yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":" from Claude"}}';
  }),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

const mockFetch = await import('@tauri-apps/plugin-http').then(m => m.fetch as unknown as ReturnType<typeof vi.fn>);

const mockConfig: UserConfig = {
  providerId: 'claude',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-ant-test',
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

describe('Claude provider', () => {
  let provider: ReturnType<typeof createClaudeProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createClaudeProvider();
  });

  describe('properties', () => {
    it('has correct id and name', () => {
      expect(provider.id).toBe('claude');
      expect(provider.name).toBe('Claude');
    });

    it('requires apiKey in config', () => {
      const keys = provider.requiredConfig.map((f) => f.key);
      expect(keys).toContain('apiKey');
    });
  });

  describe('validateConfig', () => {
    it('returns true when apiKey is present', async () => {
      const result = await provider.validateConfig(mockConfig);
      expect(result).toBe(true);
    });

    it('returns false when apiKey is missing', async () => {
      const result = await provider.validateConfig({ providerId: 'claude' });
      expect(result).toBe(false);
    });
  });

  describe('chat', () => {
    it('sends correct Claude API request format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const tokens: string[] = [];
      for await (const token of provider.chat(mockMessages, mockConfig)) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['Hello', ' from Claude']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(init.method).toBe('POST');
      expect(init.headers['x-api-key']).toBe('sk-ant-test');
      expect(init.headers['anthropic-version']).toBe('2023-06-01');
      expect(init.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body);
      expect(body.model).toBe('claude-sonnet-4-20250514');
      expect(body.stream).toBe(true);
      expect(body.max_tokens).toBe(2048);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('extracts system messages to top-level system field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const messages: Message[] = [
        { role: 'system', content: 'You are helpful.', type: 'system', timestamp: 0 },
        ...mockMessages,
      ];

      for await (const _ of provider.chat(messages, mockConfig)) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe('You are helpful.');
      expect(body.messages).toHaveLength(2);
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
      ).rejects.toThrow('Claude API error (401)');
    });

    it('uses custom baseUrl when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const config = { ...mockConfig, baseUrl: 'http://localhost:8080/v1' };

      for await (const _ of provider.chat(mockMessages, config)) {
        // consume
      }

      expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8080/v1/messages');
    });

    it('populates metadata.inputTokens from message_start event', async () => {
      const { parseSSE } = await import('$lib/plugins/providers/sse');
      vi.mocked(parseSSE).mockImplementation(async function* () {
        yield '{"type":"message_start","message":{"usage":{"input_tokens":42}}}';
        yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const metadata: ChatMetadata = {};
      for await (const _ of provider.chat(mockMessages, mockConfig, metadata)) {
        // consume
      }

      expect(metadata.inputTokens).toBe(42);
    });

    it('populates metadata.outputTokens from message_delta event', async () => {
      const { parseSSE } = await import('$lib/plugins/providers/sse');
      vi.mocked(parseSSE).mockImplementation(async function* () {
        yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
        yield '{"type":"message_delta","usage":{"output_tokens":7}}';
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const metadata: ChatMetadata = {};
      for await (const _ of provider.chat(mockMessages, mockConfig, metadata)) {
        // consume
      }

      expect(metadata.outputTokens).toBe(7);
    });

    it('populates both inputTokens and outputTokens', async () => {
      const { parseSSE } = await import('$lib/plugins/providers/sse');
      vi.mocked(parseSSE).mockImplementation(async function* () {
        yield '{"type":"message_start","message":{"usage":{"input_tokens":100}}}';
        yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}';
        yield '{"type":"message_delta","usage":{"output_tokens":15}}';
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const metadata: ChatMetadata = {};
      for await (const _ of provider.chat(mockMessages, mockConfig, metadata)) {
        // consume
      }

      expect(metadata.inputTokens).toBe(100);
      expect(metadata.outputTokens).toBe(15);
    });

    it('does not crash when metadata is not provided', async () => {
      const { parseSSE } = await import('$lib/plugins/providers/sse');
      vi.mocked(parseSSE).mockImplementation(async function* () {
        yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
        yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":" from Claude"}}';
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const tokens: string[] = [];
      // Call without metadata — should not throw
      for await (const token of provider.chat(mockMessages, mockConfig)) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['Hello', ' from Claude']);
    });
  });

  describe('chatWithCard', () => {
    it('uses card as system prompt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      for await (const _ of provider.chatWithCard(mockMessages, mockCard, mockConfig)) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toContain('Alice');
      const roles = body.messages.map((m: { role: string }) => m.role);
      expect(roles).not.toContain('system');
    });

    it('uses card.systemPrompt when set', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(),
      });

      const card = { ...mockCard, systemPrompt: 'Custom Claude prompt' };

      for await (const _ of provider.chatWithCard(mockMessages, card, mockConfig)) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe('Custom Claude prompt');
    });
  });
});
