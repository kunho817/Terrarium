import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { enqueueAutoIllustrations } from './use-chat-illustration';
import { imageGenerationPanelStore } from '$lib/stores/image-generation-panel';
import { snapshotPipeline } from '$lib/stores/agent-progress';
import type { Message } from '$lib/types';

export function stripThinking(text: string): string {
	let result = text.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*?<\/(?:think|thinking)\s*>/gi, '');
	result = result.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*$/gi, '');
	return result.trim();
}

export async function streamAndFinalize(
	stream: AsyncGenerator<string, void, unknown>,
	onComplete: Promise<Message>,
	afterGeneration: Promise<void>,
	config: Record<string, unknown>,
	imageConfig: import('$lib/types/image-config').ImageGenerationConfig | undefined,
	imageAutoGenerate: boolean,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
): Promise<void> {
	const startTime = Date.now();

	chatStore.setStreamingMessage('');
	let rawText = '';
	let streamError: unknown = null;

	try {
		for await (const token of stream) {
			rawText += token;
			chatStore.setStreamingMessage(stripThinking(rawText));
		}
	} catch (e) {
		streamError = e;
	}

	const rawMessage = await onComplete;
	const durationMs = Date.now() - startTime;
	const assistantMessage: Message = {
		...rawMessage,
		content: stripThinking(rawMessage.content),
		generationInfo: {
			...rawMessage.generationInfo,
			durationMs,
			streamError: streamError instanceof Error ? streamError.message : streamError ? String(streamError) : undefined,
		},
	};

	chatStore.clearStreamingMessage();
	if (streamError && assistantMessage.content.trim().length === 0) {
		throw streamError;
	}

	chatStore.addMessage(assistantMessage);
	await chatRepo.saveMessages();

	void afterGeneration
		.catch(() => undefined)
		.then(async () => {
			const snapshot = snapshotPipeline();
			if (!snapshot) {
				return;
			}
			const updatedMessage: Message = {
				...assistantMessage,
				generationInfo: {
					...assistantMessage.generationInfo,
					pipeline: snapshot,
				},
			};
			chatStore.replaceMessage(assistantMessage, updatedMessage);
			await chatRepo.saveMessages();
		});

	if (imageAutoGenerate && assistantMessage.content.length > 0 && imageConfig) {
		const runId = imageGenerationPanelStore.startRun('auto', 'Auto illustrations');
		imageGenerationPanelStore.log(runId, 'Waiting for extraction to finish before illustration planning.');
		void afterGeneration
			.catch(() => undefined)
			.then(() => enqueueAutoIllustrations(assistantMessage, config, imageConfig, customPresets, runId));
	}
}
