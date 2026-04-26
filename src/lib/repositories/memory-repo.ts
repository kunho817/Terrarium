import {
	getMemoriesForSession,
	getSummariesForSession,
	updateMemory,
	deleteMemory,
	insertMemory,
	updateSummary,
	deleteSummary,
} from '$lib/storage/memories';
import { memorySyncStore } from '$lib/stores/memory-sync';
import type { MemoryType, MemoryRecord, SessionSummary } from '$lib/types/memory';
import { makeSessionId } from '$lib/types/branded';

export interface MemoryView {
	id: string;
	type: MemoryType;
	content: string;
	importance: number;
	turnNumber: number;
	createdAt: number;
}

export const memoryRepo = {
	async getForSession(sessionId: string): Promise<MemoryView[]> {
		const mems = await getMemoriesForSession(sessionId);
		return mems.map(m => ({
			id: m.id,
			type: m.type,
			content: m.content,
			importance: m.importance,
			turnNumber: m.turnNumber,
			createdAt: m.createdAt,
		}));
	},

	async getSummaries(sessionId: string): Promise<SessionSummary[]> {
		return getSummariesForSession(sessionId);
	},

	async addMemory(sessionId: string, type: MemoryType, content: string, importance: number): Promise<void> {
		const record: MemoryRecord = {
			id: crypto.randomUUID(),
			sessionId: makeSessionId(sessionId),
			type,
			content,
			importance,
			sourceMessageIds: [],
			turnNumber: 0,
			createdAt: Date.now(),
			embedding: new Array(128).fill(0),
		};
		await insertMemory(record);
		memorySyncStore.bump();
	},

	async updateMemory(id: string, patch: { content?: string; importance?: number; type?: MemoryType }): Promise<void> {
		await updateMemory(id, patch);
		memorySyncStore.bump();
	},

	async deleteMemory(id: string): Promise<void> {
		await deleteMemory(id);
		memorySyncStore.bump();
	},

	async updateSummary(id: string, patch: { summary: string }): Promise<void> {
		await updateSummary(id, patch);
		memorySyncStore.bump();
	},

	async deleteSummary(id: string): Promise<void> {
		await deleteSummary(id);
		memorySyncStore.bump();
	},
};
