import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComfyUIProvider } from '$lib/plugins/image-providers/comfyui';
import type { UserConfig } from '$lib/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const sampleWorkflow = {
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 123,
      steps: 20,
      cfg: 7,
      sampler_name: 'euler',
      scheduler: 'normal',
      positive: ['6', 0],
      negative: ['7', 0],
    },
  },
  '6': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: '{{risu_prompt}}',
    },
  },
  '7': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: '{{risu_neg}}',
    },
  },
};

const mockConfig: UserConfig = {
  providerId: 'comfyui',
  comfyuiUrl: 'http://localhost:8188',
  comfyuiWorkflow: JSON.stringify(sampleWorkflow),
  comfyuiTimeout: 10,
  negativePrompt: 'bad quality',
};

function makeArrayBuffer(data: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(data).buffer as ArrayBuffer;
}

describe('ComfyUI image provider', () => {
  let provider: ReturnType<typeof createComfyUIProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createComfyUIProvider();
  });

  describe('properties', () => {
    it('has correct id and name', () => {
      expect(provider.id).toBe('comfyui');
      expect(provider.name).toBe('ComfyUI');
    });

    it('has required config fields', () => {
      const keys = provider.requiredConfig.map((f) => f.key);
      expect(keys).toContain('comfyuiUrl');
      expect(keys).toContain('comfyuiWorkflow');
      expect(keys).toContain('comfyuiTimeout');
    });
  });

  describe('validateConfig', () => {
    it('always returns true', async () => {
      expect(await provider.validateConfig({ providerId: 'comfyui' })).toBe(true);
      expect(await provider.validateConfig(mockConfig)).toBe(true);
    });
  });

  describe('generateImage', () => {
    it('replaces placeholders and randomizes seeds in submitted workflow', async () => {
      // Mock: POST /prompt returns prompt_id
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/prompt') && init?.method === 'POST') {
          const body = JSON.parse(init.body as string);
          const workflow = body.prompt;

          // Verify placeholders replaced
          expect(workflow['6'].inputs.text).toBe('a beautiful landscape');
          expect(workflow['7'].inputs.text).toBe('bad quality');

          // Verify seed was randomized (not 123)
          expect(workflow['3'].inputs.seed).not.toBe(123);
          expect(typeof workflow['3'].inputs.seed).toBe('number');

          return {
            ok: true,
            json: async () => ({ prompt_id: 'test-prompt-123' }),
          };
        }

        // Mock: GET /history/{id}
        if (url.includes('/history/')) {
          return {
            ok: true,
            json: async () => ({
              'test-prompt-123': {
                outputs: {
                  '9': {
                    images: [
                      { filename: 'output.png', subfolder: '', type: 'output' },
                    ],
                  },
                },
              },
            }),
          };
        }

        // Mock: GET /view
        if (url.includes('/view?')) {
          return {
            ok: true,
            arrayBuffer: async () => makeArrayBuffer('fake-png-data'),
          };
        }

        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      const result = await provider.generateImage('a beautiful landscape', mockConfig);
      const text = new TextDecoder().decode(result);
      expect(text).toBe('fake-png-data');
    });

    it('uses empty string for negative prompt when not provided', async () => {
      const configNoNeg = { ...mockConfig, negativePrompt: undefined };

      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/prompt') && init?.method === 'POST') {
          const body = JSON.parse(init.body as string);
          expect(body.prompt['7'].inputs.text).toBe('');
          return {
            ok: true,
            json: async () => ({ prompt_id: 'test-prompt-456' }),
          };
        }
        if (url.includes('/history/')) {
          return {
            ok: true,
            json: async () => ({
              'test-prompt-456': {
                outputs: {
                  '9': {
                    images: [
                      { filename: 'out.png', subfolder: '', type: 'output' },
                    ],
                  },
                },
              },
            }),
          };
        }
        if (url.includes('/view?')) {
          return {
            ok: true,
            arrayBuffer: async () => makeArrayBuffer('img'),
          };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      await provider.generateImage('test prompt', configNoNeg);
    });

    it('throws timeout error when generation exceeds timeout', async () => {
      // POST /prompt succeeds
      // GET /history never returns the prompt_id key
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/prompt') && init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({ prompt_id: 'timeout-test' }),
          };
        }
        if (url.includes('/history/')) {
          callCount++;
          // Return empty object so it keeps polling
          return { ok: true, json: async () => ({}) };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      // Use a very short timeout (1 second) to keep test fast
      const shortConfig = { ...mockConfig, comfyuiTimeout: 1 };

      await expect(
        provider.generateImage('test', shortConfig),
      ).rejects.toThrow('ComfyUI image generation timed out');
    });

    it('throws on invalid workflow JSON', async () => {
      const badConfig = { ...mockConfig, comfyuiWorkflow: 'not-json' };
      await expect(
        provider.generateImage('test', badConfig),
      ).rejects.toThrow('ComfyUI workflow is not valid JSON');
    });

    it('throws on submit error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        provider.generateImage('test', mockConfig),
      ).rejects.toThrow('ComfyUI submit error (500)');
    });

    it('throws when no images returned', async () => {
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/prompt') && init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({ prompt_id: 'no-img-test' }),
          };
        }
        if (url.includes('/history/')) {
          return {
            ok: true,
            json: async () => ({
              'no-img-test': {
                outputs: {
                  '9': { images: [] },
                },
              },
            }),
          };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      await expect(
        provider.generateImage('test', mockConfig),
      ).rejects.toThrow('ComfyUI returned no images');
    });
  });
});
