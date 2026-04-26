import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { settingsStore } from '$lib/stores/settings';
import { settingsRepo } from '$lib/repositories/settings-repo';
import { sceneStore } from '$lib/stores/scene';
import { imageGenerationPanelStore } from '$lib/stores/image-generation-panel';
import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
import { loadSessionState } from '$lib/storage/session-agent-state';
import { buildAgentImageContext } from '$lib/core/agents/injection';
import { getRegistry } from '$lib/core/bootstrap';
import { resolveActiveCard, resolvePersona, getSessionPersonaId } from './use-chat-helpers';
import { resolveEffectiveSettings } from './world-settings';
import { getActiveImagePromptConfig } from '$lib/core/presets/active-preset';
import type { Message, UserConfig } from '$lib/types';
import { clampTargetImageCount } from '$lib/types/chat-settings';
import { applyProviderDefaults, resolveSlotConfig } from '$lib/core/models/slot-resolver';

const AUTO_IMAGE_RATE_LIMIT_RETRY_DELAYS_MS = [3000, 6000, 12000];

let autoIllustrationQueue: Promise<void> = Promise.resolve();
let pendingAutoIllustrationRuns = 0;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(error: unknown): boolean {
	const message = getErrorMessage(error);
	return /\b429\b|too many requests?|rate limit/i.test(message);
}

async function withRateLimitRetry<T>(
	runId: string,
	label: string,
	task: () => Promise<T>,
): Promise<T> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await task();
		} catch (error) {
			if (!isRateLimitError(error) || attempt >= AUTO_IMAGE_RATE_LIMIT_RETRY_DELAYS_MS.length) {
				throw error;
			}

			const delayMs = AUTO_IMAGE_RATE_LIMIT_RETRY_DELAYS_MS[attempt];
			imageGenerationPanelStore.log(
				runId,
				`${label} hit a rate limit. Retrying in ${Math.round(delayMs / 1000)}s (${attempt + 1}/${AUTO_IMAGE_RATE_LIMIT_RETRY_DELAYS_MS.length + 1}).`,
			);
			await sleep(delayMs);
		}
	}
}

function replaceAssistantMessage(target: Message, updatedMessage: Message): void {
	chatStore.replaceMessage(target, updatedMessage);
}

export function enqueueAutoIllustrations(
	assistantMessage: Message,
	config: Record<string, unknown>,
	imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
	runId: string,
): Promise<void> {
	if (pendingAutoIllustrationRuns > 0) {
		imageGenerationPanelStore.log(runId, 'Queued behind another automatic illustration run.');
	}
	pendingAutoIllustrationRuns += 1;

	const task = async () => {
		await generateAndInsertIllustrations(assistantMessage, config, imageConfig, customPresets, runId);
	};

	const queued = autoIllustrationQueue.then(task, task);
	autoIllustrationQueue = queued.finally(() => {
		pendingAutoIllustrationRuns = Math.max(0, pendingAutoIllustrationRuns - 1);
	});
	return queued;
}

export async function generateAndInsertIllustrations(
	assistantMessage: Message,
	config: Record<string, unknown>,
	imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
	runId?: string,
): Promise<void> {
	const activeRunId = runId ?? imageGenerationPanelStore.startRun('auto', 'Auto illustrations');

	try {
		imageGenerationPanelStore.log(activeRunId, 'Preparing illustration planner context.');
		const artStyle = resolveArtStyle(imageConfig.artStylePresetId, customPresets);
		const generator = new ImageGenerator(getRegistry());
		const resolved = resolveActiveCard();
		if (resolved) {
			generator.cardName = resolved.card.name;
			generator.cardDescription = resolved.card.description;
			if (resolved.worldCard) {
				generator.worldCharacterReferences = resolved.worldCard.characters.map((character) => ({
					name: character.name,
					description: character.description,
					personality: character.personality,
				}));
			}
			try {
				const sessionPersonaId = await getSessionPersonaId();
				const persona = await resolvePersona(resolved.card, sessionPersonaId);
				if (persona?.name) {
					generator.personaName = persona.name;
				}
			} catch {
			}
		}

		const chatState = get(chatStore);
		const sessionId = chatState.sessionId;
		if (sessionId) {
			try {
				const sessionState = await loadSessionState(sessionId as any);
				if (sessionState) {
					generator.agentContext = buildAgentImageContext(sessionState);
				}
			} catch {
			}
		}

		const plannerContent = assistantMessage.content;
		const settings = get(settingsStore);
		const paragraphCount = Math.max(1, plannerContent.split(/\n\n+/).length);
		const requestedTarget = clampTargetImageCount(imageConfig.targetImageCount, settings.responseLengthTier);
		const effectiveTarget = Math.min(requestedTarget, paragraphCount);

		imageGenerationPanelStore.log(
			activeRunId,
			`Planning illustration placements. Requested ${requestedTarget}, effective target ${effectiveTarget} for ${paragraphCount} paragraph(s).`,
		);
		const plans = await withRateLimitRetry(
			activeRunId,
			'Illustration planning',
			() => generator.planIllustrations(plannerContent, config as UserConfig, imageConfig),
		);
		if (plans.length === 0) {
			imageGenerationPanelStore.log(activeRunId, 'Planner returned no placements. Falling back to a single scene illustration.');
			const fallbackResult = await withRateLimitRetry(
				activeRunId,
				'Fallback illustration generation',
				() =>
					generator.generateForChat({
						messages: get(chatStore).messages,
						artStyle,
						imageConfig,
						config: config as UserConfig,
						cardName: generator.cardName,
						cardDescription: generator.cardDescription,
						scene: get(sceneStore),
						personaName: generator.personaName,
						agentContext: generator.agentContext,
					}),
			);

			if (!fallbackResult) {
				imageGenerationPanelStore.complete(activeRunId, 'Planner returned no placements, and fallback image generation produced no result.');
				return;
			}

			const paragraphs = assistantMessage.content.split(/\n\n+/);
			const lastParagraphIndex = Math.max(0, paragraphs.length - 1);
			const fallbackSegments = generator.buildSegments(
				assistantMessage.content,
				[{ afterParagraph: lastParagraphIndex, prompt: fallbackResult.prompt }],
				new Map([[lastParagraphIndex, fallbackResult]]),
			);
			const updatedMessage: Message = {
				...assistantMessage,
				segments: fallbackSegments,
				revision: (assistantMessage.revision ?? 0) + 1,
			};
			replaceAssistantMessage(assistantMessage, updatedMessage);
			await chatRepo.saveMessages();
			imageGenerationPanelStore.addResult(activeRunId, fallbackResult);
			imageGenerationPanelStore.complete(activeRunId, 'Inserted a fallback scene illustration into the latest response.');
			return;
		}

		imageGenerationPanelStore.log(activeRunId, `Planner returned ${plans.length}/${effectiveTarget} illustration prompt(s).`);

		const results = new Map<number, { dataUrl: string; prompt: string }>();

		for (const [index, plan] of plans.entries()) {
			try {
				imageGenerationPanelStore.log(activeRunId, `Generating illustration ${index + 1}/${plans.length}.`);
				const imgResult = await withRateLimitRetry(
					activeRunId,
					`Illustration ${index + 1}/${plans.length}`,
					() => generator.generateIllustration(plan.prompt, imageConfig, artStyle),
				);
				if (imgResult) {
					results.set(plan.afterParagraph, imgResult);
					imageGenerationPanelStore.addResult(activeRunId, imgResult);
					imageGenerationPanelStore.log(activeRunId, `Illustration ${index + 1}/${plans.length} completed.`, 'success');
				}
			} catch (e) {
				console.error(`[Illust] Image generation failed for paragraph ${plan.afterParagraph}:`, e);
				imageGenerationPanelStore.log(
					activeRunId,
					`Illustration ${index + 1}/${plans.length} failed: ${e instanceof Error ? e.message : String(e)}`,
					'error',
				);
			}
		}

		if (results.size === 0) {
			imageGenerationPanelStore.complete(activeRunId, 'Planning finished, but no images were generated.');
			return;
		}

		const segments = generator.buildSegments(assistantMessage.content, plans, results);
		const updatedMessage: Message = {
			...assistantMessage,
			segments,
			revision: (assistantMessage.revision ?? 0) + 1,
		};

		replaceAssistantMessage(assistantMessage, updatedMessage);
		await chatRepo.saveMessages();
		imageGenerationPanelStore.complete(activeRunId, `Inserted ${results.size} illustration(s) into the latest response.`);
	} catch (e) {
		console.error('[Illust] Illustration planning failed:', e);
		imageGenerationPanelStore.fail(activeRunId, e instanceof Error ? e.message : String(e));
	}
}

export async function generateIllustration(): Promise<void> {
	await settingsRepo.ensureLoaded();
	const state = get(chatStore);
	const settings = get(settingsStore);
	const resolved = resolveActiveCard();
	if (!resolved) return;

	const imageConfig = getActiveImagePromptConfig(settings);
	if (!imageConfig || imageConfig.provider === 'none') return;

	const chatSlot = resolveSlotConfig(settings, ['chat']);
	const baseConfig = {
		providerId: chatSlot.provider || settings.defaultProvider,
		model: chatSlot.model,
		apiKey: chatSlot.apiKey,
		baseUrl: chatSlot.baseUrl,
	};
	const config = resolveEffectiveSettings(baseConfig, resolved.worldCard?.worldSettings);
	const hydratedConfig = applyProviderDefaults(settings, config);

	const artStyle = resolveArtStyle(imageConfig.artStylePresetId, settings.customArtStylePresets);
	const generator = new ImageGenerator(getRegistry());
	generator.cardName = resolved.card.name;
	generator.cardDescription = resolved.card.description;
	if (resolved.worldCard) {
		generator.worldCharacterReferences = resolved.worldCard.characters.map((character) => ({
			name: character.name,
			description: character.description,
			personality: character.personality,
		}));
	}

	try {
		const sessionPersonaId = await getSessionPersonaId();
		const persona = await resolvePersona(resolved.card, sessionPersonaId);
		if (persona?.name) {
			generator.personaName = persona.name;
		}
	} catch {
	}

	const sessionId = state.sessionId;
	if (sessionId) {
		try {
			const sessionState = await loadSessionState(sessionId as any);
			if (sessionState) {
				generator.agentContext = buildAgentImageContext(sessionState);
			}
		} catch {
		}
	}

	const runId = imageGenerationPanelStore.startRun('manual', 'Current scene');

	try {
		imageGenerationPanelStore.log(runId, 'Generating image from current chat context.');
		const imgResult = await withRateLimitRetry(
			runId,
			'Manual illustration generation',
			() =>
				generator.generateForChat({
					messages: state.messages,
					artStyle,
					imageConfig,
					config: hydratedConfig,
					cardName: resolved.card.name,
					cardDescription: resolved.card.description,
					scene: get(sceneStore),
					personaName: generator.personaName,
					agentContext: generator.agentContext,
				}),
		);

		if (!imgResult) {
			throw new Error('Image generation returned no result');
		}

		imageGenerationPanelStore.addResult(runId, imgResult);

		const imageMessage: Message = {
			role: 'assistant',
			content: '',
			type: 'dialogue',
			timestamp: Date.now(),
			segments: [{ type: 'image', dataUrl: imgResult.dataUrl, prompt: imgResult.prompt, id: crypto.randomUUID() }],
		};
		chatStore.addMessage(imageMessage);
		await chatRepo.saveMessages();
		imageGenerationPanelStore.complete(runId, 'Generated current-scene image and added it to the chat.');
	} catch (e) {
		imageGenerationPanelStore.fail(runId, e instanceof Error ? e.message : String(e));
		throw e;
	}
}
