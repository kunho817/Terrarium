import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryAgent } from '$lib/core/agents/memory-agent';
import type { AgentContext } from '$lib/types/agent';
import type { Message } from '$lib/types/message';

vi.mock('$lib/core/embedding', () => ({
	getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const insertedMemories: any[] = [];
const deletedIds: string[] = [];

vi.mock('$lib/storage/memories', () => ({
	findSimilarMemories: vi.fn().mockResolvedValue([]),
	insertMemory: vi.fn().mockImplementation((m: any) => {
		insertedMemories.push(m);
	}),
	deleteMemory: vi.fn().mockImplementation((id: string) => {
		deletedIds.push(id);
	}),
	getMemoriesForSession: vi.fn().mockResolvedValue([]),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('$lib/stores/settings', () => {
	const store = {
		subscribe: vi.fn((cb: any) => {
			cb({
				defaultProvider: 'test',
				providers: {
					test: { apiKey: 'test-key', model: 'test-model', baseUrl: 'https://api.test.com/v1' },
				},
				memorySettings: {
					embeddingProvider: 'openai-compatible',
					embeddingApiKey: 'emb-key',
					embeddingModel: 'emb_model',
					extractionBatchSize: 2,
					tokenBudget: 4096,
					topK: 15,
				},
				modelSlots: {
					memory: {
						provider: 'openai',
						apiKey: 'mem_key',
						model: 'mem_model',
						baseUrl: 'https://mem.test.com/v1',
						temperature: 0.3,
					},
				},
			});
			return () => {};
		}),
	};
	return { settingsStore: store };
});

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
	return {
		sessionId: 'test-session',
		cardId: 'test-card',
		cardType: 'character',
		messages: [],
		turnNumber: 1,
		config: { providerId: 'test' },
		...overrides,
	};
}

function makeMessage(role: 'user' | 'assistant' | 'system' | 'narrator', content: string): Message {
	return {
		role,
		content,
		type: role === 'system' ? 'system' : 'dialogue',
		timestamp: Date.now(),
	};
}

describe('MemoryAgent', () => {
	let agent: MemoryAgent;

	beforeEach(() => {
		vi.clearAllMocks();
		insertedMemories.length = 0;
		deletedIds.length = 0;
		agent = new MemoryAgent();
	});

	it('has correct id and name', () => {
		expect(agent.id).toBe('memory');
		expect(agent.name).toBe('Memory Agent');
	});

	it('returns empty when no similar memories found', async () => {
		const ctx = makeContext({
			messages: [makeMessage('user', 'hello')],
			turnNumber: 1,
		});
		const result = await agent.onBeforeSend(ctx);
		expect(result.injectPrompt).toBeUndefined();
	});

	it('returns formatted inject when memories exist', async () => {
		const { findSimilarMemories } = await import('$lib/storage/memories');
		(findSimilarMemories as any).mockResolvedValueOnce([
			{ content: 'User likes cats', type: 'trait', score: 0.9 },
			{ content: 'User met Bob', type: 'event', score: 0.8 },
		]);

		const ctx = makeContext({
			messages: [makeMessage('user', 'I love cats')],
			turnNumber: 1,
		});
		const result = await agent.onBeforeSend(ctx);
		expect(result.injectPrompt).toContain('[Memory]');
		expect(result.injectPrompt).toContain('User likes cats');
		expect(result.injectPrompt).toContain('User met Bob');
	});

	it('returns empty when embedding not configured', async () => {
		vi.doMock('$lib/stores/settings', () => {
			const store = {
				subscribe: vi.fn((cb: any) => {
					cb({
						defaultProvider: 'test',
						providers: {},
						memorySettings: {
							embeddingProvider: '',
							embeddingApiKey: '',
							embeddingModel: '',
							extractionBatchSize: 2,
							tokenBudget: 4096,
							topK: 15,
						},
						modelSlots: {},
					});
					return () => {};
				}),
			};
			return { settingsStore: store };
		});

		const agentNoEmb = new MemoryAgent();
		const ctx = makeContext({
			messages: [makeMessage('user', 'hello')],
			turnNumber: 1,
		});
		const result = await agentNoEmb.onBeforeSend(ctx);
		expect(result.injectPrompt).toBeUndefined();
	});

	it('extracts facts from messages', async () => {
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				choices: [{ message: { content: '{"facts": [{"content": "User likes dogs", "type": "trait", "importance": 0.9}]}' } }],
			}),
		});

		const ctx = makeContext({
			messages: [
				makeMessage('user', 'I love dogs'),
				makeMessage('assistant', 'Tell me more'),
				makeMessage('user', 'They are loyal'),
				makeMessage('assistant', 'Yes they are'),
			],
			turnNumber: 5,
		});

		await agent.init(ctx);
		const result = await agent.onAfterReceive(ctx, 'response');
		expect(result.updatedMemories).toBeDefined();
		expect(result.updatedMemories!.length).toBe(1);
		expect(result.updatedMemories![0].content).toBe('User likes dogs');
		expect(insertedMemories.length).toBe(1);
	});

	it('does not extract when batch size not reached', async () => {
		const ctx = makeContext({
			messages: [makeMessage('user', 'hello')],
			turnNumber: 1,
		});

		await agent.init(ctx);
		agent['lastExtractionTurn'] = 0;
		const result = await agent.onAfterReceive(ctx, 'response');
		expect(result.updatedMemories).toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('init resets last extraction turn', async () => {
		const ctx = makeContext();
		await agent.init(ctx);
		expect(agent['lastExtractionTurn']).toBe(-Infinity);
	});

	it('shutdown resets last extraction turn', async () => {
		agent['lastExtractionTurn'] = 5;
		await agent.shutdown();
		expect(agent['lastExtractionTurn']).toBe(-Infinity);
	});
});
