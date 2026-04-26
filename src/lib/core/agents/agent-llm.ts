import type { Message } from '$lib/types/message';
import type { UserConfig } from '$lib/types/config';
import type { ChatMetadata } from '$lib/types/plugin';
import { getRegistry } from '$lib/core/bootstrap';
import {
  getActiveAgentJailbreak,
  getActivePresetMainJailbreak,
} from '$lib/core/presets/active-preset';

export interface AgentLLMConfig {
	providerId: string;
	apiKey: string;
	model: string;
	baseUrl?: string;
	temperature?: number;
	maxTokens?: number;
}

export interface AgentLLMCallResult {
  text: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentLLMCallOptions {
  jailbreak?: string;
  assistantPrefill?: string;
}

export function getActiveJailbreak(scope: 'agent' | 'main' = 'agent'): string {
	return scope === 'main'
		? getActivePresetMainJailbreak()
		: getActiveAgentJailbreak();
}

export function stripLLMArtifacts(text: string): string {
	let result = text;
	result = result.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*?<\/(?:think|thinking)\s*>/gi, '');
	result = result.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*$/gi, '');
	result = result.replace(/```(?:json)?\s*\n?/gi, '');
	result = result.replace(/```\s*/g, '');
	return result.trim();
}

export async function callAgentLLM(
	systemPrompt: string,
	userContent: string,
	config: AgentLLMConfig,
	options?: string | AgentLLMCallOptions,
): Promise<string> {
	const result = await callAgentLLMWithMetadata(systemPrompt, userContent, config, options);
	return result.text;
}

function normalizeCallOptions(options?: string | AgentLLMCallOptions): AgentLLMCallOptions {
	if (typeof options === 'string') {
		return { jailbreak: options };
	}
	return options ?? {};
}

export async function callAgentLLMWithMetadata(
	systemPrompt: string,
	userContent: string,
	config: AgentLLMConfig,
	options?: string | AgentLLMCallOptions,
): Promise<AgentLLMCallResult> {
	const normalized = normalizeCallOptions(options);
	const provider = getRegistry().getProvider(config.providerId);
	const cacheBreaker = `[ctx:${Date.now().toString(36)}] `;
	let fullSystem = cacheBreaker + systemPrompt;
	const jb = normalized.jailbreak ?? getActiveJailbreak();
	if (jb) {
		fullSystem += '\n\n' + jb;
	}
	const messages: Message[] = [
		{ role: 'system', content: fullSystem, type: 'system', timestamp: 0 },
		{ role: 'user', content: userContent, type: 'dialogue', timestamp: 0 },
	];
	const assistantPrefill = normalized.assistantPrefill?.trim();
	if (assistantPrefill) {
		messages.push({
			role: 'assistant',
			content: assistantPrefill,
			type: 'dialogue',
			timestamp: 0,
		});
	}

	const chatConfig: UserConfig = {
		providerId: config.providerId,
		model: config.model,
		apiKey: config.apiKey,
		baseUrl: config.baseUrl,
		temperature: config.temperature,
		maxTokens: config.maxTokens ?? 32000,
	};

	const metadata: ChatMetadata = {};
	let fullText = '';
  const startedAt = Date.now();

	for await (const token of provider.chat(messages, chatConfig, metadata)) {
		fullText += token;
	}
	return {
    text: stripLLMArtifacts(fullText),
    durationMs: Date.now() - startedAt,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
  };
}
