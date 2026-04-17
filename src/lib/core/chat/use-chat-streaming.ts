import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { generateAndInsertIllustrations } from './use-chat-illustration';
import type { Message } from '$lib/types';

export function stripThinking(text: string): string {
	let result = text.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*?<\/(?:think|thinking)\s*>/gi, '');
	result = result.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*$/gi, '');
	return result.trim();
}

export async function streamAndFinalize(
	stream: AsyncGenerator<string, void, unknown>,
	onComplete: Promise<Message>,
	config: Record<string, unknown>,
	imageConfig: import('$lib/types/image-config').ImageGenerationConfig | undefined,
	imageAutoGenerate: boolean,
	customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
): Promise<void> {
	const startTime = Date.now();

	chatStore.setStreamingMessage('');
	let rawText = '';

	try {
		for await (const token of stream) {
			rawText += token;
			chatStore.setStreamingMessage(stripThinking(rawText));
		}
	} catch (e) {
		chatStore.clearStreamingMessage();
		throw e;
	}

	const rawMessage = await onComplete;
	const durationMs = Date.now() - startTime;
	const assistantMessage: Message = {
		...rawMessage,
		content: stripThinking(rawMessage.content),
		generationInfo: { ...rawMessage.generationInfo, durationMs },
	};

	chatStore.clearStreamingMessage();
	chatStore.addMessage(assistantMessage);
	await chatRepo.saveMessages();

	if (imageAutoGenerate && assistantMessage.content.length > 0 && imageConfig) {
		generateAndInsertIllustrations(assistantMessage, config, imageConfig, customPresets);
	}
}
