import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { settingsStore } from '$lib/stores/settings';
import { charactersStore } from '$lib/stores/characters';
import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
import { getRegistry } from '$lib/core/bootstrap';
import type { Message, UserConfig } from '$lib/types';

export async function generateAndInsertIllustrations(
	assistantMessage: Message,
	config: Record<string, unknown>,
	imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
): Promise<void> {
	try {
		const artStyle = resolveArtStyle(imageConfig.artStylePresetId, customPresets);
		const generator = new ImageGenerator(getRegistry());

		const plannerContent = assistantMessage.content;

		const plans = await generator.planIllustrations(plannerContent, config as UserConfig);
		if (plans.length === 0) return;

		const results = new Map<number, { dataUrl: string; prompt: string }>();

		for (const plan of plans) {
			try {
				const imgResult = await generator.generateIllustration(plan.prompt, imageConfig, artStyle);
				if (imgResult) {
					results.set(plan.afterParagraph, imgResult);
				}
			} catch (e) {
				console.error(`[Illust] Image generation failed for paragraph ${plan.afterParagraph}:`, e);
			}
		}

		if (results.size === 0) return;

		const segments = generator.buildSegments(assistantMessage.content, plans, results);
		assistantMessage.segments = segments;
		assistantMessage.revision = (assistantMessage.revision ?? 0) + 1;

		chatStore.updateLastMessage(assistantMessage);
		await chatRepo.saveMessages();
	} catch (e) {
		console.error('[Illust] Illustration planning failed:', e);
	}
}

export async function generateIllustration(): Promise<void> {
	const state = get(chatStore);
	const settings = get(settingsStore);
	const charState = get(charactersStore);
	if (!charState.current || !charState.currentId) return;

	const imageConfig = settings.imageGeneration;
	if (!imageConfig || imageConfig.provider === 'none') return;

	const providerConfig = settings.providers[settings.defaultProvider] as Record<string, unknown> | undefined;
	const config = {
		providerId: settings.defaultProvider,
		model: (providerConfig?.model as string) || undefined,
		apiKey: (providerConfig?.apiKey as string) || undefined,
		baseUrl: (providerConfig?.baseUrl as string) || undefined,
	};

	const artStyle = resolveArtStyle(imageConfig.artStylePresetId);
	const generator = new ImageGenerator(getRegistry());

	const imgResult = await generator.generateIllustration(
		'1girl, beautiful scenery, detailed',
		imageConfig,
		artStyle,
	);

	if (imgResult) {
		const imageMessage: Message = {
			role: 'assistant',
			content: '',
			type: 'dialogue',
			timestamp: Date.now(),
			segments: [{ type: 'image', dataUrl: imgResult.dataUrl, prompt: imgResult.prompt, id: crypto.randomUUID() }],
		};
		chatStore.addMessage(imageMessage);
		await chatRepo.saveMessages();
	}
}
