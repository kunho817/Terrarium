import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { getSceneState, updateSceneState } from '$lib/storage/agent-states';
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

	const isClaude = config.provider === 'claude' || config.provider === 'anthropic';
	const messages = [
		{ role: 'system', content: SCENE_SYSTEM_PROMPT },
		{ role: 'user', content: response }
	];

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 30000);

	try {
		if (isClaude) {
			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': config.apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: config.model,
					max_tokens: 512,
					system: SCENE_SYSTEM_PROMPT,
					messages: [{ role: 'user', content: response }]
				}),
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			if (!res.ok) {
				console.warn('[SceneStateAgent] Anthropic API returned non-OK status:', res.status);
				return null;
			}
			const data = await res.json();
			return parseSceneOutput(data.content?.[0]?.text ?? '');
		} else {
			const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${config.apiKey}`
				},
				body: JSON.stringify({
					model: config.model,
					messages,
					temperature: config.temperature,
					max_tokens: 512
				}),
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			if (!res.ok) {
				console.warn('[SceneStateAgent] OpenAI API returned non-OK status:', res.status);
				return null;
			}
			const data = await res.json();
			return parseSceneOutput(data.choices?.[0]?.message?.content ?? '');
		}
	} catch (error) {
		clearTimeout(timeoutId);
		if ((error as Error).name === 'AbortError') {
			console.warn('[SceneStateAgent] Request timed out');
		} else {
			console.warn('[SceneStateAgent] LLM call failed:', error);
		}
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
