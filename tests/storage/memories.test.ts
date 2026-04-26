import { describe, it, expect, vi, beforeEach } from 'vitest';

const memoriesStore: Map<string, { memory: Omit<import('$lib/types/memory').MemoryRecord, 'embedding'>; embedding: number[] }> = new Map();
const summariesStore: Map<string, import('$lib/types/memory').SessionSummary> = new Map();

vi.mock('$lib/storage/db', () => ({
	getDb: vi.fn(async () => {
		return {
			run(sql: string, params: unknown[]) {
				if (sql.startsWith('INSERT INTO memories')) {
					const [id, sessionId, type, content, importance, sourceMessageIdsJson, turnNumber, createdAt] = params as [string, string, string, string, number, string, number, number];
					memoriesStore.set(id, {
						memory: { id, sessionId: sessionId as import('$lib/types/branded').SessionId, type: type as any, content, importance, sourceMessageIds: JSON.parse(sourceMessageIdsJson), turnNumber, createdAt },
						embedding: [],
					});
				} else if (sql.startsWith('INSERT INTO embeddings')) {
					const [memoryId, embeddingBlob] = params as [string, Uint8Array];
					const existing = memoriesStore.get(memoryId);
					if (existing) {
						const f32 = new Float32Array(embeddingBlob.buffer, embeddingBlob.byteOffset, embeddingBlob.byteLength / 4);
						existing.embedding = Array.from(f32);
					}
				} else if (sql.startsWith('DELETE FROM embeddings') && !sql.includes('session_id')) {
					memoriesStore.delete(params[0] as string);
				} else if (sql.startsWith('DELETE FROM memories') && sql.includes('session_id')) {
					for (const [id, entry] of memoriesStore) {
						if (entry.memory.sessionId === params[0]) memoriesStore.delete(id);
					}
				} else if (sql.startsWith('INSERT INTO summaries')) {
					const [id, sessionId, startTurn, endTurn, summary, createdAt] = params as [string, string, number, number, string, number];
					summariesStore.set(id, { id, sessionId: sessionId as import('$lib/types/branded').SessionId, startTurn, endTurn, summary, createdAt });
				} else if (sql.startsWith('DELETE FROM summaries WHERE id')) {
					summariesStore.delete(params[0] as string);
				} else if (sql.startsWith('DELETE FROM summaries')) {
					for (const [id, summary] of summariesStore) {
						if (summary.sessionId !== params[0]) continue;
						if (params.length > 1 && summary.endTurn < (params[1] as number)) continue;
						summariesStore.delete(id);
					}
				} else if (sql.startsWith('DELETE FROM memories WHERE id')) {
					memoriesStore.delete(params[0] as string);
				} else if (sql.startsWith('UPDATE memories')) {
					const id = params[params.length - 1] as string;
					const entry = memoriesStore.get(id);
					if (entry) {
						const assignments = sql.match(/SET (.+?) WHERE/)?.[1]?.split(',').map((s: string) => s.trim()) ?? [];
						let paramIdx = 0;
						for (const a of assignments) {
							if (a.startsWith('content')) { entry.memory.content = params[paramIdx++] as string; }
							else if (a.startsWith('importance')) { entry.memory.importance = params[paramIdx++] as number; }
							else if (a.startsWith('type')) { entry.memory.type = params[paramIdx++] as any; }
						}
					}
				} else if (sql.startsWith('UPDATE summaries')) {
					const id = params[params.length - 1] as string;
					const entry = summariesStore.get(id);
					if (entry) {
						if (sql.includes('summary')) {
							entry.summary = params[0] as string;
						}
					}
				}
			},
			exec(sql: string, params: unknown[]) {
				if (sql.includes('COUNT(*)') && sql.includes('FROM memories')) {
					const sessionId = params[0] as string;
					const count = [...memoriesStore.values()].filter((e) => e.memory.sessionId === sessionId).length;
					return [{ values: [[count]] }];
				}
				if (sql.includes('FROM summaries') && sql.includes('MAX')) {
					const sessionId = params[0] as string;
					let maxTurn: number | null = null;
					for (const s of summariesStore.values()) {
						if (s.sessionId === sessionId) {
							if (maxTurn === null || s.endTurn > maxTurn) maxTurn = s.endTurn;
						}
					}
					return maxTurn !== null ? [{ values: [[maxTurn]] }] : [{ values: [[null]] }];
				}
				if (sql.includes('FROM summaries')) {
					const sessionId = params[0] as string;
					const rows = [...summariesStore.values()]
						.filter((s) => s.sessionId === sessionId)
						.sort((a, b) => a.startTurn - b.startTurn)
						.map((s) => [s.id, s.sessionId, s.startTurn, s.endTurn, s.summary, s.createdAt]);
					return rows.length ? [{ values: rows }] : [];
				}
				if (sql.includes('JOIN embeddings')) {
					const sessionId = params[0] as string;
					const rows = [...memoriesStore.values()]
						.filter((e) => e.memory.sessionId === sessionId)
						.map((e) => {
							const m = e.memory;
							const f32 = new Float32Array(e.embedding);
							const blob = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
							return [m.id, m.sessionId, m.type, m.content, m.importance, JSON.stringify(m.sourceMessageIds), m.turnNumber, m.createdAt, blob];
						});
					return rows.length ? [{ values: rows }] : [];
				}
				if (sql.includes('ORDER BY importance')) {
					const sessionId = params[0] as string;
					const k = params[1] as number;
					const rows = [...memoriesStore.values()]
						.filter((e) => e.memory.sessionId === sessionId)
						.sort((a, b) => b.memory.importance - a.memory.importance)
						.slice(0, k)
						.map((e) => {
							const m = e.memory;
							return [m.id, m.sessionId, m.type, m.content, m.importance, JSON.stringify(m.sourceMessageIds), m.turnNumber, m.createdAt];
						});
					return rows.length ? [{ values: rows }] : [];
				}
				{
					const sessionId = params[0] as string;
					const rows = [...memoriesStore.values()]
						.filter((e) => e.memory.sessionId === sessionId)
						.sort((a, b) => b.memory.createdAt - a.memory.createdAt)
						.map((e) => {
							const m = e.memory;
							return [m.id, m.sessionId, m.type, m.content, m.importance, JSON.stringify(m.sourceMessageIds), m.turnNumber, m.createdAt];
						});
					return rows.length ? [{ values: rows }] : [];
				}
			},
		};
	}),
	persist: vi.fn(async () => {}),
	closeDb: vi.fn(async () => {}),
}));

import {
	insertMemory,
	deleteMemory,
	getMemoriesForSession,
	getTopKMemories,
	findSimilarMemories,
	insertSummary,
	getSummariesForSession,
	getLatestSummaryTurn,
	deleteMemoriesForSession,
	deleteSummariesFromTurn,
	countMemories,
	updateMemory,
	deleteSummary,
	updateSummary,
} from '$lib/storage/memories';
import { makeSessionId } from '$lib/types/branded';
import type { MemoryRecord, SessionSummary } from '$lib/types/memory';

const SESSION_ID = makeSessionId('sess-1');
const OTHER_SESSION_ID = makeSessionId('sess-other');

function makeMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
	return {
		id: 'mem-1',
		sessionId: SESSION_ID,
		type: 'event',
		content: 'Something happened',
		importance: 0.7,
		sourceMessageIds: ['msg-1'],
		turnNumber: 1,
		createdAt: Date.now(),
		embedding: [0.1, 0.2, 0.3],
		...overrides,
	};
}

function makeSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
	return {
		id: 'sum-1',
		sessionId: SESSION_ID,
		startTurn: 1,
		endTurn: 5,
		summary: 'A summary',
		createdAt: Date.now(),
		...overrides,
	};
}

describe('memories storage', () => {
	beforeEach(() => {
		memoriesStore.clear();
		summariesStore.clear();
	});

	it('inserts and retrieves a memory', async () => {
		const mem = makeMemory();
		await insertMemory(mem);
		const results = await getMemoriesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('mem-1');
		expect(results[0].content).toBe('Something happened');
	});

	it('deletes a memory', async () => {
		await insertMemory(makeMemory({ id: 'mem-a' }));
		await insertMemory(makeMemory({ id: 'mem-b', content: 'Other' }));
		await deleteMemory('mem-a');
		const results = await getMemoriesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('mem-b');
	});

	it('getTopKMemories sorts by importance DESC', async () => {
		await insertMemory(makeMemory({ id: 'low', importance: 0.3 }));
		await insertMemory(makeMemory({ id: 'high', importance: 0.9 }));
		await insertMemory(makeMemory({ id: 'mid', importance: 0.6 }));
		const results = await getTopKMemories('sess-1', 3);
		expect(results.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
	});

	it('findSimilarMemories computes scores correctly', async () => {
		await insertMemory(makeMemory({ id: 'm1', embedding: [1, 0, 0], importance: 1.0, turnNumber: 5 }));
		await insertMemory(makeMemory({ id: 'm2', embedding: [0, 1, 0], importance: 1.0, turnNumber: 5 }));
		const results = await findSimilarMemories('sess-1', [1, 0, 0], 2, 5);
		expect(results[0].id).toBe('m1');
		expect(results[0].score).toBeCloseTo(1.0);
		expect(results[1].score).toBeCloseTo(0.0);
	});

	it('findSimilarMemories applies freshness decay', async () => {
		await insertMemory(makeMemory({ id: 'recent', embedding: [1, 0, 0], importance: 1.0, turnNumber: 8 }));
		await insertMemory(makeMemory({ id: 'old', embedding: [1, 0, 0], importance: 1.0, turnNumber: 2 }));
		const results = await findSimilarMemories('sess-1', [1, 0, 0], 2, 10);
		expect(results[0].id).toBe('recent');
		expect(results[0].score).toBeGreaterThan(results[1].score);
	});

	it('inserts and retrieves summaries', async () => {
		const sum = makeSummary();
		await insertSummary(sum);
		const results = await getSummariesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].summary).toBe('A summary');
	});

	it('getSummariesForSession orders by startTurn ASC', async () => {
		await insertSummary(makeSummary({ id: 's2', startTurn: 6, endTurn: 10 }));
		await insertSummary(makeSummary({ id: 's1', startTurn: 1, endTurn: 5 }));
		const results = await getSummariesForSession('sess-1');
		expect(results.map((r) => r.id)).toEqual(['s1', 's2']);
	});

	it('getLatestSummaryTurn returns max end_turn', async () => {
		await insertSummary(makeSummary({ id: 's1', startTurn: 1, endTurn: 5 }));
		await insertSummary(makeSummary({ id: 's2', startTurn: 6, endTurn: 15 }));
		const turn = await getLatestSummaryTurn('sess-1');
		expect(turn).toBe(15);
	});

	it('getLatestSummaryTurn returns 0 when no summaries', async () => {
		const turn = await getLatestSummaryTurn('sess-1');
		expect(turn).toBe(0);
	});

	it('deleteMemoriesForSession removes all data', async () => {
		await insertMemory(makeMemory({ id: 'm1' }));
		await insertSummary(makeSummary({ id: 's1' }));
		await deleteMemoriesForSession('sess-1');
		expect(await getMemoriesForSession('sess-1')).toHaveLength(0);
		expect(await getSummariesForSession('sess-1')).toHaveLength(0);
	});

	it('deleteSummariesFromTurn removes summaries that overlap the reroll turn', async () => {
		await insertSummary(makeSummary({ id: 's1', startTurn: 1, endTurn: 4 }));
		await insertSummary(makeSummary({ id: 's2', startTurn: 5, endTurn: 8 }));
		await deleteSummariesFromTurn('sess-1', 5);
		const results = await getSummariesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('s1');
	});

	it('countMemories returns count for a session', async () => {
		await insertMemory(makeMemory({ id: 'm1' }));
		await insertMemory(makeMemory({ id: 'm2' }));
		await insertMemory(makeMemory({ id: 'm3', sessionId: OTHER_SESSION_ID }));
		const count = await countMemories('sess-1');
		expect(count).toBe(2);
	});

	it('countMemories returns 0 for session with no memories', async () => {
		const count = await countMemories('nonexistent-session');
		expect(count).toBe(0);
	});

	it('updateMemory updates content and importance', async () => {
		await insertMemory(makeMemory({ id: 'mem-1' }));
		await updateMemory('mem-1', { content: 'Updated content', importance: 0.9 });
		const results = await getMemoriesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].content).toBe('Updated content');
		expect(results[0].importance).toBe(0.9);
	});

	it('updateMemory updates type', async () => {
		await insertMemory(makeMemory({ id: 'mem-1', type: 'event' }));
		await updateMemory('mem-1', { type: 'trait' });
		const results = await getMemoriesForSession('sess-1');
		expect(results[0].type).toBe('trait');
	});

	it('updateSummary changes summary text', async () => {
		await insertSummary(makeSummary({ id: 'sum-1', summary: 'Old summary' }));
		await updateSummary('sum-1', { summary: 'New summary' });
		const results = await getSummariesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].summary).toBe('New summary');
	});

	it('deleteSummary removes a summary', async () => {
		await insertSummary(makeSummary({ id: 'sum-1' }));
		await insertSummary(makeSummary({ id: 'sum-2', startTurn: 6 }));
		await deleteSummary('sum-1');
		const results = await getSummariesForSession('sess-1');
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('sum-2');
	});
});
