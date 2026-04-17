import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { getSceneState, updateSceneState } from '$lib/storage/agent-states';
import { callAgentLLM } from './agent-llm';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { SceneState } from '$lib/types/scene';
import type { StateUpdate } from '$lib/types/agent-state';
import type { AgentSettings } from '$lib/types/config';

const SCENE_SYSTEM_PROMPT = `You are a scene analyzer that extracts scene information from narrative text.
Analyze the text and extract details about the current scene.

Output JSON only:
{
	"location": "where the scene takes place (e.g., 'Rusty Tankard Inn')",
	"characters": ["list of character names present"],
	"atmosphere": "mood of the scene (e.g., 'tense', 'peaceful')",
	"timeOfDay": "time of day if mentioned (e.g., 'evening', 'dawn')",
	"environmentalNotes": "notable environmental details (e.g., 'rain pattering on roof')"
}

Only include fields that can be determined from the text. Leave fields as empty strings if unknown.`;

interface SceneExtraction {
	location: string;
	characters: string[];
	atmosphere: string;
	timeOfDay: string;
	environmentalNotes: string;
}

function getSceneConfig() {
	const settings = get(settingsStore);
	const memorySlot = settings.modelSlots?.memory;
	const chatSlot = settings.modelSlots?.chat;
	const agentSettings = settings.agentSettings as AgentSettings | undefined;
	const sceneSettings = agentSettings?.scene;
	
	return {
		provider: memorySlot?.provider || chatSlot?.provider || settings.defaultProvider,
		apiKey: memorySlot?.apiKey || chatSlot?.apiKey || 
			(settings.providers?.[settings.defaultProvider!]?.apiKey as string),
		model: memorySlot?.model || chatSlot?.model || 
			(settings.providers?.[settings.defaultProvider!]?.model as string),
		baseUrl: memorySlot?.baseUrl || chatSlot?.baseUrl,
		temperature: memorySlot?.temperature ?? chatSlot?.temperature ?? 0.3,
		enabled: sceneSettings?.enabled !== false,
		tokenBudget: sceneSettings?.tokenBudget || 2560
	};
}

async function callSceneExtractionModel(response: string): Promise<SceneExtraction | null> {
	const config = getSceneConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	try {
		const text = await callAgentLLM(SCENE_SYSTEM_PROMPT, response, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: 512,
		});
		return parseSceneOutput(text);
	} catch {
		return null;
	}
}

export function parseSceneOutput(content: string): SceneExtraction | null {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		const parsed = JSON.parse(match[0]);
		return {
			location: typeof parsed.location === 'string' ? parsed.location : '',
			characters: Array.isArray(parsed.characters) ? parsed.characters : [],
			atmosphere: typeof parsed.atmosphere === 'string' ? parsed.atmosphere : '',
			timeOfDay: typeof parsed.timeOfDay === 'string' ? parsed.timeOfDay : '',
			environmentalNotes: typeof parsed.environmentalNotes === 'string' ? parsed.environmentalNotes : ''
		};
	} catch (error) {
		console.warn('[SceneStateAgent] Failed to parse scene output:', error);
		return null;
	}
}

export function formatScenePrompt(state: SceneState): string | undefined {
	const hasContent = state.location || 
		state.participatingCharacters.length > 0 || 
		state.mood || 
		state.time || 
		state.environmentalNotes;

	if (!hasContent) return undefined;

	const lines = ['[Scene]'];
	
	if (state.location) {
		lines.push(`Location: ${state.location}`);
	}
	if (state.participatingCharacters.length) {
		lines.push(`Characters Present: ${state.participatingCharacters.join(', ')}`);
	}
	if (state.mood) {
		lines.push(`Atmosphere: ${state.mood}`);
	}
	if (state.time) {
		lines.push(`Time of Day: ${state.time}`);
	}
	if (state.environmentalNotes) {
		lines.push(`Environment: ${state.environmentalNotes}`);
	}

	return lines.join('\n');
}

export class SceneStateAgent implements Agent {
	readonly id = 'scene';
	readonly name = 'Scene State Agent';
	readonly priority = 30;

	async init(ctx: AgentContext): Promise<void> {
		const existing = await getSceneState(ctx.sessionId);
		if (!existing) {
			await updateSceneState(ctx.sessionId, {
				location: '',
				participatingCharacters: [],
				mood: '',
				time: '',
				environmentalNotes: ''
			});
		}
	}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const state = await getSceneState(ctx.sessionId);
		if (!state) return {};

		const injectPrompt = formatScenePrompt(state);
		if (!injectPrompt) return {};

		return { injectPrompt };
	}

	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const config = getSceneConfig();
		if (!config.enabled) {
			return {};
		}

		const extraction = await callSceneExtractionModel(response);
		if (!extraction) return {};

		const mapped = {
			location: extraction.location,
			participatingCharacters: extraction.characters,
			mood: extraction.atmosphere,
			time: extraction.timeOfDay,
			environmentalNotes: extraction.environmentalNotes,
			lastUpdated: Date.now()
		};

		await updateSceneState(ctx.sessionId, mapped);

		const stateUpdate: StateUpdate = {
			scene: mapped
		};

		return { updatedState: stateUpdate };
	}

	async shutdown(): Promise<void> {}
}
