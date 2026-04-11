import type { ImageProviderPlugin } from '../../types/plugin';
import type { UserConfig, ConfigField } from '../../types/config';

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

  async function generateImage(
    prompt: string,
    config: UserConfig,
  ): Promise<ArrayBuffer> {
    const apiKey = config.apiKey as string;
    const model = (config.model as string) || 'nai-diffusion-4-5-full';
    const width = (config.width as number) ?? 832;
    const height = (config.height as number) ?? 1216;
    const steps = (config.steps as number) ?? 28;
    const scale = (config.scale as number) ?? 5;
    const sampler = (config.sampler as string) || 'k_euler_ancestral';
    const negativePrompt = (config.negativePrompt as string) || '';
    const seed = Math.floor(Math.random() * 2 ** 32);

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
        parameters: {
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
          noise_schedule: 'native',
          legacy_v3_extend: false,
          seed,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`NovelAI API error (${response.status})`);
    }

    return response.arrayBuffer();
  }

  return {
    id: 'novelai',
    name: 'NovelAI',
    requiredConfig,
    generateImage,
  };
}
