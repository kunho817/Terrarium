import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import { MemoryAgent } from './memory-agent';

export class AgentRunner {
	private agents: Agent[] = [];

	constructor() {
		this.agents = [new MemoryAgent()];
	}

	async initAll(ctx: AgentContext): Promise<void> {
		for (const agent of this.agents) {
			try {
				await agent.init(ctx);
			} catch {}
		}
	}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const combined: AgentResult = {};
		const injectParts: string[] = [];

		for (const agent of this.agents) {
			try {
				const result = await agent.onBeforeSend(ctx);
				if (result.injectPrompt) {
					injectParts.push(result.injectPrompt);
				}
			} catch {}
		}

		if (injectParts.length) {
			combined.injectPrompt = injectParts.join('\n\n');
		}

		return combined;
	}

	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const combined: AgentResult = {};
		const allMemories: import('$lib/types/memory').MemoryRecord[] = [];

		for (const agent of this.agents) {
			try {
				const result = await agent.onAfterReceive(ctx, response);
				if (result.updatedMemories) {
					allMemories.push(...result.updatedMemories);
				}
			} catch {}
		}

		if (allMemories.length) {
			combined.updatedMemories = allMemories;
		}

		return combined;
	}

	async shutdownAll(): Promise<void> {
		for (const agent of this.agents) {
			try {
				await agent.shutdown();
			} catch {}
		}
	}
}
