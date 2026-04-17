import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { getCharacterStates, updateCharacterState } from '$lib/storage/agent-states';
import { callAgentLLM } from './agent-llm';
import type { Agent, AgentContext, AgentResult } from '$lib/types/agent';
import type { CharacterState, StateUpdate } from '$lib/types/agent-state';
import type { AgentSettings } from '$lib/types/config';

const CHARACTER_SYSTEM_PROMPT = `You are a character state analyzer that extracts character information from narrative text.
Analyze the text and extract details about each character mentioned.

Output JSON only:
{
	"characters": [
		{
			"name": "character name",
			"emotion": "current emotional state (e.g., 'nervous', 'angry', 'content')",
			"location": "where they are in the scene (e.g., 'at the bar', 'by the window')",
			"inventory": ["items they are carrying or holding"],
			"health": "physical condition (e.g., 'healthy', 'injured', 'exhausted')",
			"notes": "notable details about the character"
		}
	]
}

Only include characters that are explicitly mentioned. Leave fields as empty strings/arrays if unknown.`;

interface CharacterExtraction {
	characters: Array<{
		name: string;
		emotion: string;
		location: string;
		inventory: string[];
		health: string;
		notes: string;
	}>;
}

function getCharacterConfig() {
	const settings = get(settingsStore);
	const memorySlot = settings.modelSlots?.memory;
	const chatSlot = settings.modelSlots?.chat;
	const agentSettings = settings.agentSettings as AgentSettings | undefined;
	const characterSettings = agentSettings?.character;
	
	return {
		provider: memorySlot?.provider || chatSlot?.provider || settings.defaultProvider,
		apiKey: memorySlot?.apiKey || chatSlot?.apiKey || 
			(settings.providers?.[settings.defaultProvider!]?.apiKey as string),
		model: memorySlot?.model || chatSlot?.model || 
			(settings.providers?.[settings.defaultProvider!]?.model as string),
		baseUrl: memorySlot?.baseUrl || chatSlot?.baseUrl,
		temperature: memorySlot?.temperature ?? chatSlot?.temperature ?? 0.3,
		enabled: characterSettings?.enabled !== false,
		autoTrack: characterSettings?.autoTrack !== false,
		tokenBudget: characterSettings?.tokenBudget || 6400
	};
}

async function callCharacterExtractionModel(response: string): Promise<CharacterExtraction | null> {
	const config = getCharacterConfig();
	if (!config.enabled || !config.provider || !config.apiKey || !config.model) {
		return null;
	}

	try {
		const text = await callAgentLLM(CHARACTER_SYSTEM_PROMPT, response, {
			providerId: config.provider,
			apiKey: config.apiKey,
			model: config.model,
			baseUrl: config.baseUrl,
			temperature: config.temperature,
			maxTokens: 1024,
		});
		return parseCharacterOutput(text);
	} catch {
		return null;
	}
}

export function parseCharacterOutput(content: string): CharacterExtraction | null {
	const match = content.match(/\{[\s\S]*\}/);
	if (!match) return null;

	try {
		const parsed = JSON.parse(match[0]);
		if (!Array.isArray(parsed.characters)) {
			return { characters: [] };
		}
		
		return {
			characters: parsed.characters.map((c: any) => ({
				name: typeof c.name === 'string' ? c.name : '',
				emotion: typeof c.emotion === 'string' ? c.emotion : '',
				location: typeof c.location === 'string' ? c.location : '',
				inventory: Array.isArray(c.inventory) ? c.inventory : [],
				health: typeof c.health === 'string' ? c.health : '',
				notes: typeof c.notes === 'string' ? c.notes : ''
			}))
		};
	} catch (error) {
		console.warn('[CharacterStateAgent] Failed to parse character output:', error);
		return null;
	}
}

export function formatCharacterPrompt(states: CharacterState[]): string | undefined {
	if (states.length === 0) return undefined;

	const lines = ['[Character States]'];
	
	for (const state of states) {
		const details: string[] = [];
		if (state.emotion) details.push(`feeling ${state.emotion}`);
		if (state.location) details.push(state.location);
		if (state.health && state.health !== 'healthy') details.push(state.health);
		if (state.inventory.length > 0) details.push(`carrying: ${state.inventory.join(', ')}`);
		if (state.notes) details.push(state.notes);
		
		if (details.length > 0) {
			lines.push(`${state.characterName}: ${details.join('; ')}`);
		}
	}

	return lines.length > 1 ? lines.join('\n') : undefined;
}

export class CharacterStateAgent implements Agent {
	readonly id = 'character';
	readonly name = 'Character State Agent';
	readonly priority = 40;

	async init(ctx: AgentContext): Promise<void> {
		// Character states are created on-demand, no initialization needed
	}

	async onBeforeSend(ctx: AgentContext): Promise<AgentResult> {
		const states = await getCharacterStates(ctx.sessionId);
		if (states.length === 0) return {};

		const injectPrompt = formatCharacterPrompt(states);
		if (!injectPrompt) return {};

		return { injectPrompt };
	}

	async onAfterReceive(ctx: AgentContext, response: string): Promise<AgentResult> {
		const config = getCharacterConfig();
		if (!config.enabled) {
			return {};
		}

		const extraction = await callCharacterExtractionModel(response);
		if (!extraction || extraction.characters.length === 0) return {};

		// Update each character's state
		for (const char of extraction.characters) {
			if (!char.name) continue;
			
			await updateCharacterState(ctx.sessionId, char.name, {
				emotion: char.emotion,
				location: char.location,
				inventory: char.inventory,
				health: char.health,
				notes: char.notes
			});
		}

		const stateUpdate: StateUpdate = {
			characters: extraction.characters.map(c => ({
				characterName: c.name,
				emotion: c.emotion,
				location: c.location,
				inventory: c.inventory,
				health: c.health,
				notes: c.notes
			}))
		};

		return { updatedState: stateUpdate };
	}

	async shutdown(): Promise<void> {}
}
