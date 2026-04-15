import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateMetadata,
  validateCapabilities,
  validateBasePlugin,
  validateAIProvider,
  validateCardFormat,
  validateImageProvider,
  validatePromptBuilder,
  validatePlugin,
} from '$lib/plugins/plugin-validator';
import type {
  BasePlugin,
  AIProvider,
  CardFormat,
  ImageProvider,
  PromptBuilder,
} from '$lib/plugins/plugin-interface';

// Valid mock metadata
const validMetadata = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: 'Test Author',
};

// Valid mock capabilities
const validCapabilities = {
  canConfigure: true,
  canImport: false,
  canExport: false,
};

// Helper to create valid base plugin
function createValidBasePlugin(): BasePlugin {
  return {
    metadata: validMetadata,
    capabilities: validCapabilities,
    initialize: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Plugin Validator', () => {
  describe('validateMetadata', () => {
    it('accepts valid metadata', () => {
      const result = validateMetadata(validMetadata);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('test-plugin');
        expect(result.data.name).toBe('Test Plugin');
      }
    });

    it('rejects missing id', () => {
      const result = validateMetadata({ ...validMetadata, id: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.field).toBe('metadata');
      }
    });

    it('rejects missing name', () => {
      const result = validateMetadata({ ...validMetadata, name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('name');
      }
    });

    it('rejects invalid version format', () => {
      const result = validateMetadata({ ...validMetadata, version: 'invalid' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('semantic versioning');
      }
    });

    it('accepts valid semver with pre-release', () => {
      const result = validateMetadata({ ...validMetadata, version: '1.0.0-beta.1' });
      expect(result.success).toBe(true);
    });

    it('rejects non-object metadata', () => {
      const result = validateMetadata(null);
      expect(result.success).toBe(false);
    });
  });

  describe('validateCapabilities', () => {
    it('accepts valid capabilities', () => {
      const result = validateCapabilities(validCapabilities);
      expect(result.success).toBe(true);
    });

    it('rejects missing boolean fields', () => {
      const result = validateCapabilities({ canConfigure: true, canImport: 'yes' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('canImport');
      }
    });

    it('rejects non-object capabilities', () => {
      const result = validateCapabilities(null);
      expect(result.success).toBe(false);
    });
  });

  describe('validateBasePlugin', () => {
    it('accepts valid base plugin', () => {
      const plugin = createValidBasePlugin();
      const result = validateBasePlugin(plugin);
      expect(result.success).toBe(true);
    });

    it('rejects missing metadata', () => {
      const plugin = { ...createValidBasePlugin(), metadata: undefined };
      const result = validateBasePlugin(plugin);
      expect(result.success).toBe(false);
    });

    it('rejects missing capabilities', () => {
      const plugin = { ...createValidBasePlugin(), capabilities: undefined };
      const result = validateBasePlugin(plugin);
      expect(result.success).toBe(false);
    });

    it('rejects missing initialize method', () => {
      const plugin = { ...createValidBasePlugin(), initialize: undefined };
      const result = validateBasePlugin(plugin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('initialize');
      }
    });

    it('rejects missing dispose method', () => {
      const plugin = { ...createValidBasePlugin(), dispose: undefined };
      const result = validateBasePlugin(plugin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('dispose');
      }
    });

    it('rejects non-object plugin', () => {
      const result = validateBasePlugin(null);
      expect(result.success).toBe(false);
    });
  });

  describe('validateAIProvider', () => {
    it('accepts valid AI provider', () => {
      const provider: AIProvider = {
        ...createValidBasePlugin(),
        capabilities: {
          ...validCapabilities,
          supportsStreaming: true,
          supportsImages: false,
          supportsToolUse: false,
          supportsSystemPrompt: true,
        },
        validateConfig: vi.fn(),
        sendMessage: vi.fn(),
      };
      const result = validateAIProvider(provider);
      expect(result.success).toBe(true);
    });

    it('rejects missing validateConfig', () => {
      const provider = {
        ...createValidBasePlugin(),
        capabilities: { supportsStreaming: true },
        sendMessage: vi.fn(),
      };
      const result = validateAIProvider(provider as AIProvider);
      expect(result.success).toBe(false);
    });

    it('rejects missing sendMessage', () => {
      const provider = {
        ...createValidBasePlugin(),
        capabilities: { supportsStreaming: true },
        validateConfig: vi.fn(),
      };
      const result = validateAIProvider(provider as AIProvider);
      expect(result.success).toBe(false);
    });

    it('rejects missing capabilities', () => {
      const provider = {
        ...createValidBasePlugin(),
        validateConfig: vi.fn(),
        sendMessage: vi.fn(),
      };
      const result = validateAIProvider(provider as AIProvider);
      expect(result.success).toBe(false);
    });
  });

  describe('validateCardFormat', () => {
    it('accepts valid card format', () => {
      const format: CardFormat = {
        ...createValidBasePlugin(),
        capabilities: {
          ...validCapabilities,
          supportsImport: true,
          supportsExport: true,
          supportsMultipleCards: false,
        },
        detectFormat: vi.fn(),
        import: vi.fn(),
        export: vi.fn(),
        getFileExtensions: vi.fn().mockReturnValue(['.json']),
      };
      const result = validateCardFormat(format);
      expect(result.success).toBe(true);
    });

    it('rejects missing detectFormat', () => {
      const format = {
        ...createValidBasePlugin(),
        capabilities: { supportsImport: true },
        import: vi.fn(),
        export: vi.fn(),
      };
      const result = validateCardFormat(format as CardFormat);
      expect(result.success).toBe(false);
    });

    it('rejects missing getFileExtensions', () => {
      const format = {
        ...createValidBasePlugin(),
        capabilities: { supportsImport: true, supportsExport: true },
        detectFormat: vi.fn(),
        import: vi.fn(),
        export: vi.fn(),
      };
      const result = validateCardFormat(format as CardFormat);
      expect(result.success).toBe(false);
    });
  });

  describe('validateImageProvider', () => {
    it('accepts valid image provider', () => {
      const provider: ImageProvider = {
        ...createValidBasePlugin(),
        capabilities: {
          ...validCapabilities,
          supportsNegativePrompt: true,
          supportsImg2Img: false,
          supportsControlNet: false,
          supportedSizes: [{ width: 512, height: 512 }],
        },
        validateConfig: vi.fn(),
        generateImage: vi.fn(),
      };
      const result = validateImageProvider(provider);
      expect(result.success).toBe(true);
    });

    it('rejects missing supportedSizes array', () => {
      const provider = {
        ...createValidBasePlugin(),
        capabilities: {
          supportsNegativePrompt: true,
          supportsImg2Img: false,
          supportsControlNet: false,
        },
        validateConfig: vi.fn(),
        generateImage: vi.fn(),
      };
      const result = validateImageProvider(provider as ImageProvider);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('supportedSizes');
      }
    });
  });

  describe('validatePromptBuilder', () => {
    it('accepts valid prompt builder', () => {
      const builder: PromptBuilder = {
        ...createValidBasePlugin(),
        buildPrompt: vi.fn(),
        getTemplateVariables: vi.fn().mockReturnValue(['name', 'description']),
      };
      const result = validatePromptBuilder(builder);
      expect(result.success).toBe(true);
    });

    it('rejects missing buildPrompt', () => {
      const builder = {
        ...createValidBasePlugin(),
        getTemplateVariables: vi.fn(),
      };
      const result = validatePromptBuilder(builder as PromptBuilder);
      expect(result.success).toBe(false);
    });

    it('rejects missing getTemplateVariables', () => {
      const builder = {
        ...createValidBasePlugin(),
        buildPrompt: vi.fn(),
      };
      const result = validatePromptBuilder(builder as PromptBuilder);
      expect(result.success).toBe(false);
    });
  });

  describe('validatePlugin', () => {
    it('validates provider plugin', async () => {
      const provider: AIProvider = {
        ...createValidBasePlugin(),
        capabilities: {
          ...validCapabilities,
          supportsStreaming: true,
          supportsImages: false,
          supportsToolUse: false,
          supportsSystemPrompt: true,
        },
        validateConfig: vi.fn(),
        sendMessage: vi.fn(),
      };
      const result = await validatePlugin<AIProvider>(provider, 'provider');
      expect(result.success).toBe(true);
    });

    it('validates card format plugin', async () => {
      const format: CardFormat = {
        ...createValidBasePlugin(),
        capabilities: {
          ...validCapabilities,
          supportsImport: true,
          supportsExport: true,
          supportsMultipleCards: false,
        },
        detectFormat: vi.fn(),
        import: vi.fn(),
        export: vi.fn(),
        getFileExtensions: vi.fn(),
      };
      const result = await validatePlugin<CardFormat>(format, 'cardFormat');
      expect(result.success).toBe(true);
    });

    it('returns error for invalid base plugin', async () => {
      const invalid = { metadata: validMetadata }; // Missing methods
      const result = await validatePlugin(invalid, 'provider');
      expect(result.success).toBe(false);
    });
  });
});
