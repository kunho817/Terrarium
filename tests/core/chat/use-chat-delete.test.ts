import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { settingsStore } from '$lib/stores/settings';
import { sceneStore } from '$lib/stores/scene';
import { makeCharacterId, makeSessionId } from '$lib/types/branded';

const engineMocks = vi.hoisted(() => ({
	clearTurnState: vi.fn(),
	reset: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
	saveMessages: vi.fn(),
	saveScene: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
	resetSessionData: vi.fn(),
}));

vi.mock('$lib/core/bootstrap', () => ({
	getEngine: vi.fn(() => ({
		getPipeline: () => ({
			clearTurnState: engineMocks.clearTurnState,
			reset: engineMocks.reset,
		}),
	})),
}));

vi.mock('$lib/repositories/chat-repo', () => ({
	chatRepo: {
		saveMessages: repoMocks.saveMessages,
		loadChat: vi.fn(),
		loadSession: vi.fn(),
	},
}));

vi.mock('$lib/repositories/scene-repo', () => ({
	sceneRepo: {
		loadScene: vi.fn(),
		save: repoMocks.saveScene,
	},
}));

vi.mock('$lib/storage/sessions', () => ({
	resetSessionData: sessionMocks.resetSessionData,
}));

vi.mock('$lib/core/chat/use-chat-helpers', () => ({
	resolveActiveCard: vi.fn(),
	resolvePersona: vi.fn(),
	getSessionPersonaId: vi.fn(),
}));

vi.mock('$lib/core/chat/world-settings', () => ({
	resolveEffectiveSettings: vi.fn((baseConfig) => baseConfig),
}));

vi.mock('$lib/core/chat/use-chat-streaming', () => ({
	streamAndFinalize: vi.fn(),
}));

import { deleteFromMessage } from '$lib/core/chat/use-chat';

function seedSettings() {
	settingsStore.reset();
	settingsStore.set({
		defaultProvider: 'test-provider',
		theme: 'default',
		providers: {
			'test-provider': {
				apiKey: 'test-key',
				model: 'test-model',
				maxTokens: 4096,
			},
		},
		developerMode: false,
		imageGeneration: {
			provider: 'none',
			autoGenerate: false,
			targetImageCount: 1,
			artStylePresetId: 'default',
			maxTokens: 4096,
			imagePromptInstructions: '',
			placementInstructions: '',
			novelai: {
				apiKey: '',
				model: 'nai-diffusion-4-5-full',
				width: 832,
				height: 1216,
				steps: 28,
				scale: 5,
				sampler: 'k_euler_ancestral',
				noiseSchedule: 'karras',
			},
			comfyui: {
				url: '',
				workflow: '',
				timeout: 60,
			},
		},
		modelSlots: {},
		memorySettings: {
			extractionBatchSize: 5,
			tokenBudget: 4096,
			topK: 15,
			summaryThreshold: 50,
			embeddingProvider: '',
			embeddingApiKey: '',
			embeddingModel: '',
		},
		outputLanguage: '',
		responseLengthTier: 'standard',
		agentSettings: {
			enabled: true,
			jailbreak: '',
			turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048, timeoutMs: 240000 },
			extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
			director: { mode: 'light' },
			worldMode: {
				extractEntities: true,
				extractRelations: true,
				sectionWorldInjection: true,
			},
		},
	});
}

describe('deleteFromMessage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatStore.clear();
		sceneStore.reset();
		seedSettings();
		chatStore.setSessionState(
			makeCharacterId('char-1'),
			makeSessionId('sess-1'),
			[
				{ role: 'assistant', content: 'Greeting', type: 'dialogue', timestamp: 0, isFirstMessage: true },
				{ role: 'user', content: 'First input', type: 'dialogue', timestamp: 1 },
				{ role: 'assistant', content: 'First output', type: 'dialogue', timestamp: 2 },
				{ role: 'user', content: 'Second input', type: 'dialogue', timestamp: 3 },
				{ role: 'assistant', content: 'Second output', type: 'dialogue', timestamp: 4 },
			],
		);
		sceneStore.setSceneState('char-1', 'sess-1', {
			location: 'Castle gate',
			time: 'Dawn',
			mood: 'Tense',
			participatingCharacters: ['Alice', 'Guard'],
			variables: { flagged: true },
			environmentalNotes: 'Cold wind',
			lastUpdated: 10,
		});
	});

	it('deletes the selected turn and clears downstream agent state', async () => {
		await deleteFromMessage(3);

		expect(repoMocks.saveMessages).toHaveBeenCalledOnce();
		expect(engineMocks.clearTurnState).toHaveBeenCalledWith(2, 'sess-1');
		expect(repoMocks.saveScene).toHaveBeenCalledOnce();
		expect(get(chatStore).messages).toEqual([
			expect.objectContaining({ content: 'Greeting' }),
			expect.objectContaining({ content: 'First input' }),
			expect.objectContaining({ content: 'First output' }),
		]);
		expect(get(sceneStore).location).toBe('');
		expect(get(sceneStore).variables).toEqual({});
	});

	it('resets the full session state when deleting from the greeting onward', async () => {
		await deleteFromMessage(0);

		expect(sessionMocks.resetSessionData).toHaveBeenCalledWith('sess-1');
		expect(engineMocks.reset).toHaveBeenCalledOnce();
		expect(engineMocks.clearTurnState).not.toHaveBeenCalled();
		expect(get(chatStore).messages).toEqual([]);
	});
});
