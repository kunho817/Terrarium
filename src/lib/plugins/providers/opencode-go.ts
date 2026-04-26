import type { ProviderPlugin, ChatMetadata } from '$lib/types/plugin';
import type { CharacterCard, ConfigField, Message, ModelInfo, UserConfig } from '$lib/types';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { parseSSE } from './sse';
import { hydrateProviderRuntimeConfig } from './runtime-config';

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';
const DEFAULT_MODEL_ID = 'glm-5.1';
const ANTHROPIC_VERSION = '2023-06-01';

type ModelTransport = 'openai' | 'anthropic' | 'alibaba';

interface GoModelDefinition {
  id: string;
  name: string;
  transport: ModelTransport;
}

const GO_MODELS: GoModelDefinition[] = [
  { id: 'glm-5.1', name: 'GLM-5.1', transport: 'openai' },
  { id: 'glm-5', name: 'GLM-5', transport: 'openai' },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', transport: 'openai' },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', transport: 'openai' },
  { id: 'mimo-v2-pro', name: 'MiMo-V2-Pro', transport: 'openai' },
  { id: 'mimo-v2-omni', name: 'MiMo-V2-Omni', transport: 'openai' },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', transport: 'anthropic' },
  { id: 'minimax-m2.5', name: 'MiniMax M2.5', transport: 'anthropic' },
  { id: 'qwen3.6-plus', name: 'Qwen3.6 Plus', transport: 'alibaba' },
  { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus', transport: 'alibaba' },
];

function normalizeModelId(modelId: string | undefined): string | undefined {
  if (!modelId) {
    return modelId;
  }
  return modelId.replace(/^opencode-go\//, '');
}

function resolveModel(modelId: string | undefined): GoModelDefinition {
  const normalized = normalizeModelId(modelId);
  return GO_MODELS.find((model) => model.id === normalized) ?? GO_MODELS[0];
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

function messagesToOpenAI(messages: Message[]): { role: string; content: string }[] {
  return messages.map((message) => ({
    role: message.role === 'narrator' ? 'assistant' : message.role,
    content: message.content,
  }));
}

function messagesToAnthropic(
  messages: Message[],
): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
  const systemParts: string[] = [];
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }

    anthropicMessages.push({
      role: message.role === 'narrator' ? 'assistant' : (message.role as 'user' | 'assistant'),
      content: message.content,
    });
  }

  return { system: systemParts.join('\n\n'), messages: anthropicMessages };
}

function extractOpenAIToken(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

function extractAlibabaToken(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

function extractOpenAIUsage(
  data: string,
): { prompt_tokens: number; completion_tokens: number } | null {
  try {
    const parsed = JSON.parse(data);
    const usage = parsed.usage;
    if (
      usage
      && typeof usage.prompt_tokens === 'number'
      && typeof usage.completion_tokens === 'number'
    ) {
      return usage;
    }
    return null;
  } catch {
    return null;
  }
}

function extractAnthropicToken(data: string): string {
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

async function buildGoErrorMessage(response: {
  status: number;
  statusText?: string;
  text?: () => Promise<string>;
}): Promise<string> {
  const bodyText = await response.text?.().catch(() => '') ?? '';
  const detail = bodyText.trim() || response.statusText || 'Unknown error';
  return `OpenCode Go API error (${response.status}): ${detail}`;
}

async function* chatOpenAICompatible(
  messages: Message[],
  config: UserConfig,
  metadata?: ChatMetadata,
): AsyncGenerator<string> {
  const resolvedConfig = hydrateProviderRuntimeConfig(
    config,
    'opencode-go',
    DEFAULT_BASE_URL,
  );
  const baseUrl = ((resolvedConfig.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/$/, '');
  const response = await tauriFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedConfig.apiKey || ''}`,
    },
    body: JSON.stringify({
      model: resolvedConfig.model || DEFAULT_MODEL_ID,
      messages: messagesToOpenAI(messages),
      stream: true,
      stream_options: { include_usage: true },
      temperature: resolvedConfig.temperature ?? 0.7,
      max_tokens: resolvedConfig.maxTokens ?? 64000,
    }),
  });

  if (!response.ok) {
    throw new Error(await buildGoErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('No response body received from OpenCode Go');
  }

  for await (const data of parseSSE(response.body)) {
    const token = extractOpenAIToken(data);
    if (token) yield token;

    if (metadata) {
      const usage = extractOpenAIUsage(data);
      if (usage) {
        metadata.inputTokens = usage.prompt_tokens;
        metadata.outputTokens = usage.completion_tokens;
      }
    }
  }
}

async function* chatAlibabaCompatible(
  messages: Message[],
  config: UserConfig,
  metadata?: ChatMetadata,
): AsyncGenerator<string> {
  const resolvedConfig = hydrateProviderRuntimeConfig(
    config,
    'opencode-go',
    DEFAULT_BASE_URL,
  );
  const baseUrl = ((resolvedConfig.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/$/, '');
  const body: Record<string, unknown> = {
    model: normalizeModelId((resolvedConfig.model as string) || DEFAULT_MODEL_ID) || DEFAULT_MODEL_ID,
    messages: messagesToOpenAI(messages),
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: resolvedConfig.maxTokens ?? 64000,
    enable_thinking: false,
  };

  if (resolvedConfig.temperature !== undefined) {
    body.temperature = resolvedConfig.temperature;
  }

  const response = await tauriFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedConfig.apiKey || ''}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await buildGoErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('No response body received from OpenCode Go');
  }

  for await (const data of parseSSE(response.body)) {
    const token = extractAlibabaToken(data);
    if (token) yield token;

    if (metadata) {
      const usage = extractOpenAIUsage(data);
      if (usage) {
        metadata.inputTokens = usage.prompt_tokens;
        metadata.outputTokens = usage.completion_tokens;
      }
    }
  }
}

async function* chatAnthropicCompatible(
  messages: Message[],
  config: UserConfig,
  metadata?: ChatMetadata,
): AsyncGenerator<string> {
  const resolvedConfig = hydrateProviderRuntimeConfig(
    config,
    'opencode-go',
    DEFAULT_BASE_URL,
  );
  const baseUrl = ((resolvedConfig.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/$/, '');
  const { system, messages: anthropicMessages } = messagesToAnthropic(messages);
  const body: Record<string, unknown> = {
    model: resolvedConfig.model || DEFAULT_MODEL_ID,
    messages: anthropicMessages,
    stream: true,
    max_tokens: resolvedConfig.maxTokens ?? 64000,
  };

  if (system) {
    body.system = system;
  }
  if (resolvedConfig.temperature !== undefined) {
    body.temperature = resolvedConfig.temperature;
  }

  const response = await tauriFetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': resolvedConfig.apiKey || '',
        'anthropic-version': ANTHROPIC_VERSION,
      },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await buildGoErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('No response body received from OpenCode Go');
  }

  for await (const data of parseSSE(response.body)) {
    if (metadata) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'message_start' && parsed.message?.usage?.input_tokens != null) {
          metadata.inputTokens = parsed.message.usage.input_tokens;
        } else if (parsed.type === 'message_delta' && parsed.usage?.output_tokens != null) {
          metadata.outputTokens = parsed.usage.output_tokens;
        }
      } catch {
      }
    }

    const token = extractAnthropicToken(data);
    if (token) yield token;
  }
}

export function createOpenCodeGoProvider(): ProviderPlugin {
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
      type: 'select',
      defaultValue: DEFAULT_MODEL_ID,
      options: GO_MODELS.map((model) => ({
        label: model.name,
        value: model.id,
      })),
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'text',
      defaultValue: DEFAULT_BASE_URL,
      placeholder: DEFAULT_BASE_URL,
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number',
      defaultValue: 0.7,
    },
    {
      key: 'maxTokens',
      label: 'Max Tokens',
      type: 'number',
      defaultValue: 64000,
    },
  ];

  return {
    id: 'opencode-go',
    name: 'OpenCode Go',
    requiredConfig,

    async validateConfig(config: UserConfig): Promise<boolean> {
      return !!hydrateProviderRuntimeConfig(config, 'opencode-go', DEFAULT_BASE_URL).apiKey;
    },

    async *chat(
      messages: Message[],
      config: UserConfig,
      metadata?: ChatMetadata,
    ): AsyncGenerator<string> {
      const model = resolveModel((config.model as string) || undefined);
      const resolvedConfig: UserConfig = {
        ...config,
        providerId: 'opencode-go',
        model: model.id,
      };

      if (model.transport === 'anthropic') {
        yield* chatAnthropicCompatible(messages, resolvedConfig, metadata);
        return;
      }

      if (model.transport === 'alibaba') {
        yield* chatAlibabaCompatible(messages, resolvedConfig, metadata);
        return;
      }

      yield* chatOpenAICompatible(messages, resolvedConfig, metadata);
    },

    async *chatWithCard(
      messages: Message[],
      card: CharacterCard,
      config: UserConfig,
    ): AsyncGenerator<string> {
      const systemMessage: Message = {
        role: 'system',
        content: buildCardSystemPrompt(card),
        type: 'system',
        timestamp: Date.now(),
      };

      yield* this.chat([systemMessage, ...messages], config);
    },

    async listModels(): Promise<ModelInfo[]> {
      return GO_MODELS.map((model) => ({
        id: model.id,
        name: model.name,
      }));
    },
  };
}
