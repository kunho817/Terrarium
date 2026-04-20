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
	let timedOut = false;

	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		setTimeout(() => {
			timedOut = true;
			reject(new Error(`Agent LLM call timed out after ${timeout}ms`));
		}, timeout);
	});

	async function runChat(): Promise<string> {
		for await (const token of provider.chat(messages, chatConfig, metadata)) {
			if (timedOut) break;
			fullText += token;
		}
		return fullText;
	}

	return Promise.race([runChat(), timeoutPromise]);
}
