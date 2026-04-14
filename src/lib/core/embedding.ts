export interface EmbeddingConfig {
	provider: 'voyage' | 'openai-compatible';
	apiKey: string;
	model: string;
	baseUrl?: string;
}

export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function callVoyageApi(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
	const res = await fetch('https://api.voyageai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			input: texts,
			model: config.model,
			input_type: 'document',
		}),
	});
	if (!res.ok) {
		throw new Error(`Voyage API error: ${res.status} ${res.statusText}`);
	}
	const data = await res.json();
	return data.data.map((d: { embedding: number[] }) => d.embedding);
}

export async function callOpenAICompatibleApi(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
	const res = await fetch(`${config.baseUrl}/embeddings`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			input: texts,
			model: config.model,
		}),
	});
	if (!res.ok) {
		throw new Error(`Embedding API error: ${res.status} ${res.statusText}`);
	}
	const data = await res.json();
	return data.data.map((d: { embedding: number[] }) => d.embedding);
}

export async function getEmbeddings(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
	if (config.provider === 'voyage') {
		return callVoyageApi(texts, config);
	}
	return callOpenAICompatibleApi(texts, config);
}

export async function getEmbedding(text: string, config: EmbeddingConfig): Promise<number[]> {
	const results = await getEmbeddings([text], config);
	return results[0];
}
