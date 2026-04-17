import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { getEmbedding } from '$lib/core/embedding';
import { findSimilarMemories, insertMemory, deleteMemory, getMemoriesForSession } from '$lib/storage/memories';
import { MEMORY_WRITE_MODES, DEFAULT_EXTRACTION_PROMPT } from '$lib/types/memory';
import { callAgentLLM } from './agent-llm';
import type { MemoryRecord, MemoryType, ExtractionResult } from '$lib/types/memory';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';

function parseExtractionResult(content: string): ExtractionResult | null {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		const parsed = JSON.parse(match[0]);
		if (!parsed.facts || !Array.isArray(parsed.facts)) return null;
		for (const fact of parsed.facts) {
			if (typeof fact.content !== 'string' || typeof fact.type !== 'string' || typeof fact.importance !== 'number') {
				return null;
			}
		}
		return parsed as ExtractionResult;
	} catch {
		return null;
	}
}

function jaccardSimilarity(a: string, b: string): number {
	const wordsA = new Set(a.toLowerCase().split(/\s+/));
	const wordsB = new Set(b.toLowerCase().split(/\s+/));
	const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
	const union = new Set([...wordsA, ...wordsB]);
	if (union.size === 0) return 0;
	return intersection.size / union.size;
}

function getModelConfig() {
	const settings = get(settingsStore);
	const memorySlot = settings.modelSlots?.memory;
	if (memorySlot?.provider && memorySlot?.apiKey && memorySlot?.model) {
		return {
			provider: memorySlot.provider,
			apiKey: memorySlot.apiKey,
			model: memorySlot.model,
			baseUrl: memorySlot.baseUrl,
			temperature: memorySlot.temperature ?? 0.3,
			customExtractionPrompt: memorySlot.customExtractionPrompt,
		};
	}
	return {
		provider: settings.defaultProvider || '',
		apiKey: (settings.providers?.[settings.defaultProvider]?.apiKey as string) || '',
		model: (settings.providers?.[settings.defaultProvider]?.model as string) || '',
		baseUrl: (settings.providers?.[settings.defaultProvider]?.baseUrl as string) || '',
		temperature: 0.3,
	};
}

async function callExtractionModel(conversation: string, prompt: string): Promise<string> {
	const config = getModelConfig();
	if (!config.provider || !config.apiKey || !config.model) {
		throw new Error('No model configured for memory extraction');
	}

	return callAgentLLM(prompt, conversation, {
		providerId: config.provider,
		apiKey: config.apiKey,
		model: config.model,
		baseUrl: config.baseUrl,
		temperature: config.temperature,
		maxTokens: 2048,
	});
}

export class MemoryAgent implements Agent {
	readonly id = 'memory';
	readonly name = 'Memory Agent';
	readonly priority = 10;
	private lastExtractionTurn = -Infinity;

	async init(_ctx: AgentContext): Promise<void> {
		this.lastExtractionTurn = -Infinity;
	}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const settings = get(settingsStore);
		const memSettings = settings.memorySettings;
		if (!memSettings?.embeddingProvider || !memSettings?.embeddingApiKey) {
			return {};
		}

		const recentMessages = ctx.messages.slice(-4);
		const queryText = recentMessages.map((m) => m.content).join(' ');
		if (!queryText.trim()) return {};

		try {
			const queryEmbedding = await getEmbedding(queryText, {
				provider: memSettings.embeddingProvider as 'voyage' | 'openai-compatible',
				apiKey: memSettings.embeddingApiKey,
				model: memSettings.embeddingModel,
			});

			const topK = memSettings.topK ?? 15;
			const results = await findSimilarMemories(ctx.sessionId, queryEmbedding, topK, ctx.turnNumber);

			if (!results.length) return {};

			const tokenBudget = memSettings.tokenBudget ?? 4096;
			const lines: string[] = ['[Memory]'];
			let estimatedTokens = 0;

			for (const memory of results) {
				const line = `- ${memory.content} (${memory.type})`;
				const lineTokens = Math.ceil(line.length / 4);
				if (estimatedTokens + lineTokens > tokenBudget) break;
				lines.push(line);
				estimatedTokens += lineTokens;
			}

			if (lines.length === 1) return {};

			return { injectPrompt: lines.join('\n') };
		} catch {
			return {};
		}
	}

	async onAfterReceive(ctx: AgentContext, _response: string): Promise<AgentResult> {
		const settings = get(settingsStore);
		const memSettings = settings.memorySettings;
		if (!memSettings?.embeddingProvider || !memSettings?.embeddingApiKey) {
			return {};
		}

		const batchSize = memSettings.extractionBatchSize ?? 5;
		if (ctx.turnNumber - this.lastExtractionTurn < batchSize) {
			return {};
		}

		this.lastExtractionTurn = ctx.turnNumber;

		const messageWindow = ctx.messages.slice(-(batchSize * 2));
		if (!messageWindow.length) return {};

		const conversationText = messageWindow
			.map((m) => `${m.role}: ${m.content}`)
			.join('\n');

		const config = getModelConfig();
		const extractionPrompt = config.customExtractionPrompt || DEFAULT_EXTRACTION_PROMPT;

		let content: string;
		try {
			content = await callExtractionModel(conversationText, extractionPrompt);
		} catch {
			return {};
		}

		const result = parseExtractionResult(content);
		if (!result?.facts?.length) return {};

		const memories: MemoryRecord[] = [];

		for (const fact of result.facts) {
			try {
				const embedding = await getEmbedding(fact.content, {
					provider: memSettings.embeddingProvider as 'voyage' | 'openai-compatible',
					apiKey: memSettings.embeddingApiKey,
					model: memSettings.embeddingModel,
				});

				const writeMode = MEMORY_WRITE_MODES[fact.type as MemoryType];
				if (writeMode === 'overwrite') {
					const existing = await getMemoriesForSession(ctx.sessionId);
					for (const existingMem of existing) {
						if (existingMem.type === fact.type && jaccardSimilarity(existingMem.content, fact.content) > 0.7) {
							await deleteMemory(existingMem.id);
						}
					}
				}

				const memory: MemoryRecord = {
					id: crypto.randomUUID(),
					sessionId: ctx.sessionId,
					type: fact.type as MemoryType,
					content: fact.content,
					importance: fact.importance,
					sourceMessageIds: messageWindow.map((m) => (m as any).id).filter(Boolean),
					turnNumber: ctx.turnNumber,
					createdAt: Date.now(),
					embedding,
				};

				await insertMemory(memory);
				memories.push(memory);
			} catch {
				continue;
			}
		}

		return memories.length ? { updatedMemories: memories } : {};
	}

	async shutdown(): Promise<void> {
		this.lastExtractionTurn = -Infinity;
	}
}
