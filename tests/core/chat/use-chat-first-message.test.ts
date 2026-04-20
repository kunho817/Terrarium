import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { charactersStore } from '$lib/stores/characters';
import { worldsStore } from '$lib/stores/worlds';
import { createDefaultWorldCard } from '$lib/types';
import { makeCharacterId, makeSessionId } from '$lib/types/branded';
import type { CharacterCard } from '$lib/types';

const repoMocks = vi.hoisted(() => ({
	loadChat: vi.fn(),
	loadSession: vi.fn(),
	saveMessages: vi.fn(),
	loadScene: vi.fn(),
}));

vi.mock('$lib/repositories/chat-repo', () => ({
	chatRepo: {
		loadChat: repoMocks.loadChat,
		loadSession: repoMocks.loadSession,
		saveMessages: repoMocks.saveMessages,
	},
}));

vi.mock('$lib/repositories/scene-repo', () => ({
	sceneRepo: {
		loadScene: repoMocks.loadScene,
	},
}));

import { initChat, injectFirstMessage } from '$lib/core/chat/use-chat';

const baseCharacter: CharacterCard = {
	name: 'Alice',
	description: '',
	personality: '',
	scenario: '',
	firstMessage: 'Default character greeting',
	alternateGreetings: [],
	exampleMessages: '',
	systemPrompt: '',
	postHistoryInstructions: '',
	creator: '',
	characterVersion: '',
	tags: [],
	creatorNotes: '',
	lorebook: [],
	loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
	regexScripts: [],
	triggers: [],
	scriptState: {},
	emotionImages: [],
	additionalAssets: [],
	metadata: {},
};

describe('first message injection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatStore.clear();
		charactersStore.reset();
		worldsStore.reset();
		repoMocks.loadChat.mockImplementation(async (cardId: string) => {
			chatStore.setSessionState(makeCharacterId(cardId), makeSessionId('session-1'), []);
		});
		repoMocks.loadSession.mockImplementation(async (cardId: string, sessionId: string) => {
			chatStore.setSessionState(makeCharacterId(cardId), makeSessionId(sessionId), []);
		});
	});

	it('injectFirstMessage prefers an explicit greeting over card defaults', async () => {
		charactersStore.selectCharacterState('char-1', baseCharacter);

		await injectFirstMessage('Selected alternate greeting');

		const messages = get(chatStore).messages;
		expect(messages).toHaveLength(1);
		expect(messages[0].content).toBe('Selected alternate greeting');
		expect(messages[0].isFirstMessage).toBe(true);
		expect(repoMocks.saveMessages).toHaveBeenCalledOnce();
	});

	it('initChat uses the selected world greeting as the first message', async () => {
		const world = {
			...createDefaultWorldCard(),
			name: 'World',
			firstMessage: 'Default world greeting',
			alternateGreetings: [
				{ id: 'g1', name: 'Storm Gate', content: 'Selected storm-gate opening' },
			],
		};
		worldsStore.selectWorldState('world-1', world);

		await initChat('world-1', undefined, world.alternateGreetings[0].content);

		expect(repoMocks.loadChat).toHaveBeenCalledWith('world-1');
		const messages = get(chatStore).messages;
		expect(messages).toHaveLength(1);
		expect(messages[0].content).toBe('Selected storm-gate opening');
		expect(messages[0].content).not.toBe('Default world greeting');
	});
});
