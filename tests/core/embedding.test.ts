import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: undefined,
}));

import {
	getEmbedding,
	getEmbeddings,
	cosineSimilarity,
	callVoyageApi,
	callOpenAICompatibleApi,
} from '$lib/core/embedding';
import type { EmbeddingConfig } from '$lib/core/embedding';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const voyageConfig: EmbeddingConfig = {
	provider: 'voyage',
	apiKey: 'voyage-key',
	model: 'voyage-3',
};

const openaiConfig: EmbeddingConfig = {
	provider: 'openai-compatible',
	apiKey: 'openai-key',
	model: 'text-embedding-3-small',
	baseUrl: 'https://api.example.com/v1',
};

describe('embedding', () => {
	beforeEach(() => {
		fetchMock.mockReset();
	});

	describe('callVoyageApi', () => {
		it('sends correct request format', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
				}),
			});

			const result = await callVoyageApi(['hello', 'world'], voyageConfig);

			expect(fetchMock).toHaveBeenCalledWith('https://api.voyageai.com/v1/embeddings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer voyage-key',
				},
				body: JSON.stringify({
					input: ['hello', 'world'],
					model: 'voyage-3',
					input_type: 'document',
				}),
			});
			expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]]);
		});

		it('throws on non-ok response', async () => {
			fetchMock.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
			await expect(callVoyageApi(['text'], voyageConfig)).rejects.toThrow('Voyage API error: 401 Unauthorized');
		});
	});

	describe('callOpenAICompatibleApi', () => {
		it('sends correct request format', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					data: [{ embedding: [0.5, 0.6] }],
				}),
			});

			const result = await callOpenAICompatibleApi(['test'], openaiConfig);

			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/embeddings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer openai-key',
				},
				body: JSON.stringify({
					input: ['test'],
					model: 'text-embedding-3-small',
				}),
			});
			expect(result).toEqual([[0.5, 0.6]]);
		});

		it('throws on non-ok response', async () => {
			fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });
			await expect(callOpenAICompatibleApi(['text'], openaiConfig)).rejects.toThrow(
				'Embedding API error: 500 Internal Server Error',
			);
		});
	});

	describe('getEmbedding', () => {
		it('returns single embedding', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
			});

			const result = await getEmbedding('hello', voyageConfig);
			expect(result).toEqual([0.1, 0.2]);
		});
	});

	describe('getEmbeddings', () => {
		it('routes to voyage provider', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [{ embedding: [0.1] }] }),
			});

			await getEmbeddings(['text'], voyageConfig);
			expect(fetchMock).toHaveBeenCalledWith('https://api.voyageai.com/v1/embeddings', expect.anything());
		});

		it('routes to openai-compatible provider', async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ data: [{ embedding: [0.1] }] }),
			});

			await getEmbeddings(['text'], openaiConfig);
			expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/embeddings', expect.anything());
		});
	});

	describe('cosineSimilarity', () => {
		it('returns 1.0 for identical vectors', () => {
			expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
		});

		it('returns 0.0 for orthogonal vectors', () => {
			expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
		});

		it('returns -1.0 for opposite vectors', () => {
			expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0);
		});
	});
});
