/**
 * OpenAI-compatible provider factory.
 * Creates ProviderPlugin instances for any API that follows the
 * OpenAI chat completion format (NanoGPT, OpenAI, Ollama, LM Studio, etc.).
 */

import type { ProviderPlugin, ChatMetadata } from '$lib/types/plugin';
import type { Message, UserConfig, CharacterCard, ConfigField, ModelInfo } from '$lib/types';
import { parseSSE } from './sse';
import { hydrateProviderRuntimeConfig } from './runtime-config';

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

function extractUsage(
  data: string
): { prompt_tokens: number; completion_tokens: number } | null {
  try {
    const parsed = JSON.parse(data);
    const usage = parsed.usage;
    if (usage && typeof usage.prompt_tokens === 'number' && typeof usage.completion_tokens === 'number') {
      return usage;
    }
    return null;
  } catch {
    return null;
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
    { key: 'model', label: 'Model', type: 'text' as const, defaultValue: '' },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number' as const,
      defaultValue: 0.7,
    },
    {
      key: 'maxTokens',
      label: 'Max Tokens',
      type: 'number' as const,
      defaultValue: 2048,
    },
  ];

  return {
    id: options.id,
    name: options.name,
    icon: options.icon,
    requiredConfig,

    async validateConfig(config: UserConfig): Promise<boolean> {
      const resolvedConfig = hydrateProviderRuntimeConfig(
        config,
        options.id,
        options.defaultBaseUrl,
      );
      if (options.requiresApiKey && !resolvedConfig.apiKey) return false;
      return true;
    },

    async *chat(
      messages: Message[],
      config: UserConfig,
      metadata?: ChatMetadata
    ): AsyncGenerator<string> {
      const resolvedConfig = hydrateProviderRuntimeConfig(
        config,
        options.id,
        options.defaultBaseUrl,
      );
      const baseUrl = (resolvedConfig.baseUrl as string) || options.defaultBaseUrl;
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (resolvedConfig.apiKey) {
        headers['Authorization'] = `Bearer ${resolvedConfig.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: resolvedConfig.model || '',
          messages: messagesToOpenAI(messages),
          stream: true,
          stream_options: { include_usage: true },
          temperature: resolvedConfig.temperature ?? 0.7,
          max_tokens: resolvedConfig.maxTokens ?? 2048,
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

        if (metadata) {
          const usage = extractUsage(data);
          if (usage) {
            metadata.inputTokens = usage.prompt_tokens;
            metadata.outputTokens = usage.completion_tokens;
          }
        }
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
      const resolvedConfig = hydrateProviderRuntimeConfig(
        config,
        options.id,
        options.defaultBaseUrl,
      );
      const baseUrl = (resolvedConfig.baseUrl as string) || options.defaultBaseUrl;
      const url = `${baseUrl.replace(/\/$/, '')}/models`;

      try {
        const headers: Record<string, string> = {};
        if (resolvedConfig.apiKey) {
          headers['Authorization'] = `Bearer ${resolvedConfig.apiKey}`;
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
