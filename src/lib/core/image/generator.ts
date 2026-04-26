import type { ProviderPlugin } from '$lib/types/plugin';
import type { PluginRegistry } from '$lib/plugins/registry';
import type { Message, UserConfig, ContentSegment, IllustrationPlan } from '$lib/types';
import {
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_IMAGE_BACKFILL_SYSTEM_PROMPT,
  DEFAULT_IMAGE_PLANNING_SYSTEM_PROMPT,
  DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS,
  type ImageGenerationConfig,
} from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import type { SceneState } from '$lib/types/scene';
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { resolveSlotConfig } from '$lib/core/models/slot-resolver';
import { DEFAULT_ART_PRESETS } from '$lib/types/art-style';
import { getActiveJailbreak, stripLLMArtifacts } from '$lib/core/agents/agent-llm';
import { clampTargetImageCount } from '$lib/types/chat-settings';

const CHARACTER_CANON_RULES = [
  'Character appearance and signature traits supplied in the visual context are canon.',
  'Do not change hair color, eye color, skin tone, species traits, body type, apparent age, or signature clothing/accessories unless the conversation explicitly changes them.',
  'If a named character appears, keep that depiction consistent with the provided canon description.',
].join('\n');

export interface AgentImageContext {
  sceneLocation?: string;
  sceneTime?: string;
  sceneMood?: string;
  directorMandate?: string;
  directorEmphasis?: string[];
  characterEmotions?: Record<string, string>;
  focusCharacters?: string[];
}

interface CharacterReference {
  name: string;
  description: string;
  personality?: string;
}

export interface ImageGenContext {
  messages: Message[];
  artStyle: ArtStylePreset;
  imageConfig: ImageGenerationConfig;
  config: UserConfig;
  cardDescription?: string;
  cardName?: string;
  scene?: SceneState;
  personaName?: string;
  agentContext?: AgentImageContext;
}

interface IllustrationLLMConfig extends UserConfig {
  customPlanningPrompt?: string;
}

function buildImageJailbreak(imageConfig?: ImageGenerationConfig): string {
  const configured = imageConfig?.jailbreak?.trim() ?? '';
  const active = getActiveJailbreak('main').trim();
  return [active, configured].filter(Boolean).join('\n\n');
}

function normalizeTargetImageCount(targetImageCount: number | undefined): number {
  const settings = get(settingsStore);
  return clampTargetImageCount(targetImageCount, settings.responseLengthTier);
}

function buildPlanningPrompt(
  customPlanningPrompt: string | undefined,
  imageConfig: ImageGenerationConfig | undefined,
  targetCount: number,
): string {
  const basePrompt =
    customPlanningPrompt?.trim()
    || imageConfig?.planningSystemPrompt?.trim()
    || DEFAULT_IMAGE_PLANNING_SYSTEM_PROMPT;
  const placementInstructions =
    imageConfig?.placementInstructions?.trim()
    || DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS;

  return `${basePrompt}

Placement Targets:
- Target ${targetCount} illustration placement(s) for this response when there are enough visually meaningful beats.
- Never exceed ${targetCount} illustration placement(s).
- Return fewer than ${targetCount} placements if the response does not support that many distinct visual beats.
- Follow this placement guidance: ${placementInstructions}

Visual Canon Rules:
${CHARACTER_CANON_RULES}`;
}

function appendAssistantPrefill(messages: Message[], prefill: string | undefined): Message[] {
  const trimmed = prefill?.trim();
  if (!trimmed) {
    return messages;
  }

  return [
    ...messages,
    { role: 'assistant', content: trimmed, type: 'dialogue', timestamp: 0 },
  ];
}

function splitResponseParagraphs(text: string): string[] {
  return text.split(/\n\n+/);
}

function getEffectiveTargetCount(
  assistantResponse: string,
  imageConfig: ImageGenerationConfig | undefined,
): number {
  const paragraphs = splitResponseParagraphs(assistantResponse);
  return Math.min(normalizeTargetImageCount(imageConfig?.targetImageCount), Math.max(1, paragraphs.length));
}

function chooseBackfillParagraphIndices(
  paragraphCount: number,
  targetCount: number,
  used: Set<number>,
): number[] {
  if (paragraphCount <= 0 || targetCount <= used.size) {
    return [];
  }

  const preferred = new Set<number>();
  if (targetCount === 1) {
    preferred.add(paragraphCount - 1);
  } else {
    for (let i = 0; i < targetCount; i++) {
      preferred.add(Math.round((i * (paragraphCount - 1)) / (targetCount - 1)));
    }
  }

  const ordered = [
    ...Array.from(preferred).sort((a, b) => a - b),
    ...Array.from({ length: paragraphCount }, (_, index) => index),
  ];

  const result: number[] = [];
  for (const index of ordered) {
    if (used.has(index) || result.includes(index)) {
      continue;
    }
    result.push(index);
    if (used.size + result.length >= targetCount) {
      break;
    }
  }

  return result;
}

export class ImageGenerator {
  cardName?: string;
  cardDescription?: string;
  scene?: SceneState;
  personaName?: string;
  agentContext?: AgentImageContext;
  worldCharacterReferences?: CharacterReference[];

  constructor(private registry: PluginRegistry) {}

  async planIllustrations(
    assistantResponse: string,
    config: UserConfig,
    imageConfig?: ImageGenerationConfig,
  ): Promise<IllustrationPlan[]> {
    const llmConfig = this.resolveIllustrationLLMConfig(config);
    const llmProvider = this.registry.getProvider(llmConfig.providerId as string);
    const paragraphs = splitResponseParagraphs(assistantResponse);
    const maxParagraphIndex = Math.max(0, paragraphs.length - 1);
    const targetCount = getEffectiveTargetCount(assistantResponse, imageConfig);
    const userContent = this.buildIllustrationPlanningContent(assistantResponse, imageConfig, targetCount);

    const jb = buildImageJailbreak(imageConfig);
    const planningPrompt = buildPlanningPrompt(llmConfig.customPlanningPrompt, imageConfig, targetCount);
    const systemContent = jb ? `${planningPrompt}\n\n${jb}` : planningPrompt;

    const llmMessages = appendAssistantPrefill([
      { role: 'system', content: systemContent, type: 'system', timestamp: 0 },
      { role: 'user', content: userContent, type: 'dialogue', timestamp: 0 },
    ], imageConfig?.planningPrefill);

    let llmOutput = '';
    for await (const token of llmProvider.chat(llmMessages, llmConfig)) {
      llmOutput += token;
    }

    const trimmed = stripLLMArtifacts(llmOutput);
    if (!trimmed) return [];

    let plans = this.parseIllustrationPlans(trimmed, maxParagraphIndex, targetCount);
    if (plans.length >= targetCount) {
      return plans;
    }

    const missingParagraphIndices = chooseBackfillParagraphIndices(
      paragraphs.length,
      targetCount,
      new Set(plans.map((plan) => plan.afterParagraph)),
    );
    if (missingParagraphIndices.length === 0) {
      return plans;
    }

    const completedPlans = await this.completeIllustrationPlans(
      assistantResponse,
      missingParagraphIndices,
      llmConfig,
      imageConfig,
      maxParagraphIndex,
    );

    const merged = new Map<number, IllustrationPlan>();
    for (const plan of [...plans, ...completedPlans]) {
      if (!merged.has(plan.afterParagraph)) {
        merged.set(plan.afterParagraph, plan);
      }
    }

    plans = Array.from(merged.values())
      .sort((a, b) => a.afterParagraph - b.afterParagraph)
      .slice(0, targetCount);

    return plans;
  }

  async generateIllustration(
    prompt: string,
    imageConfig: ImageGenerationConfig,
    artStyle: ArtStylePreset,
  ): Promise<{ dataUrl: string; prompt: string } | null> {
    if (imageConfig.provider === 'none') return null;

    const positiveParts = [artStyle.positivePrompt, prompt].filter(Boolean);
    const combinedPrompt = positiveParts.join(', ');

    const imageProvider = this.registry.getImageProvider(imageConfig.provider);
    const providerConfig = this.buildImageProviderConfig(imageConfig, artStyle.negativePrompt);
    const imageData = await imageProvider.generateImage(combinedPrompt, providerConfig);

    const dataUrl = this.arrayBufferToDataUrl(imageData);
    return { dataUrl, prompt: combinedPrompt };
  }

  buildSegments(
    text: string,
    plans: IllustrationPlan[],
    results: Map<number, { dataUrl: string; prompt: string }>,
  ): ContentSegment[] {
    const paragraphs = text.split(/\n\n+/);
    const segments: ContentSegment[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      segments.push({ type: 'text', text: paragraphs[i] });

      const plan = plans.find((p) => p.afterParagraph === i);
      const result = plan ? results.get(plan.afterParagraph) : undefined;
      if (result) {
        segments.push({
          type: 'image',
          dataUrl: result.dataUrl,
          prompt: result.prompt,
          id: crypto.randomUUID(),
        });
      }
    }

    return segments;
  }

  async generateForChat(
    ctx: ImageGenContext,
  ): Promise<{ dataUrl: string; prompt: string } | null> {
    if (ctx.imageConfig.provider === 'none') return null;

    this.cardName = ctx.cardName;
    this.cardDescription = ctx.cardDescription;
    this.scene = ctx.scene;
    this.personaName = ctx.personaName;
    this.agentContext = ctx.agentContext;

    const llmConfig = this.resolveIllustrationLLMConfig(ctx.config);
    const llmProvider = this.registry.getProvider(llmConfig.providerId as string);
    const llmPrompt = await this.generateImagePrompt(
      llmProvider,
      ctx.messages,
      ctx.imageConfig,
      llmConfig,
    );
    if (!llmPrompt) return null;

    const positiveParts = [ctx.artStyle.positivePrompt, llmPrompt].filter(Boolean);
    const combinedPrompt = positiveParts.join(', ');

    const imageProvider = this.registry.getImageProvider(ctx.imageConfig.provider);
    const providerConfig = this.buildImageProviderConfig(ctx.imageConfig, ctx.artStyle.negativePrompt);
    const imageData = await imageProvider.generateImage(combinedPrompt, providerConfig);

    const dataUrl = this.arrayBufferToDataUrl(imageData);
    return { dataUrl, prompt: combinedPrompt };
  }

  async generateDirect(
    prompt: string,
    imageConfig: ImageGenerationConfig,
    artStyle: ArtStylePreset,
  ): Promise<{ dataUrl: string; prompt: string }> {
    if (imageConfig.provider === 'none') {
      throw new Error('No image provider selected');
    }

    const result = await this.generateIllustration(prompt, imageConfig, artStyle);
    if (!result) throw new Error('Image generation returned null');
    return result;
  }

  private async generateImagePrompt(
    llmProvider: ProviderPlugin,
    messages: Message[],
    imageConfig: ImageGenerationConfig,
    config: IllustrationLLMConfig,
  ): Promise<string | null> {
    const recentMessages = messages.slice(-10);
    const contextParts = this.buildSharedContextParts();

    contextParts.push('Conversation:');
    contextParts.push(recentMessages.map((m) => `${m.role}: ${m.content}`).join('\n'));

    const chatContext = contextParts.join('\n\n');

    const jb = buildImageJailbreak(imageConfig);
    const systemContent = jb
      ? `${imageConfig.imagePromptInstructions}\n\n${CHARACTER_CANON_RULES}\n\n${jb}`
      : `${imageConfig.imagePromptInstructions}\n\n${CHARACTER_CANON_RULES}`;

    const llmMessages = appendAssistantPrefill([
      { role: 'system', content: systemContent, type: 'system', timestamp: 0 },
      { role: 'user', content: chatContext, type: 'dialogue', timestamp: 0 },
    ], imageConfig.promptPrefill);

    let llmOutput = '';
    for await (const token of llmProvider.chat(llmMessages, config)) {
      llmOutput += token;
    }

    const trimmed = stripLLMArtifacts(llmOutput);
    if (!trimmed) return null;
    return trimmed;
  }

  private buildIllustrationPlanningContent(
    assistantResponse: string,
    imageConfig?: ImageGenerationConfig,
    targetCount?: number,
  ): string {
    const paragraphs = splitResponseParagraphs(assistantResponse);
    const numberedText = paragraphs
      .map((p, i) => `[Paragraph ${i}]: ${p}`)
      .join('\n\n');

    const contextParts = this.buildSharedContextParts();
    const contentParts: string[] = [];
    const desiredCount = targetCount ?? getEffectiveTargetCount(assistantResponse, imageConfig);
    const placementInstructions =
      imageConfig?.placementInstructions?.trim()
      || DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS;

    if (contextParts.length > 0) {
      contentParts.push('=== Visual Context ===');
      contentParts.push(contextParts.join('\n'));
    }

    contentParts.push('=== Illustration Constraints ===');
    contentParts.push(`Target image count: ${desiredCount}`);
    contentParts.push(`Placement guidance: ${placementInstructions}`);

    contentParts.push('=== Assistant Response ===');
    contentParts.push(numberedText);

    return contentParts.join('\n\n');
  }

  private buildSharedContextParts(): string[] {
    const contextParts: string[] = [];

    contextParts.push(`Visual Canon Rules: ${CHARACTER_CANON_RULES.replace(/\n/g, ' ')}`);

    if (this.cardName) {
      contextParts.push(`Character: ${this.cardName}`);
    }
    if (this.cardDescription) {
      contextParts.push(`Primary Character Canon: ${this.summarizeText(this.cardDescription, 900)}`);
    }

    const sceneLocation = this.agentContext?.sceneLocation ?? this.scene?.location;
    const sceneTime = this.agentContext?.sceneTime ?? this.scene?.time;
    const sceneMood = this.agentContext?.sceneMood ?? this.scene?.mood;
    if (sceneLocation || sceneTime || sceneMood) {
      const sceneParts: string[] = [];
      if (sceneLocation) sceneParts.push(`Location: ${sceneLocation}`);
      if (sceneTime) sceneParts.push(`Time: ${sceneTime}`);
      if (sceneMood) sceneParts.push(`Mood: ${sceneMood}`);
      if (sceneParts.length) {
        contextParts.push(`Scene: ${sceneParts.join(', ')}`);
      }
    }

    if (this.personaName) {
      contextParts.push(`User/Persona: ${this.personaName}`);
    }

    const supportingCharacterCanon = this.buildSupportingCharacterCanon();
    if (supportingCharacterCanon) {
      contextParts.push(supportingCharacterCanon);
    }

    if (this.agentContext) {
      if (this.agentContext.directorMandate) {
        contextParts.push(`Director Scene Mandate: ${this.agentContext.directorMandate}`);
      }
      if (this.agentContext.directorEmphasis?.length) {
        contextParts.push(`Director Emphasis: ${this.agentContext.directorEmphasis.join(', ')}`);
      }
      if (this.agentContext.characterEmotions && Object.keys(this.agentContext.characterEmotions).length > 0) {
        const emotions = Object.entries(this.agentContext.characterEmotions)
          .map(([name, emotion]) => `${name} (${emotion})`)
          .join(', ');
        contextParts.push(`Character Emotions: ${emotions}`);
      }
    }

    return contextParts;
  }

  private buildSupportingCharacterCanon(): string | undefined {
    const references = this.getRelevantCharacterReferences();
    if (references.length === 0) {
      return undefined;
    }

    const lines = ['Supporting Character Canon:'];
    for (const reference of references) {
      const details = [this.summarizeText(reference.description, 360)];
      if (reference.personality?.trim()) {
        details.push(`Personality: ${this.summarizeText(reference.personality, 160)}`);
      }
      lines.push(`- ${reference.name}: ${details.filter(Boolean).join(' | ')}`);
    }

    return lines.join('\n');
  }

  private getRelevantCharacterReferences(): CharacterReference[] {
    if (!this.worldCharacterReferences || this.worldCharacterReferences.length === 0) {
      return [];
    }

    const priorityNames = new Set<string>();
    for (const name of this.agentContext?.focusCharacters ?? []) {
      priorityNames.add(this.normalizeName(name));
    }
    for (const name of Object.keys(this.agentContext?.characterEmotions ?? {})) {
      priorityNames.add(this.normalizeName(name));
    }
    for (const name of this.scene?.participatingCharacters ?? []) {
      priorityNames.add(this.normalizeName(name));
    }

    const prioritized: CharacterReference[] = [];
    const fallback: CharacterReference[] = [];

    for (const reference of this.worldCharacterReferences) {
      if (priorityNames.has(this.normalizeName(reference.name))) {
        prioritized.push(reference);
      } else {
        fallback.push(reference);
      }
    }

    const limit = priorityNames.size > 0 ? 5 : 2;
    return [...prioritized, ...fallback].slice(0, limit);
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }

  private summarizeText(value: string, limit: number): string {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (compact.length <= limit) {
      return compact;
    }
    return `${compact.slice(0, Math.max(0, limit - 3))}...`;
  }

  private async completeIllustrationPlans(
    assistantResponse: string,
    paragraphIndices: number[],
    config: IllustrationLLMConfig,
    imageConfig: ImageGenerationConfig | undefined,
    maxParagraphIndex: number,
  ): Promise<IllustrationPlan[]> {
    const llmProvider = this.registry.getProvider(config.providerId as string);
    const jb = buildImageJailbreak(imageConfig);
    const placementInstructions =
      imageConfig?.placementInstructions?.trim()
      || DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS;
    const backfillSystemPrompt =
      imageConfig?.backfillSystemPrompt?.trim()
      || DEFAULT_IMAGE_BACKFILL_SYSTEM_PROMPT;
    const systemContent = jb
      ? `${backfillSystemPrompt}\n\nFollow this placement guidance: ${placementInstructions}\n\n${jb}`
      : `${backfillSystemPrompt}\n\nFollow this placement guidance: ${placementInstructions}`;

    const llmMessages = appendAssistantPrefill([
      { role: 'system', content: systemContent, type: 'system', timestamp: 0 },
      {
        role: 'user',
        content: this.buildIllustrationCompletionContent(assistantResponse, paragraphIndices),
        type: 'dialogue',
        timestamp: 0,
      },
    ], imageConfig?.backfillPrefill);

    let llmOutput = '';
    for await (const token of llmProvider.chat(llmMessages, config)) {
      llmOutput += token;
    }

    const trimmed = stripLLMArtifacts(llmOutput);
    if (!trimmed) {
      return [];
    }

    return this.parseIllustrationPlans(
      trimmed,
      maxParagraphIndex,
      paragraphIndices.length,
      new Set(paragraphIndices),
    );
  }

  private buildIllustrationCompletionContent(
    assistantResponse: string,
    paragraphIndices: number[],
  ): string {
    const paragraphs = splitResponseParagraphs(assistantResponse);
    const numberedText = paragraphs
      .map((p, i) => `[Paragraph ${i}]: ${p}`)
      .join('\n\n');
    const requestedParagraphs = paragraphIndices
      .map((index) => `[Paragraph ${index}]: ${paragraphs[index] ?? ''}`)
      .join('\n\n');

    const contextParts = this.buildSharedContextParts();
    const contentParts: string[] = [];

    if (contextParts.length > 0) {
      contentParts.push('=== Visual Context ===');
      contentParts.push(contextParts.join('\n'));
    }

    contentParts.push('=== Missing Placements ===');
    contentParts.push(`Return prompts for exactly these afterParagraph indices: ${paragraphIndices.join(', ')}`);

    contentParts.push('=== Requested Paragraphs ===');
    contentParts.push(requestedParagraphs);

    contentParts.push('=== Full Assistant Response ===');
    contentParts.push(numberedText);

    return contentParts.join('\n\n');
  }

  private parseIllustrationPlans(
    rawOutput: string,
    maxParagraphIndex: number,
    targetCount: number,
    allowedParagraphs?: Set<number>,
  ): IllustrationPlan[] {
    try {
      const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      const uniquePlans = new Map<number, IllustrationPlan>();

      for (const entry of parsed as Array<{ afterParagraph?: number; prompt?: string }>) {
        if (
          typeof entry.afterParagraph !== 'number' ||
          typeof entry.prompt !== 'string' ||
          entry.prompt.trim().length === 0
        ) {
          continue;
        }
        if (entry.afterParagraph < 0 || entry.afterParagraph > maxParagraphIndex) {
          continue;
        }
        if (allowedParagraphs && !allowedParagraphs.has(entry.afterParagraph)) {
          continue;
        }
        if (!uniquePlans.has(entry.afterParagraph)) {
          uniquePlans.set(entry.afterParagraph, {
            afterParagraph: entry.afterParagraph,
            prompt: entry.prompt.trim(),
          });
        }
      }

      return Array.from(uniquePlans.values())
        .sort((a, b) => a.afterParagraph - b.afterParagraph)
        .slice(0, targetCount);
    } catch {
      return [];
    }
  }

  private resolveIllustrationLLMConfig(config: UserConfig): IllustrationLLMConfig {
    const settings = get(settingsStore);
    const illustrationSlot = resolveSlotConfig(settings, ['illustration', 'chat'], config);
    const providerId = illustrationSlot.provider || settings.defaultProvider || config.providerId;
    const providerConfig = (settings.providers?.[providerId] as Record<string, unknown> | undefined) ?? {};
    const configWithPlanning = config as IllustrationLLMConfig;
    const imageGenerationMaxTokens = settings.imageGeneration?.maxTokens;
    const resolvedMaxTokens =
      imageGenerationMaxTokens
      ?? illustrationSlot.maxTokens
      ?? (providerConfig.maxTokens as number | undefined)
      ?? config.maxTokens;

    return {
      ...config,
      providerId,
      apiKey: illustrationSlot.apiKey || (providerConfig.apiKey as string) || config.apiKey,
      model: illustrationSlot.model || (providerConfig.model as string) || config.model,
      baseUrl: illustrationSlot.baseUrl || (providerConfig.baseUrl as string) || config.baseUrl,
      temperature:
        illustrationSlot.temperature
        ?? (providerConfig.temperature as number | undefined)
        ?? config.temperature,
      maxTokens: resolvedMaxTokens && resolvedMaxTokens >= 10000 ? resolvedMaxTokens : 64000,
      customPlanningPrompt:
        illustrationSlot.slot?.customPlanningPrompt?.trim()
        || configWithPlanning.customPlanningPrompt?.trim()
        || undefined,
    };
  }

  private arrayBufferToDataUrl(data: ArrayBuffer): string {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:image/png;base64,${base64}`;
  }

  private buildImageProviderConfig(
    imageConfig: ImageGenerationConfig,
    negativePrompt: string,
  ): UserConfig {
    if (imageConfig.provider === 'novelai') {
      return {
        providerId: 'novelai',
        apiKey: imageConfig.novelai.apiKey,
        model: imageConfig.novelai.model,
        width: imageConfig.novelai.width,
        height: imageConfig.novelai.height,
        steps: imageConfig.novelai.steps,
        scale: imageConfig.novelai.scale,
        sampler: imageConfig.novelai.sampler,
        noiseSchedule: imageConfig.novelai.noiseSchedule,
        negativePrompt,
      } as UserConfig;
    }

    if (imageConfig.provider === 'comfyui') {
      return {
        providerId: 'comfyui',
        comfyuiUrl: imageConfig.comfyui.url,
        comfyuiWorkflow: imageConfig.comfyui.workflow,
        comfyuiTimeout: imageConfig.comfyui.timeout,
        negativePrompt,
      } as UserConfig;
    }

    return { providerId: 'none' } as UserConfig;
  }
}

export function resolveArtStyle(
  presetId: string,
  customPresets?: ArtStylePreset[],
): ArtStylePreset {
  const all = [...DEFAULT_ART_PRESETS, ...(customPresets || [])];
  return all.find((p) => p.id === presetId) || DEFAULT_ART_PRESETS[0];
}
