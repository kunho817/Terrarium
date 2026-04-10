/**
 * ChatEngine ↔ UI bridge.
 * Provides reactive functions that connect ChatEngine to Svelte stores.
 */

import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { sceneStore } from '$lib/stores/scene';
import { settingsStore } from '$lib/stores/settings';
import { charactersStore } from '$lib/stores/characters';
import { getEngine } from '$lib/core/bootstrap';
import type { MessageType } from '$lib/types';

export async function sendMessage(input: string, type: MessageType): Promise<void> {
  const state = get(chatStore);
  const scene = get(sceneStore);
  const settings = get(settingsStore);
  const charState = get(charactersStore);

  if (!charState.current) return;

  const engine = getEngine();

  const providerConfig = settings.providers[settings.defaultProvider] as Record<string, unknown> | undefined;

  const config = {
    providerId: settings.defaultProvider,
    model: (providerConfig?.model as string) || undefined,
    apiKey: (providerConfig?.apiKey as string) || undefined,
    baseUrl: (providerConfig?.baseUrl as string) || undefined,
    temperature: (providerConfig?.temperature as number) || undefined,
    maxTokens: (providerConfig?.maxTokens as number) || undefined,
  };

  const result = await engine.send({
    input,
    type,
    card: charState.current,
    scene,
    config,
    messages: state.messages,
  });

  // Add user message to store
  chatStore.addMessage(result.userMessage);

  // Stream tokens into the streaming message
  chatStore.setStreamingMessage('');
  let fullText = '';

  try {
    for await (const token of result.stream) {
      fullText += token;
      chatStore.setStreamingMessage(fullText);
    }
  } catch {
    // Stream interrupted
  }

  // Get final message
  const assistantMessage = await result.onComplete;

  // Clear streaming and add final message
  chatStore.clearStreamingMessage();
  chatStore.addMessage(assistantMessage);

  // Save to storage
  await chatStore.save();
}
