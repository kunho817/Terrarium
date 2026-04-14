import type { ProviderPlugin } from '$lib/types/plugin';
import type { PluginRegistry } from '$lib/plugins/registry';
import type { Message, UserConfig, ContentSegment, IllustrationPlan } from '$lib/types';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import { DEFAULT_ART_PRESETS } from '$lib/types/art-style';

const PLAN_SYSTEM_PROMPT = `You are an illustration planner for a roleplay chat. You will be given an AI assistant's response. Your job is to decide where illustrations should be inserted to enhance the visual experience.

Analyze the response and output a JSON array of illustration placements. Each entry specifies:
- "afterParagraph": the 0-based paragraph index after which to insert the image
- "prompt": a comma-separated tag-style prompt for the image generation (e.g., "1girl, forest, golden sunlight, detailed background")

Rules:
- Only place illustrations at visually significant moments: scene changes, dramatic reveals, important character actions, or atmospheric shifts
- Use at most 2-3 illustrations per response
- The prompt should describe the visual scene at that point in the story
- Output ONLY the JSON array, no other text
- If no illustrations are needed, output an empty array: []

Example output:
[{"afterParagraph":1,"prompt":"1girl, standing in forest, golden hour, detailed trees"},{"afterParagraph":4,"prompt":"1girl, close-up, tears, emotional, soft lighting"}]`;

export interface ImageGenContext {
  messages: Message[];
  artStyle: ArtStylePreset;
  imageConfig: ImageGenerationConfig;
  config: UserConfig;
}

export class ImageGenerator {
  constructor(private registry: PluginRegistry) {}

  async planIllustrations(
    assistantResponse: string,
    config: UserConfig,
  ): Promise<IllustrationPlan[]> {
    const llmProvider = this.registry.getProvider(config.providerId as string);
    const paragraphs = assistantResponse.split(/\n\n+/);
    const numberedText = paragraphs
      .map((p, i) => `[Paragraph ${i}]: ${p}`)
      .join('\n\n');

    const llmMessages: Message[] = [
      { role: 'system', content: PLAN_SYSTEM_PROMPT, type: 'system', timestamp: 0 },
      { role: 'user', content: numberedText, type: 'dialogue', timestamp: 0 },
    ];

    let llmOutput = '';
    for await (const token of llmProvider.chat(llmMessages, config)) {
      llmOutput += token;
    }

    const trimmed = llmOutput.trim();
    if (!trimmed) return [];

    try {
      const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (p: any) =>
          typeof p.afterParagraph === 'number' &&
          typeof p.prompt === 'string' &&
          p.prompt.trim().length > 0,
      );
    } catch {
      return [];
    }
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
    const providerConfig = this.buildDirectProviderConfig(imageConfig, artStyle);
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

    const llmProvider = this.registry.getProvider(ctx.config.providerId as string);
    const llmPrompt = await this.generateImagePrompt(
      llmProvider,
      ctx.messages,
      ctx.imageConfig,
      ctx.config,
    );
    if (!llmPrompt) return null;

    const positiveParts = [ctx.artStyle.positivePrompt, llmPrompt].filter(Boolean);
    const combinedPrompt = positiveParts.join(', ');

    const imageProvider = this.registry.getImageProvider(ctx.imageConfig.provider);
    const providerConfig = this.buildProviderConfig(ctx);
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
    config: UserConfig,
  ): Promise<string | null> {
    const recentMessages = messages.slice(-10);
    const chatContext = recentMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const llmMessages: Message[] = [
      { role: 'system', content: imageConfig.imagePromptInstructions, type: 'system', timestamp: 0 },
      { role: 'user', content: chatContext, type: 'dialogue', timestamp: 0 },
    ];

    let llmOutput = '';
    for await (const token of llmProvider.chat(llmMessages, config)) {
      llmOutput += token;
    }

    const trimmed = llmOutput.trim();
    if (!trimmed) return null;
    return trimmed;
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

  private buildProviderConfig(ctx: ImageGenContext): UserConfig {
    if (ctx.imageConfig.provider === 'novelai') {
      return {
        providerId: 'novelai',
        apiKey: ctx.imageConfig.novelai.apiKey,
        model: ctx.imageConfig.novelai.model,
        width: ctx.imageConfig.novelai.width,
        height: ctx.imageConfig.novelai.height,
        steps: ctx.imageConfig.novelai.steps,
        scale: ctx.imageConfig.novelai.scale,
        sampler: ctx.imageConfig.novelai.sampler,
        noiseSchedule: ctx.imageConfig.novelai.noiseSchedule,
        negativePrompt: ctx.artStyle.negativePrompt,
      } as UserConfig;
    }

    if (ctx.imageConfig.provider === 'comfyui') {
      return {
        providerId: 'comfyui',
        comfyuiUrl: ctx.imageConfig.comfyui.url,
        comfyuiWorkflow: ctx.imageConfig.comfyui.workflow,
        comfyuiTimeout: ctx.imageConfig.comfyui.timeout,
        negativePrompt: ctx.artStyle.negativePrompt,
      } as UserConfig;
    }

    return { providerId: 'none' } as UserConfig;
  }

  private buildDirectProviderConfig(imageConfig: ImageGenerationConfig, artStyle: ArtStylePreset): UserConfig {
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
        negativePrompt: artStyle.negativePrompt,
      } as UserConfig;
    }

    if (imageConfig.provider === 'comfyui') {
      return {
        providerId: 'comfyui',
        comfyuiUrl: imageConfig.comfyui.url,
        comfyuiWorkflow: imageConfig.comfyui.workflow,
        comfyuiTimeout: imageConfig.comfyui.timeout,
        negativePrompt: artStyle.negativePrompt,
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
