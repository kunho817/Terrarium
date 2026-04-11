/**
 * ChatEngine ↔ UI bridge.
 * Provides reactive functions that connect ChatEngine to Svelte stores.
 */

import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { sceneStore } from '$lib/stores/scene';
import { settingsStore } from '$lib/stores/settings';
import { charactersStore } from '$lib/stores/characters';
import { getEngine, getRegistry } from '$lib/core/bootstrap';
import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
import type { MessageType, Message } from '$lib/types';
import type { PromptPreset } from '$lib/types/prompt-preset';

/**
 * Initialize a chat session for a character.
 *
 * If sessionId is provided, loads that specific session.
 * Otherwise falls back to loadChat which auto-migrates and picks the most recent session.
 */
export async function initChat(characterId: string, sessionId?: string): Promise<void> {
  if (sessionId) {
    await chatStore.loadSession(characterId, sessionId);
    await sceneStore.loadScene(characterId, sessionId);
  } else {
    await chatStore.loadChat(characterId);
    const chatState = get(chatStore);
    if (chatState.sessionId) {
      await sceneStore.loadScene(characterId, chatState.sessionId);
    }
  }
}

/**
 * Strips thinking/reasoning tags from AI output.
 */
function stripThinking(text: string): string {
  // Remove complete thinking blocks
  let result = text.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*?<\/(?:think|thinking)\s*>/gi, '');
  // Remove incomplete thinking block (opening tag without closing)
  result = result.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*$/gi, '');
  return result.trim();
}

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

  // Resolve active prompt preset
  const presetSettings = settings.promptPresets;
  let activePreset: PromptPreset | undefined;
  if (presetSettings) {
    activePreset = presetSettings.presets.find(p => p.id === presetSettings.activePresetId);
  }

  const result = await engine.send({
    input,
    type,
    card: charState.current,
    scene,
    config,
    messages: state.messages,
    preset: activePreset,
  });

  // Add user message to store
  chatStore.addMessage(result.userMessage);

  // Stream tokens into the streaming message (strip thinking tags from display)
  chatStore.setStreamingMessage('');
  let rawText = '';

  try {
    for await (const token of result.stream) {
      rawText += token;
      chatStore.setStreamingMessage(stripThinking(rawText));
    }
  } catch {
    // Stream interrupted
  }

  // Get final message and strip thinking tags
  const rawMessage = await result.onComplete;
  const assistantMessage = { ...rawMessage, content: stripThinking(rawMessage.content) };

  // Clear streaming and add final message
  chatStore.clearStreamingMessage();
  chatStore.addMessage(assistantMessage);

  // Save to storage
  await chatStore.save();

  // Auto-generate illustration if enabled
  const imageConfig = settings.imageGeneration;
  if (imageConfig?.autoGenerate && imageConfig.provider !== 'none') {
    try {
      const artStyle = resolveArtStyle(imageConfig.artStylePresetId);
      const generator = new ImageGenerator(getRegistry());
      const imgResult = await generator.generateForChat({
        messages: [...state.messages, result.userMessage, assistantMessage],
        artStyle,
        imageConfig,
        config,
        charId: charState.current.id,
        sessionId: state.sessionId || 'default',
      });
      if (imgResult) {
        assistantMessage.image = imgResult;
        chatStore.updateLastMessage(assistantMessage);
        await chatStore.save();
      }
    } catch {
      // Image generation failed — non-critical, don't break chat
    }
  }
}

/**
 * Manually generate an illustration for the current conversation.
 * Adds a new assistant message with the generated image.
 */
export async function generateIllustration(): Promise<void> {
  const state = get(chatStore);
  const scene = get(sceneStore);
  const settings = get(settingsStore);
  const charState = get(charactersStore);
  if (!charState.current) return;

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

  const imgResult = await generator.generateForChat({
    messages: state.messages,
    artStyle,
    imageConfig,
    config,
    charId: charState.current.id,
    sessionId: state.sessionId || 'default',
  });

  if (imgResult) {
    const imageMessage: Message = {
      role: 'assistant',
      content: '',
      type: 'dialogue',
      timestamp: Date.now(),
      image: imgResult,
    };
    chatStore.addMessage(imageMessage);
    await chatStore.save();
  }
}
