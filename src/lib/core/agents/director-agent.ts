import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLM } from './agent-llm';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { DirectorGuidance, DirectorMode } from '$lib/types/agent-state';
import type { AgentSettings } from '$lib/types/config';

const DIRECTOR_SYSTEM_PROMPT = `You are a story director that guides narrative direction.
Analyze the current scene and provide guidance for the next response.

Output JSON only:
{
	"sceneMandate": "what must happen this turn",
	"requiredOutcomes": ["mandatory story beats"],
	"forbiddenMoves": ["what the AI must not do"],
	"emphasis": ["what to highlight"],
	"targetPacing": "slow|normal|fast",
	"pressureLevel": "low|medium|high"
}`;

function getDirectorConfig() {
	const settings = get(settingsStore);
	const directorSlot = settings.modelSlots?.director;
	const memorySlot = settings.modelSlots?.memory;
	const chatSlot = settings.modelSlots?.chat;
	const agentSettings = settings.agentSettings as AgentSettings | undefined;
	const directorSettings = agentSettings?.director;
	
	return {
		provider: directorSlot?.provider || memorySlot?.provider || chatSlot?.provider || settings.defaultProvider,
		apiKey: directorSlot?.apiKey || memorySlot?.apiKey || chatSlot?.apiKey || 
			(settings.providers?.[settings.defaultProvider!]?.apiKey as string),
		model: directorSlot?.model || memorySlot?.model || chatSlot?.model || 
			(settings.providers?.[settings.defaultProvider!]?.model as string),
		baseUrl: directorSlot?.baseUrl || memorySlot?.baseUrl || chatSlot?.baseUrl,
		temperature: directorSlot?.temperature ?? memorySlot?.temperature ?? chatSlot?.temperature ?? 0.7,
		mode: directorSettings?.mode || 'light',
		enabled: directorSettings?.enabled !== false,
		tokenBudget: directorSettings?.tokenBudget || 1024
	};
}

async function callDirectorModel(context: string, mode: DirectorMode): Promise<DirectorGuidance | null> {
	const config = getDirectorConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	const modePrompt = mode === 'absolute'
		? 'This is top-priority direction. The response must obey it and create a strong narrative turn now.'
		: mode === 'strong'
			? 'Apply strong directorial control and force a meaningful beat in this response.'
			: 'Apply light but persistent guidance to keep the scene moving.';

	const systemPrompt = `${DIRECTOR_SYSTEM_PROMPT}\n\nMode: ${modePrompt}`;

	try {
		const text = await callAgentLLM(systemPrompt, context, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: 1024,
		});
		return parseDirectorOutput(text);
	} catch {
		return null;
	}
}

export function parseDirectorOutput(content: string): DirectorGuidance | null {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		const parsed = JSON.parse(match[0]);
		if (
			typeof parsed.sceneMandate === 'string' &&
			Array.isArray(parsed.requiredOutcomes) &&
			Array.isArray(parsed.forbiddenMoves)
		) {
			return {
				sceneMandate: parsed.sceneMandate,
				requiredOutcomes: parsed.requiredOutcomes,
				forbiddenMoves: parsed.forbiddenMoves,
				emphasis: parsed.emphasis || [],
				targetPacing: parsed.targetPacing || 'normal',
				pressureLevel: parsed.pressureLevel || 'medium'
			};
		}
		console.warn('[DirectorAgent] Parsed JSON missing required fields');
		return null;
	} catch (error) {
		console.warn('[DirectorAgent] Failed to parse director output:', error);
		return null;
	}
}

export function formatDirectorPrompt(guidance: DirectorGuidance): string {
	const lines = ['[Director]'];
	
	if (guidance.sceneMandate) {
		lines.push(`Scene Mandate: ${guidance.sceneMandate}`);
	}
	if (guidance.requiredOutcomes.length) {
		lines.push(`Required Outcomes: ${guidance.requiredOutcomes.join(', ')}`);
	}
	if (guidance.forbiddenMoves.length) {
		lines.push(`Forbidden Moves: ${guidance.forbiddenMoves.join(', ')}`);
	}
	if (guidance.emphasis.length) {
		lines.push(`Emphasis: ${guidance.emphasis.join(', ')}`);
	}
	lines.push(`Target Pacing: ${guidance.targetPacing}`);
	lines.push(`Pressure Level: ${guidance.pressureLevel}`);

	return lines.join('\n');
}

export class DirectorAgent implements Agent {
	readonly id = 'director';
	readonly name = 'Director Agent';
	readonly priority = 20;

	async init(_ctx: AgentContext): Promise<void> {}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const config = getDirectorConfig();
		if (!config.enabled) {
			return {};
		}

		const recentMessages = ctx.messages.slice(-6);
		const context = recentMessages
			.map(m => `${m.role}: ${m.content}`)
			.join('\n');

		if (!context.trim()) return {};

		const guidance = await callDirectorModel(context, config.mode);
		if (!guidance) return {};

		return {
			injectPrompt: formatDirectorPrompt(guidance),
			updatedState: { directorGuidance: guidance }
		};
	}

	async onAfterReceive(_ctx: AgentContext, _response: string): Promise<AgentResult> {
		return {};
	}

	async shutdown(): Promise<void> {}
}
