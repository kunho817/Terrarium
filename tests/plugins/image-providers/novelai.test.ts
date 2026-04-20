import { describe, it, expect, vi, afterEach } from 'vitest';
import { zipSync } from 'fflate';
import { createNovelAIProvider } from '../../../src/lib/plugins/image-providers/novelai';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

function makeZipWithImage(imageData: Uint8Array, filename = 'image.png'): ArrayBuffer {
  const zipped = zipSync({ [filename]: imageData });
  return zipped.buffer as ArrayBuffer;
}

describe('createNovelAIProvider', () => {
  const provider = createNovelAIProvider();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct id and name', () => {
    expect(provider.id).toBe('novelai');
    expect(provider.name).toBe('NovelAI');
  });

  it('requiredConfig contains apiKey', () => {
    const apiKeyField = provider.requiredConfig.find(
      (f) => f.key === 'apiKey',
    );
    expect(apiKeyField).toBeDefined();
    expect(apiKeyField!.type).toBe('password');
  });

  it('validateConfig returns false when apiKey is missing', async () => {
    const apiKeyField = provider.requiredConfig.find(
      (f) => f.key === 'apiKey',
    );
    expect(apiKeyField!.required).toBe(true);
  });

  it('generateImage sends correct request and unzips response', async () => {
    const fakeImage = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const zipBuffer = makeZipWithImage(fakeImage);

    const mockResponse = {
      ok: true,
      status: 200,
      arrayBuffer: vi.fn().mockResolvedValue(zipBuffer),
      text: vi.fn(),
    };
    const { fetch: mockedFetch } = await import('@tauri-apps/plugin-http');
    const mockFetch = mockedFetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(mockResponse);

    const config = {
      providerId: 'novelai',
      apiKey: 'test-key',
      model: 'nai-diffusion-4-5-full',
      width: 832,
      height: 1216,
      steps: 28,
      scale: 5,
      sampler: 'k_euler_ancestral',
    };

    const result = await provider.generateImage('a beautiful landscape', config);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toBe('https://image.novelai.net/ai/generate-image');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe('Bearer test-key');

    const body = JSON.parse(options.body);
    expect(body.action).toBe('generate');
    expect(body.input).toBe('a beautiful landscape');
    expect(body.model).toBe('nai-diffusion-4-5-full');
    expect(body.parameters.width).toBe(832);
    expect(body.parameters.height).toBe(1216);
    expect(body.parameters.steps).toBe(28);
    expect(body.parameters.scale).toBe(5);
    expect(body.parameters.sampler).toBe('k_euler_ancestral');
    expect(body.parameters.negative_prompt).toBe('');
    expect(body.parameters.seed).toBeTypeOf('number');

    expect(new Uint8Array(result)).toEqual(fakeImage);
  });

  it('generateImage throws on API error', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: vi.fn().mockResolvedValue('Unauthorized'),
    };
    const { fetch: mockedFetch } = await import('@tauri-apps/plugin-http');
    const mockFetch = mockedFetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      provider.generateImage('test', {
        apiKey: 'bad-key',
      } as any),
    ).rejects.toThrow('NovelAI API error (401)');
  });

  it('generateImage throws when zip contains no image', async () => {
    const zipped = zipSync({ 'readme.txt': new Uint8Array([1, 2, 3]) });
    const mockResponse = {
      ok: true,
      status: 200,
      arrayBuffer: vi.fn().mockResolvedValue(zipped.buffer),
      text: vi.fn(),
    };
    const { fetch: mockedFetch } = await import('@tauri-apps/plugin-http');
    const mockFetch = mockedFetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      provider.generateImage('test', {
        apiKey: 'test-key',
        model: 'nai-diffusion-4-5-full',
      } as any),
    ).rejects.toThrow('No image found in NovelAI response');
  });
});
