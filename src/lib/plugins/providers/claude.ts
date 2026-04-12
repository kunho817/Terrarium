/**
 * Claude (Anthropic) provider implementation.
 * Uses the Anthropic Messages API with streaming.
 *
 * Key differences from OpenAI-compatible APIs:
 * - `x-api-key` header instead of `Authorization: Bearer`
 * - `anthropic-version` header required
 * - Top-level `system` field instead of system messages in the array
 * - `content_block_delta` events with `delta.text` for streaming tokens
 */

import type { ProviderPlugin, ChatMetadata } from '$lib/types/plugin';
import type { Message, UserConfig, CharacterCard, ConfigField } from '$lib/types';
import { parseSSE } from './sse';
import { fetch } from '@tauri-apps/plugin-http';

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
      config: UserConfig,
      metadata?: ChatMetadata,
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
        // Extract usage metadata from message_start and message_delta events
        if (metadata) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'message_start' && parsed.message?.usage?.input_tokens != null) {
              metadata.inputTokens = parsed.message.usage.input_tokens;
            } else if (parsed.type === 'message_delta' && parsed.usage?.output_tokens != null) {
              metadata.outputTokens = parsed.usage.output_tokens;
            }
          } catch {
            // Not valid JSON — skip usage extraction for this chunk
          }
        }

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
