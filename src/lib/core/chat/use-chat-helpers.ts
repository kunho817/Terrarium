import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { charactersStore } from '$lib/stores/characters';
import { worldsStore } from '$lib/stores/worlds';
import { loadPersona } from '$lib/storage/personas';
import { chatRepo } from '$lib/repositories/chat-repo';
import type { CharacterCard } from '$lib/types';
import type { UserPersona } from '$lib/types/persona';
import type { WorldCard } from '$lib/types/world';
import { chatStore } from '$lib/stores/chat';

export function worldCardToCharacterCard(world: WorldCard): CharacterCard {
	return {
		name: world.name,
		description: world.description,
		personality: '',
		scenario: world.scenario,
		firstMessage: world.firstMessage,
		alternateGreetings: world.alternateGreetings.map((greeting) => greeting.content),
		exampleMessages: '',
		systemPrompt: world.systemPrompt,
		postHistoryInstructions: world.postHistoryInstructions,
		depthPrompt: world.depthPrompt,
		defaultPersonaId: world.defaultPersonaId,
		creator: world.creator,
		characterVersion: '',
		tags: world.tags,
		creatorNotes: world.creatorNotes,
		license: world.license,
		lorebook: world.lorebook,
		loreSettings: world.loreSettings,
		regexScripts: world.regexScripts,
		triggers: world.triggers,
		virtualScript: world.virtualScript,
		scriptState: world.scriptState,
		backgroundHTML: world.backgroundHTML,
		backgroundCSS: world.backgroundCSS,
		customTheme: world.customTheme,
		emotionImages: [],
		additionalAssets: [],
		metadata: world.metadata,
	};
}

export interface ResolvedCard {
	card: CharacterCard;
	cardType: 'character' | 'world';
	worldCard?: WorldCard;
}

export function resolveActiveCard(): ResolvedCard | null {
	const chatState = get(chatStore);
	const cardType = chatState.cardType;
	const activeId = chatState.characterId as string | null;
	const charState = get(charactersStore);
	const worldState = get(worldsStore);

	if (cardType === 'world' || (activeId && worldState.currentId === activeId && !charState.current)) {
		if (worldState.current) {
			return {
				card: worldCardToCharacterCard(worldState.current),
				cardType: 'world',
				worldCard: worldState.current,
			};
		}
	}

	if (charState.current) {
		return { card: charState.current, cardType: 'character' };
	}

	if (worldState.current) {
		return {
			card: worldCardToCharacterCard(worldState.current),
			cardType: 'world',
			worldCard: worldState.current,
		};
	}

	return null;
}

export async function resolvePersona(card: { defaultPersonaId?: string }, sessionPersonaId?: string): Promise<UserPersona | undefined> {
	const settings = get(settingsStore);
	const personaId = sessionPersonaId || card.defaultPersonaId || settings.defaultPersonaId;
	if (!personaId) return undefined;
	try {
		return await loadPersona(personaId);
	} catch {
		return undefined;
	}
}

export async function getSessionPersonaId(): Promise<string | undefined> {
	const state = get(chatStore);
	if (!state.characterId || !state.sessionId) return undefined;
	try {
		const sessions = await chatRepo.getCachedSessions(state.characterId);
		const session = sessions.find(s => s.id === state.sessionId);
		return session?.personaId;
	} catch {
		return undefined;
	}
}
