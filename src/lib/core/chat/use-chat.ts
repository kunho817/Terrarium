import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { sceneStore } from '$lib/stores/scene';
import { sceneRepo } from '$lib/repositories/scene-repo';
import { settingsStore } from '$lib/stores/settings';
import { charactersStore } from '$lib/stores/characters';
import { getEngine } from '$lib/core/bootstrap';
import { resolveActiveCard, resolvePersona, getSessionPersonaId } from './use-chat-helpers';
import { resolveEffectiveSettings } from './world-settings';
import { streamAndFinalize } from './use-chat-streaming';
export { generateIllustration } from './use-chat-illustration';
export { resolveActiveCard, resolvePersona, getSessionPersonaId } from './use-chat-helpers';
export type { ResolvedCard } from './use-chat-helpers';

import type { MessageType, Message, UserConfig } from '$lib/types';
import type { PromptPreset } from '$lib/types/prompt-preset';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import { DEFAULT_IMAGE_CONFIG } from '$lib/types/image-config';
import type { AppSettings } from '$lib/storage/settings';

interface ResolvedChatConfig {
	config: UserConfig;
	activePreset: PromptPreset | undefined;
	imageConfig: ImageGenerationConfig;
	imageAutoGenerate: boolean;
}

function resolveChatConfig(settings: AppSettings, worldSettings?: import('$lib/types/world').WorldSettings): ResolvedChatConfig {
	const providerConfig = settings.providers[settings.defaultProvider] as Record<string, unknown> | undefined;
	const baseConfig: UserConfig = {
		providerId: settings.defaultProvider,
		model: (providerConfig?.model as string) || undefined,
		apiKey: (providerConfig?.apiKey as string) || undefined,
		baseUrl: (providerConfig?.baseUrl as string) || undefined,
		temperature: (providerConfig?.temperature as number) || undefined,
		maxTokens: (providerConfig?.maxTokens as number) || undefined,
	};

	const config = resolveEffectiveSettings(baseConfig, worldSettings);

	const presetSettings = settings.promptPresets;
	let activePreset: PromptPreset | undefined;
	if (presetSettings) {
		activePreset = presetSettings.presets.find((p: PromptPreset) => p.id === presetSettings.activePresetId);
	}

	const imageConfig = settings.imageGeneration ?? DEFAULT_IMAGE_CONFIG;
	const imageAutoGenerate = !!(imageConfig?.autoGenerate && imageConfig.provider !== 'none');

	return { config, activePreset, imageConfig, imageAutoGenerate };
}

export async function initChat(characterId: string, sessionId?: string, firstMessageOverride?: string): Promise<void> {
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

	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets, result.agentContext);
}

export async function editMessage(index: number, newContent: string): Promise<void> {
	const state = get(chatStore);
	if (index < 0 || index >= state.messages.length) return;
	const message = { ...state.messages[index], content: newContent, revision: (state.messages[index].revision ?? 0) + 1 };
	chatStore.updateMessage(index, message);
	await chatRepo.saveMessages();
}

export async function rerollFromMessage(userMessageIndex: number): Promise<void> {
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
	const sessionPersonaId = await getSessionPersonaId();
	const persona = await resolvePersona(resolved.card, sessionPersonaId);
	const engine = getEngine();
	const { config, activePreset, imageConfig, imageAutoGenerate } = resolveChatConfig(settings, resolved.worldCard?.worldSettings);

	const result = await engine.send({
		input: userMessage.content,
		type: userMessage.type,
		card: resolved.card,
		scene: get(sceneStore),
		config,
		messages: currentState.messages,
		preset: activePreset,
		persona,
		worldCard: resolved.worldCard,
		imageAutoGenerate,
	});

	await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets, result.agentContext);
}
