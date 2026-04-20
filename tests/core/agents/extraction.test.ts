import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	runExtraction,
	parseExtractionJson,
	buildExtractionUserContent,
} from '$lib/core/agents/extraction';
import type { ExtractionSnapshot, SessionAgentState } from '$lib/core/agents/types';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/agents/agent-llm', () => ({
	callAgentLLM: vi.fn(),
}));

vi.mock('$lib/stores/settings', () => ({
	settingsStore: {
		subscribe: vi.fn((fn) => {
			fn({
				defaultProvider: 'test-provider',
				providers: {
					'test-provider': { apiKey: 'test-key', model: 'test-model' },
				},
				modelSlots: {},
				agentSettings: { enabled: true, extraction: { enabled: true } },
				memorySettings: {},
			});
			return vi.fn();
		}),
		set: vi.fn(),
		update: vi.fn(),
	},
}));

vi.mock('$lib/core/bootstrap', () => ({
	getRegistry: vi.fn(),
}));

vi.mock('$lib/storage/session-agent-state', () => ({
	loadSessionState: vi.fn(),
	saveSessionState: vi.fn(),
}));

vi.mock('$lib/storage/memories', () => ({
	insertMemory: vi.fn(),
	getMemoriesForSession: vi.fn(() => []),
}));

vi.mock('$lib/core/embedding', () => ({
	getEmbedding: vi.fn(() => Promise.resolve(new Array(128).fill(0.1))),
}));

function makeMessages(): Message[] {
	return [
		{
			role: 'user',
			content: 'Alice walks into the tavern.',
			type: 'dialogue',
			timestamp: 1,
		},
		{
			role: 'assistant',
			content:
				'*The door creaks as Alice steps inside. Rain drips from her cloak.*',
			type: 'dialogue',
			timestamp: 2,
		},
	];
}

function makeState(): SessionAgentState {
	return {
		sessionId: 'test-session',
		lastExtraction: null,
		lastTurnMaintenance: null,
		entities: {},
		relations: [],
		worldFacts: [],
		turnHistory: [],
		narrativeState: {
			currentArc: '',
			activeTensions: [],
			recentDecisions: [],
			nextBeats: [],
			turnNumber: 0,
		},
	};
}

describe('parseExtractionJson', () => {
	it('parses valid extraction JSON', () => {
		const json = JSON.stringify({
			scene: {
				location: 'Tavern',
				characters: ['Alice'],
				atmosphere: 'tense',
				timeOfDay: 'evening',
				environmentalNotes: '',
			},
			characters: [
				{
					name: 'Alice',
					emotion: 'nervous',
					location: 'bar',
					inventory: [],
					health: 'healthy',
					notes: '',
				},
			],
			events: ['Alice entered the tavern'],
			newFacts: ['Alice is searching for someone'],
			changed: [],
		});
		const result = parseExtractionJson(json);
		expect(result).not.toBeNull();
		expect(result!.scene.location).toBe('Tavern');
		expect(result!.events).toEqual(['Alice entered the tavern']);
	});

	it('extracts JSON from surrounding text', () => {
		const text =
			'Here is the extraction:\n{"scene":{"location":"Forest","characters":[],"atmosphere":"","timeOfDay":"","environmentalNotes":""},"characters":[],"events":["test"],"newFacts":[],"changed":[]}\nEnd.';
		const result = parseExtractionJson(text);
		expect(result).not.toBeNull();
		expect(result!.scene.location).toBe('Forest');
	});

	it('returns null for invalid JSON', () => {
		expect(parseExtractionJson('not json at all')).toBeNull();
	});

	it('returns null for JSON without required fields', () => {
		expect(parseExtractionJson('{"some": "thing"}')).toBeNull();
	});

	it('handles empty arrays gracefully', () => {
		const json =
			'{"scene":{"location":"","characters":[],"atmosphere":"","timeOfDay":"","environmentalNotes":""},"characters":[],"events":[],"newFacts":[],"changed":[]}';
		const result = parseExtractionJson(json);
		expect(result).not.toBeNull();
		expect(result!.events).toEqual([]);
	});
});

describe('buildExtractionUserContent', () => {
	it('includes conversation text', () => {
		const content = buildExtractionUserContent(makeMessages(), null, 'character');
		expect(content).toContain('Alice walks into the tavern');
	});

	it('includes previous extraction when provided', () => {
		const previous: ExtractionSnapshot = {
			turnNumber: 0,
			timestamp: 0,
			scene: {
				location: 'Forest',
				characters: [],
				atmosphere: '',
				timeOfDay: '',
				environmentalNotes: '',
			},
			characters: {},
			events: [],
			newFacts: [],
			changed: [],
		};
		const content = buildExtractionUserContent(makeMessages(), previous, 'character');
		expect(content).toContain('Forest');
		expect(content).toContain('Previous extraction');
	});

	it('does not include previous extraction when null', () => {
		const content = buildExtractionUserContent(makeMessages(), null, 'character');
		expect(content).not.toContain('Previous extraction');
	});
});

describe('runExtraction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns extraction snapshot on successful call', async () => {
		const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
		const mocked = vi.mocked(callAgentLLM);
		mocked.mockResolvedValueOnce(
			JSON.stringify({
				scene: {
					location: 'Tavern',
					characters: ['Alice'],
					atmosphere: 'tense',
					timeOfDay: 'evening',
					environmentalNotes: 'rain',
				},
				characters: [
					{
						name: 'Alice',
						emotion: 'nervous',
						location: 'bar',
						inventory: [],
						health: 'healthy',
						notes: '',
					},
				],
				events: ['Alice entered the tavern'],
				newFacts: ['Alice is wet from the rain'],
				changed: [],
			}),
		);

		const result = await runExtraction(makeMessages(), makeState(), 'character');
		expect(result).not.toBeNull();
		expect(result!.scene.location).toBe('Tavern');
		expect(result!.events).toContain('Alice entered the tavern');
	});

	it('returns null when LLM call fails', async () => {
		const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
		const mocked = vi.mocked(callAgentLLM);
		mocked.mockRejectedValueOnce(new Error('LLM failed'));
		mocked.mockRejectedValueOnce(new Error('Fallback also failed'));

		const result = await runExtraction(makeMessages(), makeState(), 'character');
		expect(result).toBeNull();
	});

	it('returns null when JSON parse fails and repair fails', async () => {
		const { callAgentLLM } = await import('$lib/core/agents/agent-llm');
		const mocked = vi.mocked(callAgentLLM);
		mocked.mockResolvedValueOnce('not valid json with no braces');
		mocked.mockRejectedValueOnce(new Error('repair failed'));

		const result = await runExtraction(makeMessages(), makeState(), 'character');
		expect(result).toBeNull();
	});
});
