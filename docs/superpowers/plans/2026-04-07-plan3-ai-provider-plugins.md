# AI Provider Plugins — Implementation Plan 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement built-in AI provider plugins (OpenAI-compatible, Claude) that make streaming HTTP requests and register them via the PluginRegistry.

**Architecture:** A factory function `createOpenAICompatibleProvider()` creates `ProviderPlugin` instances for NanoGPT, OpenAI, and Local LLM (all share the OpenAI chat completion API). A separate `ClaudeProvider` implements the Anthropic Messages API. Both use a shared SSE parser to yield streaming tokens via `AsyncGenerator<string>`. A `builtin.ts` module registers all providers into a `PluginRegistry`.

**Tech Stack:** Native `fetch` for HTTP, `ReadableStream` for SSE parsing, Vitest with `vi.stubGlobal('fetch')` for testing

---

## Prerequisites

- Plan 1 completed (types + PluginRegistry)
- Plan 2 completed (storage + stores)
- Working directory: `D:/Project/TextChatbot`

---

## File Structure (created by this plan)

```
D:/Project/TextChatbot/
├── src/lib/plugins/providers/
│   ├── sse.ts                        [NEW] Generic SSE stream parser
│   ├── openai-compatible.ts          [NEW] OpenAI-compatible provider factory
│   ├── claude.ts                     [NEW] Claude/Anthropic provider
│   └── builtin.ts                    [NEW] Register all built-in providers
├── tests/plugins/providers/
│   ├── sse.test.ts                   [NEW] SSE parser tests
│   ├── openai-compatible.test.ts     [NEW] OpenAI provider tests
│   ├── claude.test.ts                [NEW] Claude provider tests
│   └── builtin.test.ts              [NEW] Built-in registration tests
```

---

### Task 1: SSE Stream Parser (TDD)

**Files:**
- Create: `src/lib/plugins/providers/sse.ts`
- Create: `tests/plugins/providers/sse.test.ts`

- [ ] **Step 1: Write failing tests for SSE parser**

Write `tests/plugins/providers/sse.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseSSE } from '$lib/plugins/providers/sse';

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) {
    items.push(item);
  }
  return items;
}

describe('parseSSE', () => {
  it('parses single SSE data event', async () => {
    const stream = createMockStream(['data: {"text":"hello"}\n\n']);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hello"}']);
  });

  it('parses multiple SSE events', async () => {
    const stream = createMockStream([
      'data: {"text":"hello"}\n\ndata: {"text":"world"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hello"}', '{"text":"world"}']);
  });

  it('stops at [DONE]', async () => {
    const stream = createMockStream([
      'data: {"text":"hi"}\n\ndata: [DONE]\n\ndata: {"text":"ignored"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hi"}']);
  });

  it('handles events split across chunks', async () => {
    const stream = createMockStream([
      'data: {"text":"hel',
      'lo"}\n\ndata: {"text":"world"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hello"}', '{"text":"world"}']);
  });

  it('ignores non-data lines', async () => {
    const stream = createMockStream([
      'event: message_start\ndata: {"type":"start"}\n\ndata: {"type":"delta"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"type":"start"}', '{"type":"delta"}']);
  });

  it('returns empty for empty stream', async () => {
    const stream = createMockStream([]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: FAIL — module `$lib/plugins/providers/sse` does not exist.

- [ ] **Step 3: Implement SSE parser**

Write `src/lib/plugins/providers/sse.ts`:
```typescript
/**
 * Generic Server-Sent Events (SSE) stream parser.
 * Reads a ReadableStream<Uint8Array> and yields the data payload
 * of each `data:` line as a string.
 */

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          if (data) yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All SSE tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/providers/sse.ts tests/plugins/providers/sse.test.ts
git commit -m "feat: add SSE stream parser for AI provider streaming"
```

---

### Task 2: OpenAI-Compatible Provider (TDD)

**Files:**
- Create: `src/lib/plugins/providers/openai-compatible.ts`
- Create: `tests/plugins/providers/openai-compatible.test.ts`

- [ ] **Step 1: Write failing tests for OpenAI-compatible provider**

Write `tests/plugins/providers/openai-compatible.test.ts`:
```typescript
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

// Mock fetch
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
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
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

      // Verify fetch was called with correct arguments
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
        text: async () => 'Invalid API key',
      });

      await expect(
        async () => {
          for await (const _ of provider.chat(mockMessages, mockConfig)) {
            // consume
          }
        }
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

      for await (const _ of provider.chatWithCard(mockMessages, mockCard, mockConfig)) {
        // consume
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Should have system message + original messages
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

      for await (const _ of provider.chatWithCard(mockMessages, card, mockConfig)) {
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
      expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement OpenAI-compatible provider**

Write `src/lib/plugins/providers/openai-compatible.ts`:
```typescript
/**
 * OpenAI-compatible provider factory.
 * Creates ProviderPlugin instances for any API that follows the
 * OpenAI chat completion format (NanoGPT, OpenAI, Ollama, LM Studio, etc.).
 */

import type { ProviderPlugin } from '$lib/types/plugin';
import type { Message, UserConfig, CharacterCard, ConfigField, ModelInfo } from '$lib/types';
import { parseSSE } from './sse';

export interface OpenAICompatibleOptions {
  id: string;
  name: string;
  icon?: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
}

function messagesToOpenAI(
  messages: Message[]
): { role: string; content: string }[] {
  return messages.map((m) => ({
    role: m.role === 'narrator' ? 'assistant' : m.role,
    content: m.content,
  }));
}

function buildCardSystemPrompt(card: CharacterCard): string {
  if (card.systemPrompt) return card.systemPrompt;

  const parts: string[] = [];
  parts.push(`You are ${card.name}.`);
  if (card.description) parts.push(card.description);
  if (card.personality) parts.push(`Personality: ${card.personality}`);
  if (card.scenario) parts.push(`Scenario: ${card.scenario}`);
  return parts.join('\n\n');
}

function extractToken(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleOptions
): ProviderPlugin {
  const requiredConfig: ConfigField[] = [
    ...(options.requiresApiKey
      ? [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'password' as const,
            required: true,
          },
        ]
      : []),
    { key: 'model', label: 'Model', type: 'text', defaultValue: '' },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'text',
      defaultValue: options.defaultBaseUrl,
    },
    { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
    { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 2048 },
  ];

  return {
    id: options.id,
    name: options.name,
    icon: options.icon,
    requiredConfig,

    async validateConfig(config: UserConfig): Promise<boolean> {
      if (options.requiresApiKey && !config.apiKey) return false;
      return true;
    },

    async *chat(
      messages: Message[],
      config: UserConfig
    ): AsyncGenerator<string> {
      const baseUrl = (config.baseUrl as string) || options.defaultBaseUrl;
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model || '',
          messages: messagesToOpenAI(messages),
          stream: true,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI API error (${response.status}): ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new Error('No response body received from OpenAI API');
      }

      for await (const data of parseSSE(response.body)) {
        const token = extractToken(data);
        if (token) yield token;
      }
    },

    async *chatWithCard(
      messages: Message[],
      card: CharacterCard,
      config: UserConfig
    ): AsyncGenerator<string> {
      const systemPrompt = buildCardSystemPrompt(card);
      const systemMessage: Message = {
        role: 'system',
        content: systemPrompt,
        type: 'system',
        timestamp: Date.now(),
      };
      yield* this.chat([systemMessage, ...messages], config);
    },

    async listModels(config: UserConfig): Promise<ModelInfo[]> {
      const baseUrl = (config.baseUrl as string) || options.defaultBaseUrl;
      const url = `${baseUrl.replace(/\/$/, '')}/models`;

      try {
        const headers: Record<string, string> = {};
        if (config.apiKey) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) return [];

        const json = await response.json();
        return (json.data || []).map((m: { id: string; name?: string }) => ({
          id: m.id,
          name: m.name || m.id,
        }));
      } catch {
        return [];
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All OpenAI-compatible tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/providers/openai-compatible.ts tests/plugins/providers/openai-compatible.test.ts
git commit -m "feat: add OpenAI-compatible provider factory for NanoGPT/OpenAI/Local LLM"
```

---

### Task 3: Claude Provider (TDD)

**Files:**
- Create: `src/lib/plugins/providers/claude.ts`
- Create: `tests/plugins/providers/claude.test.ts`

- [ ] **Step 1: Write failing tests for Claude provider**

Write `tests/plugins/providers/claude.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeProvider } from '$lib/plugins/providers/claude';
import type { Message, UserConfig, CharacterCard } from '$lib/types';

// Mock SSE parser
vi.mock('$lib/plugins/providers/sse', () => ({
  parseSSE: vi.fn().mockImplementation(async function* () {
    yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
    yield '{"type":"content_block_delta","delta":{"type":"text_delta","text":" from Claude"}}';
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
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
      // System messages should NOT be in messages array
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
      // Only non-system messages in array
      expect(body.messages).toHaveLength(2);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        async () => {
          for await (const _ of provider.chat(mockMessages, mockConfig)) {
            // consume
          }
        }
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
      // Claude uses top-level system field
      expect(body.system).toContain('Alice');
      // Messages should not include system
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement Claude provider**

Write `src/lib/plugins/providers/claude.ts`:
```typescript
/**
 * Claude (Anthropic) provider implementation.
 * Uses the Anthropic Messages API with streaming.
 */

import type { ProviderPlugin } from '$lib/types/plugin';
import type { Message, UserConfig, CharacterCard, ConfigField } from '$lib/types';
import { parseSSE } from './sse';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

function messagesToClaude(
  messages: Message[]
): { system: string; messages: ClaudeMessage[] } {
  const systemParts: string[] = [];
  const claudeMessages: ClaudeMessage[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else {
      claudeMessages.push({
        role: m.role === 'narrator' ? 'assistant' : (m.role as 'user' | 'assistant'),
        content: m.content,
      });
    }
  }

  return { system: systemParts.join('\n\n'), messages: claudeMessages };
}

function buildCardSystemPrompt(card: CharacterCard): string {
  if (card.systemPrompt) return card.systemPrompt;

  const parts: string[] = [];
  parts.push(`You are ${card.name}.`);
  if (card.description) parts.push(card.description);
  if (card.personality) parts.push(`Personality: ${card.personality}`);
  if (card.scenario) parts.push(`Scenario: ${card.scenario}`);
  return parts.join('\n\n');
}

function extractToken(data: string): string {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === 'content_block_delta') {
      return parsed.delta?.text ?? '';
    }
    return '';
  } catch {
    return '';
  }
}

export function createClaudeProvider(): ProviderPlugin {
  const requiredConfig: ConfigField[] = [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      defaultValue: 'claude-sonnet-4-20250514',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'text',
      defaultValue: DEFAULT_BASE_URL,
    },
    { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
    { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 2048 },
  ];

  return {
    id: 'claude',
    name: 'Claude',
    requiredConfig,

    async validateConfig(config: UserConfig): Promise<boolean> {
      return !!config.apiKey;
    },

    async *chat(
      messages: Message[],
      config: UserConfig
    ): AsyncGenerator<string> {
      const baseUrl = (config.baseUrl as string) || DEFAULT_BASE_URL;
      const url = `${baseUrl.replace(/\/$/, '')}/messages`;

      const { system, messages: claudeMessages } = messagesToClaude(messages);

      const body: Record<string, unknown> = {
        model: config.model || 'claude-sonnet-4-20250514',
        messages: claudeMessages,
        stream: true,
        max_tokens: config.maxTokens ?? 2048,
      };
      if (system) {
        body.system = system;
      }
      if (config.temperature !== undefined) {
        body.temperature = config.temperature;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey || '',
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Claude API error (${response.status}): ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new Error('No response body received from Claude API');
      }

      for await (const data of parseSSE(response.body)) {
        const token = extractToken(data);
        if (token) yield token;
      }
    },

    async *chatWithCard(
      messages: Message[],
      card: CharacterCard,
      config: UserConfig
    ): AsyncGenerator<string> {
      const systemPrompt = buildCardSystemPrompt(card);
      const systemMessage: Message = {
        role: 'system',
        content: systemPrompt,
        type: 'system',
        timestamp: Date.now(),
      };
      yield* this.chat([systemMessage, ...messages], config);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All Claude provider tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/providers/claude.ts tests/plugins/providers/claude.test.ts
git commit -m "feat: add Claude/Anthropic provider with streaming support"
```

---

### Task 4: Built-in Provider Registration (TDD)

**Files:**
- Create: `src/lib/plugins/providers/builtin.ts`
- Create: `tests/plugins/providers/builtin.test.ts`

- [ ] **Step 1: Write failing tests for builtin registration**

Write `tests/plugins/providers/builtin.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { registerBuiltinProviders } from '$lib/plugins/providers/builtin';
import { PluginRegistry } from '$lib/plugins/registry';

describe('registerBuiltinProviders', () => {
  it('registers all 4 built-in providers', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const providers = registry.listProviders();
    expect(providers).toHaveLength(4);

    const ids = providers.map((p) => p.id).sort();
    expect(ids).toEqual(['claude', 'local-llm', 'nanogpt', 'openai']);
  });

  it('registers nanogpt provider with correct defaults', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const nanogpt = registry.getProvider('nanogpt');
    expect(nanogpt.name).toBe('NanoGPT');
  });

  it('registers openai provider', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const openai = registry.getProvider('openai');
    expect(openai.name).toBe('OpenAI');
  });

  it('registers claude provider', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const claude = registry.getProvider('claude');
    expect(claude.name).toBe('Claude');
  });

  it('registers local-llm provider without api key requirement', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const local = registry.getProvider('local-llm');
    expect(local.name).toBe('Local LLM');
    // Should validate without apiKey
    expect(local.validateConfig({ providerId: 'local-llm' })).resolves.toBe(true);
  });

  it('does not register duplicates on multiple calls', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    // Second call should throw for each duplicate
    expect(() => registerBuiltinProviders(registry)).toThrow('already registered');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement built-in provider registration**

Write `src/lib/plugins/providers/builtin.ts`:
```typescript
/**
 * Registers all built-in AI provider plugins with a PluginRegistry.
 */

import type { PluginRegistry } from '$lib/plugins/registry';
import { createOpenAICompatibleProvider } from './openai-compatible';
import { createClaudeProvider } from './claude';

export function registerBuiltinProviders(registry: PluginRegistry): void {
  // Priority order: NanoGPT → OpenAI → Claude → Local LLM

  registry.registerProvider(
    createOpenAICompatibleProvider({
      id: 'nanogpt',
      name: 'NanoGPT',
      defaultBaseUrl: 'https://api.nanogpt.io/v1',
      requiresApiKey: true,
    })
  );

  registry.registerProvider(
    createOpenAICompatibleProvider({
      id: 'openai',
      name: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      requiresApiKey: true,
    })
  );

  registry.registerProvider(createClaudeProvider());

  registry.registerProvider(
    createOpenAICompatibleProvider({
      id: 'local-llm',
      name: 'Local LLM',
      defaultBaseUrl: 'http://localhost:11434/v1',
      requiresApiKey: false,
    })
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

Run:
```bash
cd "D:/Project/TextChatbot"
git add src/lib/plugins/providers/builtin.ts tests/plugins/providers/builtin.test.ts
git commit -m "feat: add built-in provider registration (NanoGPT, OpenAI, Claude, Local LLM)"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run type check**

Run: `cd "D:/Project/TextChatbot" && npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Run all tests**

Run: `cd "D:/Project/TextChatbot" && npx vitest run`
Expected: All tests pass (including providers).

- [ ] **Step 3: Run SvelteKit build**

Run: `cd "D:/Project/TextChatbot" && npm run build`
Expected: Build succeeds.

---

## Self-Review Checklist

**1. Spec coverage:**

| Spec Section | Covered in Task | Notes |
|---|---|---|
| Section 3.1 — ProviderPlugin interface | All tasks | `chat`, `chatWithCard`, `listModels`, `validateConfig`, `requiredConfig` |
| NanoGPT provider | Task 2 + 4 | OpenAI-compatible factory, priority order |
| OpenAI provider | Task 2 + 4 | OpenAI-compatible factory |
| Claude provider | Task 3 + 4 | Dedicated Anthropic API implementation |
| Local LLM provider | Task 2 + 4 | OpenAI-compatible factory, no API key required |
| Streaming (AsyncGenerator<string>) | Task 1 + 2 + 3 | SSE parser + provider implementations |
| Plugin registration via registry | Task 4 | `registerBuiltinProviders()` |

**2. Placeholder scan:** No TBD, TODO, or incomplete steps found. All steps contain exact code and commands.

**3. Type consistency:**
- `ProviderPlugin` interface matches `plugin.ts` definition (id, name, icon, requiredConfig, chat, chatWithCard, listModels, validateConfig)
- `Message` type uses `MessageRole` values: 'user' | 'assistant' | 'system' | 'narrator'
- `UserConfig` type has providerId, model, apiKey, baseUrl, temperature, maxTokens
- `ConfigField` type has key, label, type, defaultValue, required
- `ModelInfo` type has id, name
- `PluginRegistry` methods: registerProvider, getProvider, listProviders
