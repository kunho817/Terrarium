import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { settingsStore } from '$lib/stores/settings';
import { sceneStore } from '$lib/stores/scene';
import { makeCharacterId, makeSessionId } from '$lib/types/branded';

const engineMocks = vi.hoisted(() => ({
	send: vi.fn(),
	clearTurnState: vi.fn(),
}));

const helperMocks = vi.hoisted(() => ({
	resolveActiveCard: vi.fn(),
	resolvePersona: vi.fn(),
	getSessionPersonaId: vi.fn(),
}));

const repoMocks = vi.hoisted(() => ({
	saveMessages: vi.fn(),
}));

const streamingMocks = vi.hoisted(() => ({
	streamAndFinalize: vi.fn(),
}));

vi.mock('$lib/core/bootstrap', () => ({
	getEngine: vi.fn(() => ({
		send: engineMocks.send,
		getPipeline: () => ({
			clearTurnState: engineMocks.clearTurnState,
		}),
	})),
}));

vi.mock('$lib/core/chat/use-chat-helpers', () => ({
	resolveActiveCard: helperMocks.resolveActiveCard,
	resolvePersona: helperMocks.resolvePersona,
	getSessionPersonaId: helperMocks.getSessionPersonaId,
}));

vi.mock('$lib/repositories/chat-repo', () => ({
	chatRepo: {
		saveMessages: repoMocks.saveMessages,
		loadChat: vi.fn(),
		loadSession: vi.fn(),
	},
}));

vi.mock('$lib/repositories/settings-repo', () => ({
	settingsRepo: {
		ensureLoaded: vi.fn(() => Promise.resolve()),
		load: vi.fn(() => Promise.resolve()),
		save: vi.fn(() => Promise.resolve()),
		getCurrentState: vi.fn(),
	},
}));

vi.mock('$lib/repositories/scene-repo', () => ({
	sceneRepo: {
		loadScene: vi.fn(),
	},
}));

vi.mock('$lib/core/chat/use-chat-streaming', () => ({
	streamAndFinalize: streamingMocks.streamAndFinalize,
}));

vi.mock('$lib/core/chat/world-settings', () => ({
	resolveEffectiveSettings: vi.fn((baseConfig) => baseConfig),
}));

import { rerollFromMessage } from '$lib/core/chat/use-chat';

async function* emptyStream(): AsyncGenerator<string, void, unknown> {
	yield* [];
}

describe('rerollFromMessage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatStore.clear();
		sceneStore.reset();
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
		chatStore.setSessionState(
			makeCharacterId('char-1'),
			makeSessionId('sess-1'),
			[
				{ role: 'user', content: 'First input', type: 'dialogue', timestamp: 1 },
				{ role: 'assistant', content: 'First output', type: 'dialogue', timestamp: 2 },
				{ role: 'user', content: 'Second input', type: 'dialogue', timestamp: 3 },
				{ role: 'assistant', content: 'Second output', type: 'dialogue', timestamp: 4 },
			],
		);
		helperMocks.resolveActiveCard.mockReturnValue({
			card: { name: 'Alice', lorebook: [], loreSettings: {}, regexScripts: [], triggers: [] },
			worldCard: undefined,
		});
		helperMocks.getSessionPersonaId.mockResolvedValue(null);
		helperMocks.resolvePersona.mockResolvedValue(null);
		engineMocks.send.mockResolvedValue({
			userMessage: { role: 'user', content: 'Second input', type: 'dialogue', timestamp: 5 },
			stream: emptyStream(),
			onComplete: Promise.resolve({ role: 'assistant', content: 'Rerolled output', type: 'dialogue', timestamp: 6 }),
			afterGeneration: Promise.resolve(),
			abort: vi.fn(),
		});
	});

	it('rerolls from the selected user turn without duplicating the user message', async () => {
		await rerollFromMessage(2);

		expect(engineMocks.clearTurnState).toHaveBeenCalledWith(2, 'sess-1');
		expect(engineMocks.send).toHaveBeenCalledWith(expect.objectContaining({
			input: 'Second input',
			messages: [
				expect.objectContaining({ role: 'user', content: 'First input' }),
				expect.objectContaining({ role: 'assistant', content: 'First output' }),
			],
			characterId: 'char-1',
			sessionId: 'sess-1',
		}));
		expect(streamingMocks.streamAndFinalize).toHaveBeenCalledOnce();
		expect(get(chatStore).messages).toEqual([
			expect.objectContaining({ role: 'user', content: 'First input' }),
			expect.objectContaining({ role: 'assistant', content: 'First output' }),
			expect.objectContaining({ role: 'user', content: 'Second input' }),
		]);
	});
});
