import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import { MemoryAgent } from './memory-agent';

export class AgentRunner {
	private agents: Map<string, Agent> = new Map();

	constructor() {
		this.registerAgent(new MemoryAgent());
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

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const combined: AgentResult = {};
		const injectParts: string[] = [];

		for (const agent of this.getAgentsByPriority()) {
			try {
				const result = await agent.onBeforeSend(ctx);
				if (result.injectPrompt) {
					injectParts.push(result.injectPrompt);
				}
				if (result.updatedState) {
					combined.updatedState = {
						...combined.updatedState,
						...result.updatedState
					};
				}
			} catch {
				console.warn(`[AgentRunner] Agent ${agent.id} onBeforeSend failed`);
			}
		}

		if (injectParts.length) {
			combined.injectPrompt = injectParts.join('\n\n');
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
