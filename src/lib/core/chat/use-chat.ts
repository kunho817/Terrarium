/**
 * ChatEngine ↔ UI bridge.
 * Provides reactive functions that connect ChatEngine to Svelte stores.
 */

import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { chatRepo } from '$lib/repositories/chat-repo';
import { sceneStore } from '$lib/stores/scene';
import { settingsStore } from '$lib/stores/settings';
import { charactersStore } from '$lib/stores/characters';
import { worldsStore } from '$lib/stores/worlds';
import { getEngine, getRegistry } from '$lib/core/bootstrap';
import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';
import { loadPersona } from '$lib/storage/personas';
import { listSessions } from '$lib/storage/chats';
import type { MessageType, Message, CharacterCard } from '$lib/types';
import type { PromptPreset } from '$lib/types/prompt-preset';
import type { UserPersona } from '$lib/types/persona';
import type { WorldCard } from '$lib/types/world';

function worldCardToCharacterCard(world: WorldCard): CharacterCard {
  return {
    name: world.name,
    description: world.description,
    personality: '',
    scenario: world.scenario,
    firstMessage: world.firstMessage,
    alternateGreetings: world.alternateGreetings,
    exampleMessages: '',
    systemPrompt: world.systemPrompt,
    postHistoryInstructions: world.postHistoryInstructions,
    depthPrompt: world.depthPrompt,
    defaultPersonaId: world.defaultPersonaId,
    creator: world.creator,
    characterVersion: '',
    tags: world.tags,
    creatorNotes: world.creatorNotes,
    license: world.license,
    lorebook: world.lorebook,
    loreSettings: world.loreSettings,
    regexScripts: world.regexScripts,
    triggers: world.triggers,
    virtualScript: world.virtualScript,
    scriptState: world.scriptState,
    backgroundHTML: world.backgroundHTML,
    backgroundCSS: world.backgroundCSS,
    customTheme: world.customTheme,
    emotionImages: [],
    additionalAssets: [],
    metadata: world.metadata,
  };
}

interface ResolvedCard {
  card: CharacterCard;
  cardType: 'character' | 'world';
  worldCard?: WorldCard;
}

function resolveActiveCard(): ResolvedCard | null {
  const charState = get(charactersStore);
  if (charState.current && charState.currentId) {
    return { card: charState.current, cardType: 'character' };
  }
  const worldState = get(worldsStore);
  if (worldState.current && worldState.currentId) {
    return {
      card: worldCardToCharacterCard(worldState.current),
      cardType: 'world',
      worldCard: worldState.current,
    };
  }
  return null;
}

export async function initChat(characterId: string, sessionId?: string): Promise<void> {
  if (sessionId) {
    await chatRepo.loadSession(characterId, sessionId);
    await sceneStore.loadScene(characterId, sessionId);
  } else {
    await chatRepo.loadChat(characterId);
    const chatState = get(chatStore);
    if (chatState.sessionId) {
      await sceneStore.loadScene(characterId, chatState.sessionId);
    }
  }

  await injectFirstMessage();
}

export async function injectFirstMessage(): Promise<void> {
  const state = get(chatStore);
  if (state.messages.length === 0) {
    let firstMsg: string | undefined;

    const charState = get(charactersStore);
    if (charState.current?.firstMessage) {
      firstMsg = charState.current.firstMessage;
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

function stripThinking(text: string): string {
  let result = text.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*?<\/(?:think|thinking)\s*>/gi, '');
  result = result.replace(/<(?:think|thinking)(?:\s[^>]*)?>[\s\S]*$/gi, '');
  return result.trim();
}

async function resolvePersona(card: { defaultPersonaId?: string }, sessionPersonaId?: string): Promise<UserPersona | undefined> {
  const settings = get(settingsStore);
  const personaId = sessionPersonaId || card.defaultPersonaId || settings.defaultPersonaId;
  if (!personaId) return undefined;
  try {
    return await loadPersona(personaId);
  } catch {
    return undefined;
  }
}

async function getSessionPersonaId(): Promise<string | undefined> {
  const state = get(chatStore);
  if (!state.chatId || !state.sessionId) return undefined;
  try {
    const sessions = await listSessions(state.chatId);
    const session = sessions.find(s => s.id === state.sessionId);
    return session?.personaId;
  } catch {
    return undefined;
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

  const providerConfig = settings.providers[settings.defaultProvider] as Record<string, unknown> | undefined;
  const config = {
    providerId: settings.defaultProvider,
    model: (providerConfig?.model as string) || undefined,
    apiKey: (providerConfig?.apiKey as string) || undefined,
    baseUrl: (providerConfig?.baseUrl as string) || undefined,
    temperature: (providerConfig?.temperature as number) || undefined,
    maxTokens: (providerConfig?.maxTokens as number) || undefined,
  };

  const presetSettings = settings.promptPresets;
  let activePreset: PromptPreset | undefined;
  if (presetSettings) {
    activePreset = presetSettings.presets.find(p => p.id === presetSettings.activePresetId);
  }

  const imageConfig = settings.imageGeneration;
  const imageAutoGenerate = !!(imageConfig?.autoGenerate && imageConfig.provider !== 'none');

  const result = await engine.send({
    input,
    type,
    card: resolved.card,
    scene: get(sceneStore),
    config,
    messages: state.messages,
    preset: activePreset,
    persona,
    worldCard: resolved.worldCard,
    imageAutoGenerate,
  });

  chatStore.addMessage(result.userMessage);

  await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
}

async function streamAndFinalize(
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
  await chatStore.save();

  if (imageAutoGenerate && assistantMessage.content.length > 0 && imageConfig) {
    generateAndInsertIllustrations(assistantMessage, config, imageConfig, customPresets);
  }
}

async function generateAndInsertIllustrations(
  assistantMessage: Message,
  config: Record<string, unknown>,
  imageConfig: NonNullable<import('$lib/types/image-config').ImageGenerationConfig>,
  customPresets: import('$lib/types/art-style').ArtStylePreset[] | undefined,
): Promise<void> {
  try {
    const artStyle = resolveArtStyle(imageConfig.artStylePresetId, customPresets);
    const generator = new ImageGenerator(getRegistry());

    const plans = await generator.planIllustrations(assistantMessage.content, config as any);
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
    await chatStore.save();
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
    await chatStore.save();
  }
}

export async function editMessage(index: number, newContent: string): Promise<void> {
  const state = get(chatStore);
  if (index < 0 || index >= state.messages.length) return;
  const message = { ...state.messages[index], content: newContent, revision: (state.messages[index].revision ?? 0) + 1 };
  chatStore.updateMessage(index, message);
  await chatStore.save();
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
  await chatStore.save();

  const currentState = get(chatStore);
  const sessionPersonaId = await getSessionPersonaId();
  const persona = await resolvePersona(resolved.card, sessionPersonaId);
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

  const presetSettings = settings.promptPresets;
  let activePreset: PromptPreset | undefined;
  if (presetSettings) {
    activePreset = presetSettings.presets.find(p => p.id === presetSettings.activePresetId);
  }

  const imageConfig = settings.imageGeneration;
  const imageAutoGenerate = !!(imageConfig?.autoGenerate && imageConfig.provider !== 'none');

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

  await streamAndFinalize(result.stream, result.onComplete, config, imageConfig, imageAutoGenerate, settings.customArtStylePresets);
}
