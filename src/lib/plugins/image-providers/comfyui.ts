/**
 * ComfyUI image provider factory.
 * Submits a user-defined workflow JSON to a local ComfyUI instance,
 * polls for completion, and returns the generated image.
 */

import type { ImageProviderPlugin } from '$lib/types/plugin';
import type { UserConfig, ConfigField } from '$lib/types/config';

/**
 * Walk every node in a ComfyUI workflow object, applying a replacer
 * to all string values. Returns a deep-cloned workflow.
 */
function walkAndReplace(
  workflow: Record<string, unknown>,
  replacer: (value: string) => string,
): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(workflow)) {
    const val = workflow[key];
    if (typeof val === 'string') {
      clone[key] = replacer(val);
    } else if (Array.isArray(val)) {
      clone[key] = val.map((item) =>
        typeof item === 'object' && item !== null
          ? walkAndReplace(item as Record<string, unknown>, replacer)
          : typeof item === 'string'
            ? replacer(item)
            : item,
      );
    } else if (typeof val === 'object' && val !== null) {
      clone[key] = walkAndReplace(val as Record<string, unknown>, replacer);
    } else {
      clone[key] = val;
    }
  }
  return clone;
}

/**
 * Walk every node and randomize any field named "seed" (or ending in "_seed")
 * to a random 32-bit integer.
 */
function randomizeSeeds(
  workflow: Record<string, unknown>,
): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(workflow)) {
    const val = workflow[key];
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      clone[key] = randomizeSeeds(val as Record<string, unknown>);
    } else if (
      (key === 'seed' || key.endsWith('_seed')) &&
      typeof val === 'number'
    ) {
      clone[key] = Math.floor(Math.random() * 2147483647);
    } else {
      clone[key] = val;
    }
  }
  return clone;
}

/**
 * Deep-walk a workflow object and apply placeholder replacement + seed randomization.
 */
function prepareWorkflow(
  raw: Record<string, unknown>,
  prompt: string,
  negativePrompt: string,
): Record<string, unknown> {
  let workflow = walkAndReplace(raw, (v) =>
    v
      .replaceAll('{{risu_prompt}}', prompt)
      .replaceAll('{{risu_neg}}', negativePrompt),
  );
  workflow = randomizeSeeds(workflow);
  return workflow;
}

export function createComfyUIProvider(): ImageProviderPlugin {
  const requiredConfig: ConfigField[] = [
    {
      key: 'comfyuiUrl',
      label: 'ComfyUI URL',
      type: 'text',
      defaultValue: 'http://localhost:8188',
    },
    {
      key: 'comfyuiWorkflow',
      label: 'Workflow JSON',
      type: 'text',
      defaultValue: '',
    },
    {
      key: 'comfyuiTimeout',
      label: 'Timeout (seconds)',
      type: 'number',
      defaultValue: 60,
    },
  ];

  return {
    id: 'comfyui',
    name: 'ComfyUI',
    requiredConfig,

    validateConfig(_config: UserConfig): Promise<boolean> {
      return Promise.resolve(true);
    },

    async generateImage(prompt: string, config: UserConfig): Promise<ArrayBuffer> {
      const url = ((config.comfyuiUrl as string) || 'http://localhost:8188').replace(/\/$/, '');
      const timeoutSeconds = (config.comfyuiTimeout as number) ?? 60;
      const negativePrompt = (config.negativePrompt as string) || '';

      // 1. Parse workflow JSON
      let rawWorkflow: Record<string, unknown>;
      try {
        rawWorkflow = JSON.parse((config.comfyuiWorkflow as string) || '{}');
      } catch {
        throw new Error('ComfyUI workflow is not valid JSON');
      }

      // 2-3. Replace placeholders and randomize seeds
      const workflow = prepareWorkflow(rawWorkflow, prompt, negativePrompt);

      // 4. POST to /prompt
      const submitResponse = await fetch(`${url}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!submitResponse.ok) {
        throw new Error(
          `ComfyUI submit error (${submitResponse.status}): ${submitResponse.statusText}`,
        );
      }

      const submitData = await submitResponse.json();
      const promptId = submitData.prompt_id as string;

      // 5-6. Poll /history/{prompt_id}
      const deadline = Date.now() + timeoutSeconds * 1000;

      let historyData: Record<string, unknown> | null = null;
      while (Date.now() < deadline) {
        const historyResponse = await fetch(`${url}/history/${promptId}`);
        if (historyResponse.ok) {
          const data = await historyResponse.json();
          if (data[promptId]) {
            historyData = data[promptId] as Record<string, unknown>;
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!historyData) {
        throw new Error('ComfyUI image generation timed out');
      }

      // 7. Extract first image from outputs
      const outputs = historyData.outputs as Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>;
      const images = Object.values(outputs).flatMap((o) => o.images ?? []);
      const image = images[0];

      if (!image) {
        throw new Error('ComfyUI returned no images');
      }

      // 8-9. GET /view to retrieve image
      const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder ?? '',
        type: image.type ?? 'output',
      });

      const imageResponse = await fetch(`${url}/view?${params.toString()}`);
      if (!imageResponse.ok) {
        throw new Error(
          `ComfyUI image fetch error (${imageResponse.status}): ${imageResponse.statusText}`,
        );
      }

      return imageResponse.arrayBuffer();
    },
  };
}
