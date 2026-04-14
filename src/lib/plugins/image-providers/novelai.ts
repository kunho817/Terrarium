import type { ImageProviderPlugin } from '../../types/plugin';
import type { UserConfig, ConfigField } from '../../types/config';
import { fetch } from '@tauri-apps/plugin-http';
import { unzipSync } from 'fflate';

export function createNovelAIProvider(): ImageProviderPlugin {
  const requiredConfig: ConfigField[] = [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
    },
    {
      key: 'model',
      label: 'Model',
      type: 'text',
      defaultValue: 'nai-diffusion-4-5-full',
    },
    {
      key: 'width',
      label: 'Width',
      type: 'number',
      defaultValue: 832,
    },
    {
      key: 'height',
      label: 'Height',
      type: 'number',
      defaultValue: 1216,
    },
    {
      key: 'steps',
      label: 'Steps',
      type: 'number',
      defaultValue: 28,
    },
    {
      key: 'scale',
      label: 'Scale',
      type: 'number',
      defaultValue: 5,
    },
    {
      key: 'sampler',
      label: 'Sampler',
      type: 'text',
      defaultValue: 'k_euler_ancestral',
    },
  ];

  function validateConfig(config: UserConfig): Promise<boolean> {
    return Promise.resolve(!!config.apiKey);
  }

  /** Check if model is V4 or V4.5 */
  function isV4Plus(model: string): boolean {
    return model.startsWith('nai-diffusion-4');
  }

  async function generateImage(
    prompt: string,
    config: UserConfig,
  ): Promise<ArrayBuffer> {
    const apiKey = config.apiKey as string;
    const model = (config.model as string) || 'nai-diffusion-4-5-full';
    const width = (config.width as number) ?? 832;
    const height = (config.height as number) ?? 1216;
    const steps = (config.steps as number) ?? 23;
    const scale = (config.scale as number) ?? 6;
    const sampler = (config.sampler as string) || 'k_euler_ancestral';
    const negativePrompt = (config.negativePrompt as string) || '';
    const noiseSchedule = (config.noiseSchedule as string) || 'karras';
    const seed = Math.floor(Math.random() * 2 ** 32);

    const parameters: Record<string, unknown> = {
      params_version: 3,
      add_original_image: true,
      cfg_rescale: 0,
      controlnet_strength: 1,
      dynamic_thresholding: false,
      n_samples: 1,
      width,
      height,
      sampler,
      steps,
      scale,
      negative_prompt: negativePrompt,
      noise_schedule: noiseSchedule,
      legacy_v3_extend: false,
      seed,
      prefer_brownian: true,
      qualityToggle: true,
      autoSmea: false,
      legacy_uc: false,
      legacy: false,
      deliberate_euler_ancestral_bug: false,
      normalize_reference_strength_multiple: true,
      decrisper: false,
      sm: false,
      sm_dyn: false,
      ucPreset: 4,
      uc: negativePrompt,
      inpaintImg2ImgStrength: 1,
      skip_cfg_above_sigma: null,
    };

    // V4+ models require v4_prompt and v4_negative_prompt
    if (isV4Plus(model)) {
      parameters.v4_prompt = {
        caption: {
          base_caption: prompt,
          char_captions: [],
        },
        use_coords: false,
        use_order: true,
      };
      parameters.v4_negative_prompt = {
        caption: {
          base_caption: negativePrompt,
          char_captions: [],
        },
      };
    }

    const response = await fetch('https://image.novelai.net/ai/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        action: 'generate',
        input: prompt,
        model,
        parameters,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`NovelAI API error (${response.status}): ${errorText || response.statusText}`);
    }

    const zipBuffer = new Uint8Array(await response.arrayBuffer());
    const unzipped = unzipSync(zipBuffer);

    const imageFile = Object.keys(unzipped).find((name) =>
      /\.(png|jpg|jpeg|webp)$/i.test(name),
    );

    if (!imageFile) {
      throw new Error('No image found in NovelAI response (zip contained: ' + Object.keys(unzipped).join(', ') + ')');
    }

    return unzipped[imageFile].buffer as ArrayBuffer;
  }

  return {
    id: 'novelai',
    name: 'NovelAI',
    requiredConfig,
    generateImage,
  };
}
