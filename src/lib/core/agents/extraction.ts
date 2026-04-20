import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLM } from './agent-llm';
import { PROMPTS } from './prompts';
import type { ExtractionSnapshot, SessionAgentState, CharacterSnapshot } from './types';
import type { Message } from '$lib/types/message';
import type { MemoryType } from '$lib/types/memory';
import { insertMemory } from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';

function resolveExtractionConfig(chatConfig?: import('$lib/types/config').UserConfig) {
	const settings = get(settingsStore);
	const memorySlot = settings.modelSlots?.memory;
	const chatSlot = settings.modelSlots?.chat;

	const provider =
		memorySlot?.provider ||
		chatSlot?.provider ||
		chatConfig?.providerId ||
		settings.defaultProvider;
	const apiKey =
		memorySlot?.apiKey ||
		chatSlot?.apiKey ||
		chatConfig?.apiKey ||
		(settings.providers?.[settings.defaultProvider!]?.apiKey as string);
	const model =
		memorySlot?.model ||
		chatSlot?.model ||
		chatConfig?.model ||
		(settings.providers?.[settings.defaultProvider!]?.model as string);
	const baseUrl = memorySlot?.baseUrl || chatSlot?.baseUrl || chatConfig?.baseUrl;
	const temperature = memorySlot?.temperature ?? chatSlot?.temperature ?? 0.3;
	const maxTokens =
		(settings.agentSettings as any)?.extraction?.tokenBudget ?? 1024;

	return { provider, apiKey, model, baseUrl, temperature, maxTokens };
}

export function parseExtractionJson(content: string): ExtractionSnapshot | null {
	if (typeof content !== 'string') return null;
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		const parsed = JSON.parse(match[0]);
		if (typeof parsed.scene !== 'object' || parsed.scene === null) return null;
		if (!Array.isArray(parsed.events)) return null;
		if (!Array.isArray(parsed.newFacts)) return null;
		if (!Array.isArray(parsed.changed)) return null;

		const characters: Record<string, CharacterSnapshot> = {};
		if (Array.isArray(parsed.characters)) {
			for (const c of parsed.characters) {
				if (c && typeof c.name === 'string' && c.name) {
					characters[c.name] = {
						name: c.name,
						emotion: typeof c.emotion === 'string' ? c.emotion : '',
						location: typeof c.location === 'string' ? c.location : '',
						inventory: Array.isArray(c.inventory) ? c.inventory : [],
						health: typeof c.health === 'string' ? c.health : '',
						notes: typeof c.notes === 'string' ? c.notes : '',
					};
				}
			}
		}

		return {
			turnNumber: 0,
			timestamp: Date.now(),
			scene: {
				location:
					typeof parsed.scene.location === 'string'
						? parsed.scene.location
						: '',
				characters: Array.isArray(parsed.scene.characters)
					? parsed.scene.characters
					: [],
				atmosphere:
					typeof parsed.scene.atmosphere === 'string'
						? parsed.scene.atmosphere
						: '',
				timeOfDay:
					typeof parsed.scene.timeOfDay === 'string'
						? parsed.scene.timeOfDay
						: '',
				environmentalNotes:
					typeof parsed.scene.environmentalNotes === 'string'
						? parsed.scene.environmentalNotes
						: '',
			},
			characters,
			events: parsed.events.filter((e: unknown) => typeof e === 'string'),
			newFacts: parsed.newFacts.filter((f: unknown) => typeof f === 'string'),
			changed: parsed.changed.filter((c: unknown) => typeof c === 'string'),
		};
	} catch {
		return null;
	}
}

export function buildExtractionUserContent(
	messages: Message[],
	previousExtraction: ExtractionSnapshot | null,
	cardType: 'character' | 'world',
): string {
	const parts: string[] = [];

	parts.push('=== Conversation ===');
	for (const msg of messages.slice(-8)) {
		parts.push(`${msg.role}: ${msg.content}`);
	}

	if (previousExtraction) {
		parts.push('\n=== Previous extraction ===');
		parts.push(JSON.stringify(previousExtraction, null, 2));
	}

	if (cardType === 'world') {
		parts.push(
			'\nNote: This is a world simulation. Extract entities, relations, and world rules in addition to the standard fields.',
		);
	}

	return parts.join('\n');
}

export async function runExtraction(
	messages: Message[],
	state: SessionAgentState,
	cardType: 'character' | 'world',
	chatConfig?: import('$lib/types/config').UserConfig,
): Promise<ExtractionSnapshot | null> {
	const config = resolveExtractionConfig(chatConfig);
	if (!config.provider || !config.apiKey || !config.model) {
		console.warn('[Extraction] No model configured for extraction');
		return null;
	}

	const systemPrompt =
		cardType === 'world'
			? PROMPTS.get('EXTRACTION_WORLD_SYSTEM')
			: PROMPTS.get('EXTRACTION_SYSTEM');
	const userContent = buildExtractionUserContent(
		messages,
		state.lastExtraction,
		cardType,
	);

	let rawContent: string;
	try {
		rawContent = await callAgentLLM(systemPrompt, userContent, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: config.maxTokens,
		});
	} catch (err) {
		console.warn('[Extraction] LLM call failed, attempting fallback:', err);

		try {
			const fallbackSystem = PROMPTS.get('EXTRACTION_FALLBACK_SYSTEM');
			rawContent = await callAgentLLM(fallbackSystem, userContent, {
				providerId: config.provider,
				apiKey: config.apiKey,
				model: config.model,
				baseUrl: config.baseUrl,
				temperature: config.temperature,
				maxTokens: Math.min(config.maxTokens, 512),
			});
		} catch (fallbackErr) {
			console.warn(
				'[Extraction] Fallback LLM call also failed:',
				fallbackErr,
			);
			return null;
		}
	}

	let extraction = parseExtractionJson(rawContent);

	if (!extraction) {
		console.warn('[Extraction] JSON parse failed, attempting repair');
		try {
			const repairPrompt = PROMPTS.get('EXTRACTION_REPAIR_SYSTEM');
			const repairedContent = await callAgentLLM(repairPrompt, rawContent, {
				providerId: config.provider,
				apiKey: config.apiKey,
				model: config.model,
				baseUrl: config.baseUrl,
				temperature: 0.1,
				maxTokens: 1024,
			});
			extraction = parseExtractionJson(repairedContent);
		} catch (repairErr) {
			console.warn('[Extraction] Repair call failed:', repairErr);
		}
	}

	if (!extraction) {
		console.warn('[Extraction] All extraction attempts failed');
		return null;
	}

	extraction.turnNumber = state.narrativeState.turnNumber + 1;
	extraction.timestamp = Date.now();

	await storeExtractedMemories(extraction, state, chatConfig);

	return extraction;
}

async function storeExtractedMemories(
	extraction: ExtractionSnapshot,
	state: SessionAgentState,
	chatConfig?: import('$lib/types/config').UserConfig,
): Promise<void> {
	const settings = get(settingsStore);
	const memSettings = settings.memorySettings;
	const hasEmbedding = Boolean(
		memSettings?.embeddingProvider && memSettings?.embeddingApiKey,
	);

	const factsToStore = [
		...extraction.newFacts.map((f) => ({ content: f, type: 'general' as MemoryType })),
		...extraction.events.map((e) => ({ content: e, type: 'event' as MemoryType })),
	];

	for (const fact of factsToStore) {
		try {
			let embedding: number[];
			if (hasEmbedding) {
				embedding = await getEmbedding(fact.content, {
					provider: memSettings!.embeddingProvider as
						| 'voyage'
						| 'openai-compatible',
					apiKey: memSettings!.embeddingApiKey,
					model: memSettings!.embeddingModel,
				});
			} else {
				embedding = [];
			}

			await insertMemory({
				id: crypto.randomUUID(),
				sessionId: state.sessionId as any,
				type: fact.type,
				content: fact.content,
				importance: 0.5,
				sourceMessageIds: [],
				turnNumber: extraction.turnNumber,
				createdAt: Date.now(),
				embedding,
			});
		} catch (err) {
			console.warn('[Extraction] Failed to store memory:', fact.content, err);
		}
	}
}
