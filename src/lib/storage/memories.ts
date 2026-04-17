import { getDb, persist } from './db';
import type { MemoryRecord, SessionSummary } from '$lib/types/memory';
import { makeSessionId } from '$lib/types/branded';
import { cosineSimilarity } from '$lib/core/embedding';

function serializeEmbedding(embedding: number[]): Uint8Array {
	const f32 = new Float32Array(embedding);
	return new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
}

function deserializeEmbedding(blob: Uint8Array): number[] {
	const f32 = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
	return Array.from(f32);
}


export async function insertMemory(memory: MemoryRecord): Promise<void> {
	const db = await getDb();
	db.run(
		`INSERT INTO memories (id, session_id, type, content, importance, source_message_ids, turn_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			memory.id,
			memory.sessionId,
			memory.type,
			memory.content,
			memory.importance,
			JSON.stringify(memory.sourceMessageIds),
			memory.turnNumber,
			memory.createdAt,
		],
	);
	db.run('INSERT INTO embeddings (memory_id, embedding) VALUES (?, ?)', [
		memory.id,
		serializeEmbedding(memory.embedding),
	]);
	try { await persist(); } catch {}
}

export async function deleteMemory(id: string): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM embeddings WHERE memory_id = ?', [id]);
	db.run('DELETE FROM memories WHERE id = ?', [id]);
	try { await persist(); } catch {}
}

export async function getMemoriesForSession(sessionId: string): Promise<Omit<MemoryRecord, 'embedding'>[]> {
	const db = await getDb();
	const rows = db.exec(
		`SELECT id, session_id, type, content, importance, source_message_ids, turn_number, created_at
     FROM memories WHERE session_id = ? ORDER BY created_at DESC`,
		[sessionId],
	);
	if (!rows.length) return [];
	return rows[0].values.map((row) => ({
		id: row[0] as string,
		sessionId: makeSessionId(row[1] as string),
		type: row[2] as MemoryRecord['type'],
		content: row[3] as string,
		importance: row[4] as number,
		sourceMessageIds: JSON.parse(row[5] as string),
		turnNumber: row[6] as number,
		createdAt: row[7] as number,
	}));
}

export async function getTopKMemories(
	sessionId: string,
	k: number,
): Promise<Omit<MemoryRecord, 'embedding'>[]> {
	const db = await getDb();
	const rows = db.exec(
		`SELECT id, session_id, type, content, importance, source_message_ids, turn_number, created_at
     FROM memories WHERE session_id = ? ORDER BY importance DESC LIMIT ?`,
		[sessionId, k],
	);
	if (!rows.length) return [];
	return rows[0].values.map((row) => ({
		id: row[0] as string,
		sessionId: makeSessionId(row[1] as string),
		type: row[2] as MemoryRecord['type'],
		content: row[3] as string,
		importance: row[4] as number,
		sourceMessageIds: JSON.parse(row[5] as string),
		turnNumber: row[6] as number,
		createdAt: row[7] as number,
	}));
}

export async function findSimilarMemories(
	sessionId: string,
	queryEmbedding: number[],
	topK: number,
	currentTurn: number,
): Promise<Array<Omit<MemoryRecord, 'embedding'> & { score: number }>> {
	const db = await getDb();
	const memRows = db.exec(
		`SELECT m.id, m.session_id, m.type, m.content, m.importance, m.source_message_ids, m.turn_number, m.created_at,
            e.embedding
     FROM memories m JOIN embeddings e ON m.id = e.memory_id
     WHERE m.session_id = ?`,
		[sessionId],
	);
	if (!memRows.length) return [];

	const scored = memRows[0].values.map((row) => {
		const embedding = deserializeEmbedding(row[8] as Uint8Array);
		const importance = row[4] as number;
		const turnNumber = row[6] as number;
		const sim = cosineSimilarity(queryEmbedding, embedding);
		const freshnessDecay = Math.exp(-0.05 * (currentTurn - turnNumber));
		const score = sim * importance * freshnessDecay;
		return {
			id: row[0] as string,
			sessionId: makeSessionId(row[1] as string),
			type: row[2] as MemoryRecord['type'],
			content: row[3] as string,
			importance,
			sourceMessageIds: JSON.parse(row[5] as string),
			turnNumber,
			createdAt: row[7] as number,
			score,
		};
	});

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, topK);
}

export async function insertSummary(summary: SessionSummary): Promise<void> {
	const db = await getDb();
	db.run(
		`INSERT INTO summaries (id, session_id, start_turn, end_turn, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
		[summary.id, summary.sessionId, summary.startTurn, summary.endTurn, summary.summary, summary.createdAt],
	);
	try { await persist(); } catch {}
}

export async function getSummariesForSession(sessionId: string): Promise<SessionSummary[]> {
	const db = await getDb();
	const rows = db.exec(
		`SELECT id, session_id, start_turn, end_turn, summary, created_at
     FROM summaries WHERE session_id = ? ORDER BY start_turn ASC`,
		[sessionId],
	);
	if (!rows.length) return [];
	return rows[0].values.map((row) => ({
		id: row[0] as string,
		sessionId: makeSessionId(row[1] as string),
		startTurn: row[2] as number,
		endTurn: row[3] as number,
		summary: row[4] as string,
		createdAt: row[5] as number,
	}));
}

export async function getLatestSummaryTurn(sessionId: string): Promise<number> {
	const db = await getDb();
	const rows = db.exec('SELECT MAX(end_turn) FROM summaries WHERE session_id = ?', [sessionId]);
	if (!rows.length || rows[0].values[0][0] === null) return 0;
	return rows[0].values[0][0] as number;
}

export async function deleteMemoriesForSession(sessionId: string): Promise<void> {
	const db = await getDb();
	const ids = db.exec('SELECT id FROM memories WHERE session_id = ?', [sessionId]);
	if (ids.length) {
		for (const row of ids[0].values) {
			db.run('DELETE FROM embeddings WHERE memory_id = ?', [row[0]]);
		}
	}
	db.run('DELETE FROM memories WHERE session_id = ?', [sessionId]);
	db.run('DELETE FROM summaries WHERE session_id = ?', [sessionId]);
	try { await persist(); } catch {}
}
