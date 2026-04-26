import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { sceneStore } from '$lib/stores/scene';
import { sceneRepo } from '$lib/repositories/scene-repo';
import { settingsStore } from '$lib/stores/settings';
import { settingsRepo } from '$lib/repositories/settings-repo';
import { charactersStore } from '$lib/stores/characters';
import { getEngine } from '$lib/core/bootstrap';
import { resolveActiveCard, resolvePersona, getSessionPersonaId } from './use-chat-helpers';
import { resolveEffectiveSettings } from './world-settings';
import { streamAndFinalize } from './use-chat-streaming';
import { resetSessionData } from '$lib/storage/sessions';
import { applyProviderDefaults, resolveSlotConfig } from '$lib/core/models/slot-resolver';
export { generateIllustration } from './use-chat-illustration';
export { resolveActiveCard, resolvePersona, getSessionPersonaId } from './use-chat-helpers';
export type { ResolvedCard } from './use-chat-helpers';

import type { MessageType, Message, UserConfig } from '$lib/types';
import type { PromptPreset } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
import type { AppSettings } from '$lib/storage/settings';
import { getActiveImagePromptConfig } from '$lib/core/presets/active-preset';

interface ResolvedChatConfig {
	config: UserConfig;
	activePreset: PromptPreset | undefined;
	imageConfig: ImageGenerationConfig;
	imageAutoGenerate: boolean;
}

function resolveChatConfig(settings: AppSettings, worldSettings?: import('$lib/types/world').WorldSettings): ResolvedChatConfig {
	const chatSlot = resolveSlotConfig(settings, ['chat']);
	const baseConfig: UserConfig = {
		providerId: chatSlot.provider || settings.defaultProvider,
		model: chatSlot.model,
		apiKey: chatSlot.apiKey,
		baseUrl: chatSlot.baseUrl,
		temperature: chatSlot.temperature,
		maxTokens: chatSlot.maxTokens,
	};

	const config = resolveEffectiveSettings(baseConfig, worldSettings);
	const hydratedConfig = applyProviderDefaults(settings, config);

	const presetSettings = settings.promptPresets;
	let activePreset: PromptPreset | undefined;
	if (presetSettings) {
		activePreset = presetSettings.presets.find((p: PromptPreset) => p.id === presetSettings.activePresetId);
	}

	const imageConfig = activePreset
		? getActiveImagePromptConfig(settings)
		: (settings.imageGeneration ?? DEFAULT_IMAGE_CONFIG);
	const imageAutoGenerate = !!(imageConfig?.autoGenerate && imageConfig.provider !== 'none');

	return { config: hydratedConfig, activePreset, imageConfig, imageAutoGenerate };
}

export async function initChat(characterId: string, sessionId?: string, firstMessageOverride?: string): Promise<void> {
	getEngine().getPipeline().reset();

	if (sessionId) {
		await chatRepo.loadSession(characterId, sessionId);
		await sceneRepo.loadScene(characterId, sessionId);
	} else {
		await chatRepo.loadChat(characterId);
		const chatState = get(chatStore);
		if (chatState.sessionId) {
			await sceneRepo.loadScene(characterId, chatState.sessionId);
		}
	}

	await injectFirstMessage(firstMessageOverride);
}

export async function injectFirstMessage(greetingContent?: string): Promise<void> {
	const state = get(chatStore);
	if (state.messages.length === 0) {
		let firstMsg: string | undefined = greetingContent;

		if (!firstMsg) {
			const charState = get(charactersStore);
			if (charState.current?.firstMessage) {
				firstMsg = charState.current.firstMessage;
			}
		}

		if (!firstMsg) {
			try {
				const { worldsStore } = await import('$lib/stores/worlds');
				const worldState = get(worldsStore);
				if (worldState.current?.firstMessage) {
					firstMsg = worldState.current.firstMessage;
				}
			} catch {}
		}

		if (firstMsg) {
			const greeting: Message = {
				role: 'assistant',
				content: firstMsg,
				type: 'dialogue',
				timestamp: Date.now(),
				isFirstMessage: true,
			};
			chatStore.addMessage(greeting);
			await chatRepo.saveMessages();
		}
	}
}

export async function sendMessage(input: string, type: MessageType): Promise<void> {
	await settingsRepo.ensureLoaded();
	const state = get(chatStore);
	const settings = get(settingsStore);

	const resolved = resolveActiveCard();
	if (!resolved) return;

	const sessionPersonaId = await getSessionPersonaId();
	const persona = await resolvePersona(resolved.card, sessionPersonaId);
	const engine = getEngine();
	const { config, activePreset, imageConfig, imageAutoGenerate } = resolveChatConfig(settings, resolved.worldCard?.worldSettings);

	const result = await engine.send({
		input,
		type,
		card: resolved.card,
		scene: get(sceneStore),
		config,
		messages: state.messages,
		characterId: (state.characterId as string | null) ?? undefined,
		sessionId: (state.sessionId as string | null) ?? undefined,
		preset: activePreset,
		persona,
		worldCard: resolved.worldCard,
		imageAutoGenerate,
	});

	chatStore.addMessage(result.userMessage);

	await streamAndFinalize(result.stream, result.onComplete, result.afterGeneration, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
}

export async function editMessage(index: number, newContent: string): Promise<void> {
	const state = get(chatStore);
	if (index < 0 || index >= state.messages.length) return;
	const message = { ...state.messages[index], content: newContent, revision: (state.messages[index].revision ?? 0) + 1 };
	chatStore.updateMessage(index, message);
	await chatRepo.saveMessages();
}

export async function rerollFromMessage(userMessageIndex: number): Promise<void> {
	await settingsRepo.ensureLoaded();
	const state = get(chatStore);
	const settings = get(settingsStore);

	if (userMessageIndex < 0 || userMessageIndex >= state.messages.length) return;

	const resolved = resolveActiveCard();
	if (!resolved) return;

	const userMessage = state.messages[userMessageIndex];
	if (userMessage.role !== 'user') return;

	chatStore.truncateAfter(userMessageIndex);
	await chatRepo.saveMessages();

	const currentState = get(chatStore);
	const rerollTurn = currentState.messages.filter((message) => message.role === 'user').length;
	const priorMessages = currentState.messages.slice(0, -1);
	const sessionPersonaId = await getSessionPersonaId();
	const persona = await resolvePersona(resolved.card, sessionPersonaId);
	const engine = getEngine();
	await engine.getPipeline().clearTurnState(rerollTurn, currentState.sessionId as string | undefined);
	const { config, activePreset, imageConfig, imageAutoGenerate } = resolveChatConfig(settings, resolved.worldCard?.worldSettings);

	const result = await engine.send({
		input: userMessage.content,
		type: userMessage.type,
		card: resolved.card,
		scene: get(sceneStore),
		config,
		messages: priorMessages,
		characterId: (currentState.characterId as string | null) ?? undefined,
		sessionId: (currentState.sessionId as string | null) ?? undefined,
		preset: activePreset,
		persona,
		worldCard: resolved.worldCard,
		imageAutoGenerate,
	});

	await streamAndFinalize(result.stream, result.onComplete, result.afterGeneration, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
}

function buildEmptyScene(): import('$lib/types').SceneState {
	return {
		location: '',
		time: '',
		mood: '',
		participatingCharacters: [],
		variables: {},
		environmentalNotes: '',
		lastUpdated: Date.now(),
	};
}

export async function deleteFromMessage(messageIndex: number): Promise<void> {
	const state = get(chatStore);
	if (messageIndex < 0 || messageIndex >= state.messages.length) return;

	const affectedTurn = state.messages
		.slice(0, messageIndex + 1)
		.filter((message) => message.role === 'user').length;

	chatStore.removeFrom(messageIndex);
	await chatRepo.saveMessages();

	const engine = getEngine();
	if (state.sessionId) {
		if (affectedTurn > 0) {
			await engine.getPipeline().clearTurnState(affectedTurn, state.sessionId as string);
		} else {
			await resetSessionData(state.sessionId as string);
			engine.getPipeline().reset();
		}
	}

	if (state.characterId && state.sessionId) {
		sceneStore.setSceneState(state.characterId as string, state.sessionId as string, buildEmptyScene());
		await sceneRepo.save();
	}
}
