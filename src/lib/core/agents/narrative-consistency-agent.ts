import { getSceneState } from '$lib/storage/agent-states';
import { getMemoriesForSession } from '$lib/storage/memories';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { SceneState, MemoryRecord } from '$lib/types';

export function buildConsistencyPrompt(
	scene: SceneState,
	memories: Pick<MemoryRecord, 'content' | 'type'>[],
): string | undefined {
	const hasScene = scene.location || scene.participatingCharacters.length > 0;
	const hasMemories = memories.length > 0;

	if (!hasScene && !hasMemories) return undefined;

	const lines: string[] = ['[Consistency Check]'];
	lines.push('Verify the AI response is consistent with established facts:');

	if (scene.location) {
		lines.push(`Current location: ${scene.location}`);
	}
	if (scene.participatingCharacters.length > 0) {
		lines.push(`Characters present: ${scene.participatingCharacters.join(', ')}`);
	}
	if (scene.time) {
		lines.push(`Time: ${scene.time}`);
	}

	if (memories.length > 0) {
		lines.push('Established facts:');
		for (const mem of memories.slice(0, 10)) {
			lines.push(`- ${mem.content} (${mem.type})`);
		}
	}

	return lines.join('\n');
}

export class NarrativeConsistencyAgent implements Agent {
	readonly id = 'narrative-consistency';
	readonly name = 'Narrative Consistency Agent';
	readonly priority = 15;

	async init(_ctx: AgentContext): Promise<void> {}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		if (ctx.cardType !== 'world') return { skipped: true };

		const scene = await getSceneState(ctx.sessionId);
		if (!scene) return {};

		let memories: Pick<MemoryRecord, 'content' | 'type'>[] = [];
		try {
			const allMemories = await getMemoriesForSession(ctx.sessionId);
			memories = allMemories
				.filter((m) => m.type === 'world_fact' || m.type === 'trait' || m.type === 'location')
				.slice(0, 10);
		} catch {
		}

		const injectPrompt = buildConsistencyPrompt(scene, memories);
		if (!injectPrompt) return {};

		return { injectPrompt };
	}

	async onAfterReceive(_ctx: AgentContext, _response: string): Promise<AgentResult> {
		return {};
	}

	async shutdown(): Promise<void> {}
}
