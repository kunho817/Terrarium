import type { Message } from '$lib/types/message';
import type { UserConfig } from '$lib/types/config';
import type { ChatMetadata } from '$lib/types/plugin';
import { getRegistry } from '$lib/core/bootstrap';

export interface AgentLLMConfig {
	providerId: string;
	apiKey: string;
	model: string;
	baseUrl?: string;
	temperature?: number;
	maxTokens?: number;
}

export async function callAgentLLM(
	systemPrompt: string,
	userContent: string,
	config: AgentLLMConfig,
	timeout = 30000,
): Promise<string> {
	const provider = getRegistry().getProvider(config.providerId);
	const messages: Message[] = [
		{ role: 'system', content: systemPrompt, type: 'system', timestamp: 0 },
		{ role: 'user', content: userContent, type: 'dialogue', timestamp: 0 },
	];

	const chatConfig: UserConfig = {
		providerId: config.providerId,
		model: config.model,
		apiKey: config.apiKey,
		baseUrl: config.baseUrl,
		temperature: config.temperature,
		maxTokens: config.maxTokens ?? 1024,
	};

	const metadata: ChatMetadata = {};
	let fullText = '';

	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), timeout);

	try {
		for await (const token of provider.chat(messages, chatConfig, metadata)) {
			fullText += token;
		}
		clearTimeout(timeoutId);
		return fullText;
	} catch (error) {
		clearTimeout(timeoutId);
		throw error;
	}
}
