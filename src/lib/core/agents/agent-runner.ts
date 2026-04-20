import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { SceneState } from '$lib/types/scene';
import { MemoryAgent } from './memory-agent';
import { DirectorAgent } from './director-agent';
import { SceneStateAgent } from './scene-state-agent';
import { CharacterStateAgent } from './character-state-agent';
import { NarrativeConsistencyAgent } from './narrative-consistency-agent';

export class AgentRunner {
	private agents: Map<string, Agent> = new Map();

	constructor() {
		this.registerAgent(new MemoryAgent());
		this.registerAgent(new DirectorAgent());
		this.registerAgent(new SceneStateAgent());
		this.registerAgent(new NarrativeConsistencyAgent());
		this.registerAgent(new CharacterStateAgent());
	}

	registerAgent(agent: Agent): void {
		this.agents.set(agent.id, agent);
	}

	unregisterAgent(id: string): void {
		this.agents.delete(id);
	}

	hasAgent(id: string): boolean {
		return this.agents.has(id);
	}

	getAgentsByPriority(): Agent[] {
		return Array.from(this.agents.values()).sort((a, b) => a.priority - b.priority);
	}

	async initAll(ctx: AgentContext): Promise<void> {
		for (const agent of this.getAgentsByPriority()) {
			try {
				await agent.init(ctx);
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} init failed`);
			}
		}
	}

	async onBeforeSend(ctx: AgentContext, onProgress?: import('$lib/types/agent').ProgressCallback): Promise<AgentResult> {
		const combined: AgentResult = {};
		const outputs: import('$lib/types/agent').AgentOutputs = {};
		const injectParts: string[] = [];

		for (const agent of this.getAgentsByPriority()) {
			onProgress?.(agent.id, 'running');
			try {
				const result = await agent.onBeforeSend(ctx);
				onProgress?.(agent.id, 'done');
				if (result.injectPrompt) {
					injectParts.push(result.injectPrompt);
					switch (agent.id) {
						case 'memory':
							outputs.memory = result.injectPrompt;
							break;
						case 'director':
							outputs.director = result.injectPrompt;
							break;
						case 'scene-state':
							outputs.sceneState = result.injectPrompt;
							break;
						case 'character-state':
							outputs.characterState = result.injectPrompt;
							break;
					}
				}
				if (result.updatedState) {
					combined.updatedState = {
						...combined.updatedState,
						...result.updatedState
					};
				}
			} catch {
				onProgress?.(agent.id, 'failed');
				console.warn(`[AgentRunner] Agent ${agent.id} onBeforeSend failed`);
			}
		}

		if (injectParts.length) {
			combined.injectPrompt = injectParts.join('\n\n');
		}

		const hasOutputs = outputs.memory || outputs.director || outputs.sceneState || outputs.characterState;
		if (hasOutputs) {
			combined.agentOutputs = outputs;
		}

		return combined;
	}

	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const combined: AgentResult = {};
		const allMemories: import('$lib/types/memory').MemoryRecord[] = [];

		for (const agent of this.getAgentsByPriority()) {
			try {
				const result = await agent.onAfterReceive(ctx, response);
				if (result.updatedMemories) {
					allMemories.push(...result.updatedMemories);
				}
				if (result.updatedState) {
					combined.updatedState = {
						...combined.updatedState,
						...result.updatedState
					};
				}
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} onAfterReceive failed`);
			}
		}

		if (allMemories.length) {
			combined.updatedMemories = allMemories;
		}

		if (combined.updatedState?.scene) {
			try {
				const { sceneStore } = await import('$lib/stores/scene');
				const agentScene = combined.updatedState.scene;
				sceneStore.update((state: SceneState) => ({
					...state,
					location: agentScene.location || state.location,
					mood: agentScene.mood || state.mood,
					time: agentScene.time || state.time,
					participatingCharacters: agentScene.participatingCharacters || state.participatingCharacters,
					environmentalNotes: agentScene.environmentalNotes || state.environmentalNotes,
					lastUpdated: agentScene.lastUpdated || state.lastUpdated,
				}));
			} catch {
				console.warn('[AgentRunner] Failed to persist scene state to sceneStore');
			}
		}

		return combined;
	}

	async shutdownAll(): Promise<void> {
		for (const agent of this.getAgentsByPriority()) {
			try {
				await agent.shutdown();
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} shutdown failed`);
			}
		}
	}
}
