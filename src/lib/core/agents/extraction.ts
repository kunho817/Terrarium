import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLMWithMetadata } from './agent-llm';
import { getAgentPrefill, PROMPTS } from './prompts';
import type {
	ExtractionSnapshot,
	SessionAgentState,
	CharacterSnapshot,
	ExtractionMemoryCandidate,
	ExtractionMemoryCandidates,
} from './types';
import type { Message } from '$lib/types/message';
import type { MemoryType } from '$lib/types/memory';
import { insertMemory } from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';
import { memorySyncStore } from '$lib/stores/memory-sync';
import { resolveSlotConfig } from '$lib/core/models/slot-resolver';
import type { PipelineSubTaskDiagnostic, StepDiagnostic } from '$lib/types/diagnostics';

function resolveExtractionConfig(chatConfig?: import('$lib/types/config').UserConfig) {
	const settings = get(settingsStore);
  const agentSettings = settings.agentSettings as any;
	const extractionSlot = resolveSlotConfig(settings, ['extraction', 'memory', 'chat'], chatConfig);

	const provider = extractionSlot.provider;
	const apiKey = extractionSlot.apiKey;
	const model = extractionSlot.model;
	const baseUrl = extractionSlot.baseUrl;
	const temperature = extractionSlot.temperature ?? 0.3;
	const maxTokens =
		extractionSlot.maxTokens ?? agentSettings?.extraction?.tokenBudget ?? 32000;
  const repairAttempts = Math.max(0, agentSettings?.extraction?.repairAttempts ?? 1);
  const enabled = agentSettings?.extraction?.enabled ?? true;
  const customPrompt = extractionSlot.slot?.customExtractionPrompt?.trim() || '';

	return { provider, apiKey, model, baseUrl, temperature, maxTokens, repairAttempts, enabled, customPrompt };
}

function tryParseJsonLenient(raw: string): any | null {
	for (const candidate of [raw, raw.replace(/,\s*([}\]])/g, '$1')]) {
		try {
			return JSON.parse(candidate);
		} catch {}
	}
	return null;
}

function extractJsonFromLLMResponse(text: string): string | null {
	let cleaned = text;
	cleaned = cleaned.replace(/```(?:json)?\s*\n?/gi, '');
	cleaned = cleaned.replace(/```\s*/g, '');

	const braceMatch = cleaned.match(/\{[\s\S]*\}/);
	if (braceMatch) return braceMatch[0];

	return null;
}

const MEMORY_TYPES = new Set<MemoryType>([
	'event',
	'trait',
	'relationship',
	'location',
	'state',
	'world_fact',
	'personal_event',
	'general',
]);

function normalizeMemoryContent(content: string): string {
	return content.replace(/\s+/g, ' ').trim();
}

function classifyFactType(fact: string, cardType: 'character' | 'world'): MemoryType {
	const lower = fact.toLowerCase();
	if (cardType === 'world') {
		return 'world_fact';
	}
	if (/\b(friend|enemy|ally|lover|partner|sibling|mother|father|mentor|student|trusts|betrayed|owes)\b/.test(lower)) {
		return 'relationship';
	}
	if (/\b(personality|habit|hobby|likes|dislikes|prefers|always|usually|tends to|shy|brave|kind|calm|stubborn|loyal)\b/.test(lower)) {
		return 'trait';
	}
	if (/\b(city|town|village|forest|castle|room|house|street|district|kingdom|country|located|lives in|at the|inside the)\b/.test(lower)) {
		return 'location';
	}
	if (/\b(rule|law|magic|system|faction|organization|religion|currency|politics|history|legend)\b/.test(lower)) {
		return 'world_fact';
	}
	return 'general';
}

function classifyWorldLogType(entry: string): MemoryType {
	const lower = entry.toLowerCase();
	if (lower.startsWith('active location:')) {
		return 'location';
	}
	if (/\b(rule|rules|magic|system|ward|forbidden|allowed|cannot|can't|suppresses|suppressed|dampens|dampened|prevents|requires)\b/.test(lower)) {
		return 'world_fact';
	}
	if (/\b(city|town|village|forest|castle|room|house|street|district|kingdom|country|chapel|gate|tavern|market)\b/.test(lower)) {
		return 'location';
	}
	if (/\b(state|status|condition|danger|tension|weather|atmosphere|time|locked|safe|unsafe)\b/.test(lower)) {
		return 'state';
	}
	return 'world_fact';
}

function normalizeMemoryType(raw: unknown, fallbackContent: string, cardType: 'character' | 'world'): MemoryType {
	if (typeof raw === 'string' && MEMORY_TYPES.has(raw as MemoryType)) {
		return raw as MemoryType;
	}
	return classifyFactType(fallbackContent, cardType);
}

function dedupeCandidates(candidates: ExtractionMemoryCandidate[]): ExtractionMemoryCandidate[] {
	const seen = new Set<string>();
	return candidates.filter((candidate) => {
		const normalized = normalizeMemoryContent(candidate.content);
		if (!normalized) return false;
		const key = `${candidate.type}:${normalized.toLowerCase()}`;
		if (seen.has(key)) return false;
		seen.add(key);
		candidate.content = normalized;
		return true;
	});
}

function mergeCandidatesPreferProvided(
	provided: ExtractionMemoryCandidate[],
	fallback: ExtractionMemoryCandidate[],
): ExtractionMemoryCandidate[] {
	const seen = new Set(
		provided.map((candidate) => normalizeMemoryContent(candidate.content).toLowerCase()),
	);
	return dedupeCandidates([
		...provided,
		...fallback.filter((candidate) => !seen.has(normalizeMemoryContent(candidate.content).toLowerCase())),
	]);
}

function dedupeStrings(values: string[]): string[] {
	const seen = new Set<string>();
	return values
		.map((value) => normalizeMemoryContent(value))
		.filter((value) => {
			if (!value) return false;
			const key = value.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

function deriveFallbackMemoryCandidates(
	scene: ExtractionSnapshot['scene'],
	characters: Record<string, CharacterSnapshot>,
	events: string[],
	newFacts: string[],
	changed: string[],
	cardType: 'character' | 'world',
	worldRules: string[],
): ExtractionMemoryCandidates {
	const persistent: ExtractionMemoryCandidate[] = newFacts.map((fact) => ({
		content: fact,
		type: classifyFactType(fact, cardType),
	}));

	for (const character of Object.values(characters)) {
		if (character.notes) {
			persistent.push({
				content: `${character.name}: ${character.notes}`,
				type: classifyFactType(character.notes, cardType),
			});
		}
	}

	const turningPoints = [...events, ...changed.map((entry) => `Change: ${entry}`)];
	const worldLog = [
		...worldRules,
		...(scene.location ? [`Active location: ${scene.location}`] : []),
	];

	return {
		persistent: dedupeCandidates(persistent),
		turningPoints: dedupeStrings(turningPoints),
		worldLog: dedupeStrings(worldLog),
	};
}

function parseMemoryCandidates(
	parsed: any,
	cardType: 'character' | 'world',
	scene: ExtractionSnapshot['scene'],
	characters: Record<string, CharacterSnapshot>,
	events: string[],
	newFacts: string[],
	changed: string[],
): ExtractionMemoryCandidates {
	function strArr(val: unknown): string[] {
		return Array.isArray(val) ? val.filter((x: unknown) => typeof x === 'string') : [];
	}

	const providedPersistentRaw = Array.isArray(parsed.memoryCandidates?.persistent)
		? parsed.memoryCandidates.persistent
		: Array.isArray(parsed.persistentCandidates)
			? parsed.persistentCandidates
			: [];

	const providedPersistent = dedupeCandidates(
		providedPersistentRaw
			.map((entry: unknown) => {
				if (typeof entry === 'string') {
					return {
						content: entry,
						type: classifyFactType(entry, cardType),
					};
				}
				if (entry && typeof entry === 'object' && typeof (entry as any).content === 'string') {
					return {
						content: (entry as any).content,
						type: normalizeMemoryType((entry as any).type, (entry as any).content, cardType),
					};
				}
				return null;
			})
			.filter(
				(entry: ExtractionMemoryCandidate | null): entry is ExtractionMemoryCandidate =>
					Boolean(entry),
			),
	);

	const providedTurningPoints = dedupeStrings(
		strArr(parsed.memoryCandidates?.turningPoints ?? parsed.turningPoints),
	);

	const providedWorldLog = dedupeStrings([
		...strArr(parsed.memoryCandidates?.worldLog ?? parsed.worldLog),
		...strArr(parsed.worldRules),
	]);

	const fallback = deriveFallbackMemoryCandidates(
		scene,
		characters,
		events,
		newFacts,
		changed,
		cardType,
		strArr(parsed.worldRules),
	);

	return {
		persistent: mergeCandidatesPreferProvided(providedPersistent, fallback.persistent),
		turningPoints: dedupeStrings([...providedTurningPoints, ...fallback.turningPoints]),
		worldLog: dedupeStrings([...providedWorldLog, ...fallback.worldLog]),
	};
}

export function parseExtractionJson(content: string, cardType: 'character' | 'world' = 'character'): ExtractionSnapshot | null {
	if (typeof content !== 'string') return null;
	const jsonStr = extractJsonFromLLMResponse(content);
	if (!jsonStr) return null;

	const parsed = tryParseJsonLenient(jsonStr);
	if (!parsed || typeof parsed !== 'object') return null;
	if (typeof parsed.scene !== 'object' || parsed.scene === null) return null;
	if (!Array.isArray(parsed.events)) return null;
	if (!Array.isArray(parsed.newFacts)) return null;
	if (!Array.isArray(parsed.changed)) return null;

	function str(val: unknown, fallback = ''): string {
		return typeof val === 'string' ? val : fallback;
	}
	function strArr(val: unknown): string[] {
		return Array.isArray(val) ? val.filter((x: unknown) => typeof x === 'string') : [];
	}

	const characters: Record<string, CharacterSnapshot> = {};
	if (Array.isArray(parsed.characters)) {
		for (const c of parsed.characters) {
			if (c && typeof c.name === 'string' && c.name) {
				characters[c.name] = {
					name: c.name,
					emotion: str(c.emotion),
					location: str(c.location),
					inventory: Array.isArray(c.inventory) ? c.inventory : [],
					health: str(c.health),
					notes: str(c.notes),
				};
			}
		}
	}

	const scene = {
		location: str(parsed.scene.location),
		characters: strArr(parsed.scene.characters),
		atmosphere: str(parsed.scene.atmosphere),
		timeOfDay: str(parsed.scene.timeOfDay),
		environmentalNotes: str(parsed.scene.environmentalNotes),
	};
	const events = strArr(parsed.events);
	const newFacts = strArr(parsed.newFacts);
	const changed = strArr(parsed.changed);
	const memoryCandidates = parseMemoryCandidates(
		parsed,
		cardType,
		scene,
		characters,
		events,
		newFacts,
		changed,
	);

	return {
		turnNumber: 0,
		timestamp: Date.now(),
		scene,
		characters,
		events,
		newFacts,
		changed,
		memoryCandidates,
	};
}

export function buildExtractionUserContent(
	messages: Message[],
	previousExtraction: ExtractionSnapshot | null,
	cardType: 'character' | 'world',
): string {
	const parts: string[] = [];

	parts.push('=== Conversation ===');
	for (const msg of messages.slice(-8)) {
		parts.push(`${msg.role}: ${msg.content.slice(0, 800)}`);
	}

	if (previousExtraction) {
		parts.push('\n=== Previous extraction ===');
		const prev = { ...previousExtraction, characters: undefined };
		parts.push(JSON.stringify(prev).slice(0, 1500));
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
  onDiagnostic?: (patch: Partial<StepDiagnostic>) => void,
): Promise<ExtractionSnapshot | null> {
	const config = resolveExtractionConfig(chatConfig);
	if (!config.enabled) {
		return null;
	}
	if (!config.provider || !config.apiKey || !config.model) {
		console.warn('[Extraction] No model configured for extraction');
		return null;
	}

	const systemPrompt =
		config.customPrompt ||
		(cardType === 'world'
			? PROMPTS.get('EXTRACTION_WORLD_SYSTEM')
			: PROMPTS.get('EXTRACTION_SYSTEM'));
	const userContent = buildExtractionUserContent(
		messages,
		state.lastExtraction,
		cardType,
	);
  const subTasks: PipelineSubTaskDiagnostic[] = [];

	let rawContent: string;
	try {
		const callResult = await callAgentLLMWithMetadata(systemPrompt, userContent, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: config.maxTokens,
		}, {
      assistantPrefill: getAgentPrefill('extraction'),
    });
    rawContent = callResult.text;
    subTasks.push({
      id: 'extraction-primary',
      label: 'Extraction',
      status: 'done',
      startedAt: Date.now() - callResult.durationMs,
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: rawContent.length,
      inputTokens: callResult.inputTokens ?? null,
      outputTokens: callResult.outputTokens ?? null,
      result: rawContent,
      error: null,
    });
	} catch (err) {
		console.warn('[Extraction] LLM call failed, attempting fallback:', err);
    subTasks.push({
      id: 'extraction-primary',
      label: 'Extraction',
      status: 'failed',
      startedAt: Date.now(),
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: 0,
      inputTokens: null,
      outputTokens: null,
      result: '',
      error: err instanceof Error ? err.message : String(err),
    });

		try {
			const fallbackSystem = PROMPTS.get('EXTRACTION_FALLBACK_SYSTEM');
			const fallbackResult = await callAgentLLMWithMetadata(fallbackSystem, userContent, {
				providerId: config.provider,
				apiKey: config.apiKey,
				model: config.model,
				baseUrl: config.baseUrl,
				temperature: config.temperature,
				maxTokens: Math.min(config.maxTokens, 8000),
			}, {
        assistantPrefill: getAgentPrefill('extractionFallback'),
      });
      rawContent = fallbackResult.text;
      subTasks.push({
        id: 'extraction-fallback',
        label: 'Extraction Fallback',
        status: 'done',
        startedAt: Date.now() - fallbackResult.durationMs,
        finishedAt: Date.now(),
        providerId: config.provider,
        model: config.model,
        temperature: config.temperature,
        maxTokens: Math.min(config.maxTokens, 8000),
        inputChars: userContent.length,
        outputChars: rawContent.length,
        inputTokens: fallbackResult.inputTokens ?? null,
        outputTokens: fallbackResult.outputTokens ?? null,
        result: rawContent,
        error: null,
      });
		} catch (fallbackErr) {
      onDiagnostic?.({
        providerId: config.provider ?? null,
        model: config.model ?? null,
        temperature: config.temperature ?? null,
        maxTokens: config.maxTokens ?? null,
        resultPreview: '',
        resultFull: '',
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        subTasks: [
          ...subTasks,
          {
            id: 'extraction-fallback',
            label: 'Extraction Fallback',
            status: 'failed',
            startedAt: Date.now(),
            finishedAt: Date.now(),
            providerId: config.provider,
            model: config.model,
            temperature: config.temperature,
            maxTokens: Math.min(config.maxTokens, 8000),
            inputChars: userContent.length,
            outputChars: 0,
            inputTokens: null,
            outputTokens: null,
            result: '',
            error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
          },
        ],
      });
			console.warn(
				'[Extraction] Fallback LLM call also failed:',
				fallbackErr,
			);
			return null;
		}
	}

	if (!rawContent.trim()) {
		console.warn('[Extraction] LLM returned empty response');
		return null;
	}
	console.log('[Extraction] raw response length:', rawContent.length, 'first 500:', rawContent.slice(0, 500));
	let extraction = parseExtractionJson(rawContent, cardType);

	if (!extraction) {
		console.warn('[Extraction] JSON parse failed, raw was:', rawContent.slice(0, 1000));
		for (let attempt = 0; attempt < config.repairAttempts && !extraction; attempt++) {
			try {
				const repairPrompt = PROMPTS.get('EXTRACTION_REPAIR_SYSTEM');
				const repairedResult = await callAgentLLMWithMetadata(repairPrompt, rawContent, {
					providerId: config.provider,
					apiKey: config.apiKey,
					model: config.model,
					baseUrl: config.baseUrl,
					temperature: 0.1,
					maxTokens: 8000,
				}, {
          assistantPrefill: getAgentPrefill('extractionRepair'),
        });
				const repairedContent = repairedResult.text;
        subTasks.push({
          id: `extraction-repair-${attempt + 1}`,
          label: `Extraction Repair ${attempt + 1}`,
          status: 'done',
          startedAt: Date.now() - repairedResult.durationMs,
          finishedAt: Date.now(),
          providerId: config.provider,
          model: config.model,
          temperature: 0.1,
          maxTokens: 8000,
          inputChars: rawContent.length,
          outputChars: repairedContent.length,
          inputTokens: repairedResult.inputTokens ?? null,
          outputTokens: repairedResult.outputTokens ?? null,
          result: repairedContent,
          error: null,
        });
				extraction = parseExtractionJson(repairedContent, cardType);
			} catch (repairErr) {
        subTasks.push({
          id: `extraction-repair-${attempt + 1}`,
          label: `Extraction Repair ${attempt + 1}`,
          status: 'failed',
          startedAt: Date.now(),
          finishedAt: Date.now(),
          providerId: config.provider,
          model: config.model,
          temperature: 0.1,
          maxTokens: 8000,
          inputChars: rawContent.length,
          outputChars: 0,
          inputTokens: null,
          outputTokens: null,
          result: '',
          error: repairErr instanceof Error ? repairErr.message : String(repairErr),
        });
				console.warn('[Extraction] Repair call failed:', repairErr);
			}
		}
	}

	if (!extraction) {
		console.warn('[Extraction] All extraction attempts failed');
    onDiagnostic?.({
      providerId: config.provider ?? null,
      model: config.model ?? null,
      temperature: config.temperature ?? null,
      maxTokens: config.maxTokens ?? null,
      resultPreview: '',
      resultFull: '',
      error: 'Extraction returned no usable result',
      subTasks,
    });
		return null;
	}

	extraction.turnNumber = state.narrativeState.turnNumber + 1;
	extraction.timestamp = Date.now();

	await storeExtractedMemories(extraction, state);
  onDiagnostic?.({
    providerId: config.provider ?? null,
    model: config.model ?? null,
    temperature: config.temperature ?? null,
    maxTokens: config.maxTokens ?? null,
    outputChars: JSON.stringify(extraction).length,
    resultPreview: `Scene: ${extraction.scene.location} | Events: ${extraction.events.slice(0, 3).join(', ')}`,
    resultFull: JSON.stringify(extraction, null, 2),
    error: null,
    subTasks,
  });

	return extraction;
}

function importanceForMemoryType(type: MemoryType): number {
	switch (type) {
		case 'relationship':
		case 'world_fact':
		case 'location':
			return 0.85;
		case 'event':
		case 'personal_event':
			return 0.8;
		case 'trait':
		case 'state':
			return 0.7;
		default:
			return 0.6;
	}
}

function buildCharacterStateMemory(character: CharacterSnapshot): string | null {
	const details: string[] = [];
	if (character.emotion) details.push(`emotion: ${character.emotion}`);
	if (character.location) details.push(`location: ${character.location}`);
	if (character.health) details.push(`health: ${character.health}`);
	if (character.inventory.length > 0) details.push(`inventory: ${character.inventory.join(', ')}`);
	if (character.notes) details.push(`notes: ${character.notes}`);
	if (details.length === 0) return null;
	return `${character.name} state - ${details.join('; ')}`;
}

function buildMemoriesFromExtraction(
	extraction: ExtractionSnapshot,
): Array<{ content: string; type: MemoryType; importance: number }> {
	const collected: Array<{ content: string; type: MemoryType; importance: number }> = [];

	if (extraction.scene.location) {
		collected.push({
			content: `Current scene location: ${extraction.scene.location}`,
			type: 'location',
			importance: 0.8,
		});
	}

	const sceneDetails: string[] = [];
	if (extraction.scene.atmosphere) sceneDetails.push(`atmosphere: ${extraction.scene.atmosphere}`);
	if (extraction.scene.timeOfDay) sceneDetails.push(`time: ${extraction.scene.timeOfDay}`);
	if (extraction.scene.environmentalNotes) sceneDetails.push(`environment: ${extraction.scene.environmentalNotes}`);
	if (sceneDetails.length > 0) {
		collected.push({
			content: `Scene state - ${sceneDetails.join('; ')}`,
			type: 'state',
			importance: 0.65,
		});
	}

	for (const candidate of extraction.memoryCandidates?.persistent ?? []) {
		collected.push({
			content: candidate.content,
			type: candidate.type,
			importance: Math.min(0.95, importanceForMemoryType(candidate.type) + 0.08),
		});
	}

	for (const entry of extraction.memoryCandidates?.turningPoints ?? []) {
		const type: MemoryType = /\b(you|your)\b/i.test(entry) ? 'personal_event' : 'event';
		collected.push({
			content: entry,
			type,
			importance: 0.92,
		});
	}

	for (const entry of extraction.memoryCandidates?.worldLog ?? []) {
		const type = classifyWorldLogType(entry);
		collected.push({
			content: entry,
			type,
			importance: type === 'world_fact' ? 0.9 : 0.82,
		});
	}

	for (const character of Object.values(extraction.characters)) {
		const memory = buildCharacterStateMemory(character);
		if (memory) {
			collected.push({
				content: memory,
				type: 'state',
				importance: 0.7,
			});
		}
	}

	const seen = new Set<string>();
	return collected
		.map((memory) => ({
			...memory,
			content: normalizeMemoryContent(memory.content),
		}))
		.filter((memory) => {
			if (!memory.content) return false;
			const key = `${memory.type}:${memory.content.toLowerCase()}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

async function storeExtractedMemories(
	extraction: ExtractionSnapshot,
	state: SessionAgentState,
): Promise<void> {
	const settings = get(settingsStore);
	const memSettings = settings.memorySettings;
	const hasEmbedding = Boolean(
		memSettings?.embeddingProvider && memSettings?.embeddingApiKey,
	);

	const factsToStore = buildMemoriesFromExtraction(extraction);

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
				importance: fact.importance,
				sourceMessageIds: [],
				turnNumber: extraction.turnNumber,
				createdAt: Date.now(),
				embedding,
			});
		} catch (err) {
			console.warn('[Extraction] Failed to store memory:', fact.content, err);
		}
	}

	if (factsToStore.length > 0) {
		memorySyncStore.bump();
	}
}
