import type { PluginRegistry, ProviderPlugin } from '$lib/types/plugin';
import type { Message, UserConfig } from '$lib/types';
import type { ImageGenerationConfig } from '$lib/types/image-config';
import type { ArtStylePreset } from '$lib/types/art-style';
import { DEFAULT_ART_PRESETS } from '$lib/types/art-style';
import { writeFile, mkdir } from '@tauri-apps/plugin-fs';

export interface ImageGenContext {
  messages: Message[];
  artStyle: ArtStylePreset;
  imageConfig: ImageGenerationConfig;
  config: UserConfig;
  charId: string;
  sessionId: string;
}

export class ImageGenerator {
  constructor(private registry: PluginRegistry) {}

  /**
   * Pass 1: Generate image prompt via LLM.
   * Returns the LLM output (not combined with art style).
   */
  async generateImagePrompt(
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
      {
        role: 'system',
        content: imageConfig.imagePromptInstructions,
        type: 'system',
        timestamp: 0,
      },
      {
        role: 'user',
        content: chatContext,
        type: 'dialogue',
        timestamp: 0,
      },
    ];

    let llmOutput = '';
    for await (const token of llmProvider.chat(llmMessages, config)) {
      llmOutput += token;
    }

    const trimmed = llmOutput.trim();
    if (!trimmed) return null;
    return trimmed;
  }

  /**
   * Full 2-pass generation: LLM prompt → image provider → save to disk.
   * Returns { filename, prompt } or null.
   */
  async generateForChat(
    ctx: ImageGenContext,
  ): Promise<{ filename: string; prompt: string } | null> {
    if (ctx.imageConfig.provider === 'none') return null;

    // Pass 1: LLM generates image prompt
    const llmProvider = this.registry.getProvider(ctx.config.providerId as string);
    const llmPrompt = await this.generateImagePrompt(
      llmProvider,
      ctx.messages,
      ctx.imageConfig,
      ctx.config,
    );
    if (!llmPrompt) return null;

    // Combine with art style
    const positiveParts = [ctx.artStyle.positivePrompt, llmPrompt].filter(Boolean);
    const combinedPrompt = positiveParts.join(', ');

    // Pass 2: Call image provider
    const imageProvider = this.registry.getImageProvider(ctx.imageConfig.provider);
    const providerConfig = this.buildProviderConfig(ctx);
    const imageData = await imageProvider.generateImage(combinedPrompt, providerConfig);

    // Save image to disk
    const filename = await this.saveImage(imageData, ctx.charId, ctx.sessionId);
    return { filename, prompt: combinedPrompt };
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

  private async saveImage(
    data: ArrayBuffer,
    charId: string,
    sessionId: string,
  ): Promise<string> {
    const dir = `images/${charId}/${sessionId}`;
    const timestamp = Date.now();
    const filename = `${dir}/${timestamp}.png`;

    // Ensure directory exists (BaseDirectory.AppData = 1)
    await mkdir(dir, { baseDir: 1, recursive: true });
    await writeFile(filename, new Uint8Array(data), { baseDir: 1 });

    return filename;
  }
}

/**
 * Helper: find art style preset by ID, fallback to first default.
 */
export function resolveArtStyle(
  presetId: string,
  customPresets?: ArtStylePreset[],
): ArtStylePreset {
  const all = [...DEFAULT_ART_PRESETS, ...(customPresets || [])];
  return all.find((p) => p.id === presetId) || DEFAULT_ART_PRESETS[0];
}
