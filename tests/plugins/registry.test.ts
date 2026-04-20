import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '$lib/plugins/registry';
import type {
  ProviderPlugin,
  CardFormatPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
  ChatContext,
} from '$lib/types/plugin';
import type { CharacterCard } from '$lib/types/character';

function createMockProvider(overrides?: Partial<ProviderPlugin>): ProviderPlugin {
  return {
    id: 'test-provider',
    name: 'Test Provider',
    requiredConfig: [],
    async *chat() {
      yield 'test';
    },
    async *chatWithCard() {
      yield 'test';
    },
    async validateConfig() {
      return true;
    },
    ...overrides,
  };
}

function createMockCardFormat(overrides?: Partial<CardFormatPlugin>): CardFormatPlugin {
  return {
    id: 'test-format',
    name: 'Test Format',
    supportedExtensions: ['.json'],
    parse() {
      return {} as CharacterCard;
    },
    export() {
      return new ArrayBuffer(0);
    },
    validate() {
      return true;
    },
    ...overrides,
  };
}

function createMockImageProvider(overrides?: Partial<ImageProviderPlugin>): ImageProviderPlugin {
  return {
    id: 'test-image-provider',
    name: 'Test Image Provider',
    requiredConfig: [],
    async generateImage() {
      return new ArrayBuffer(0);
    },
    ...overrides,
  };
}

describe('PluginRegistry', () => {
  // === ProviderPlugin ===
  describe('providers', () => {
    it('registers and retrieves a provider by id', () => {
      const registry = new PluginRegistry();
      const provider = createMockProvider();
      registry.registerProvider(provider);
      expect(registry.getProvider('test-provider')).toBe(provider);
    });

    it('throws when registering a duplicate provider', () => {
      const registry = new PluginRegistry();
      registry.registerProvider(createMockProvider());
      expect(() => registry.registerProvider(createMockProvider())).toThrow(
        'already registered'
      );
    });

    it('throws when retrieving a non-existent provider', () => {
      const registry = new PluginRegistry();
      expect(() => registry.getProvider('nonexistent')).toThrow('not found');
    });

    it('lists all registered providers', () => {
      const registry = new PluginRegistry();
      const p1 = createMockProvider({ id: 'p1', name: 'P1' });
      const p2 = createMockProvider({ id: 'p2', name: 'P2' });
      registry.registerProvider(p1);
      registry.registerProvider(p2);
      const list = registry.listProviders();
      expect(list).toHaveLength(2);
      expect(list).toContain(p1);
      expect(list).toContain(p2);
    });
  });

  // === CardFormatPlugin ===
  describe('card formats', () => {
    it('registers and retrieves by id', () => {
      const registry = new PluginRegistry();
      const format = createMockCardFormat();
      registry.registerCardFormat(format);
      expect(registry.getCardFormat('test-format')).toBe(format);
    });

    it('retrieves by file extension', () => {
      const registry = new PluginRegistry();
      const format = createMockCardFormat({
        supportedExtensions: ['.json', '.png'],
      });
      registry.registerCardFormat(format);
      expect(registry.getCardFormat('.json')).toBe(format);
      expect(registry.getCardFormat('.png')).toBe(format);
    });

    it('throws when registering a duplicate card format', () => {
      const registry = new PluginRegistry();
      registry.registerCardFormat(createMockCardFormat());
      expect(() => registry.registerCardFormat(createMockCardFormat())).toThrow(
        'already registered'
      );
    });

    it('throws when retrieving a non-existent card format', () => {
      const registry = new PluginRegistry();
      expect(() => registry.getCardFormat('.xml')).toThrow('not found');
    });

    it('throws when two plugins register the same extension', () => {
      const registry = new PluginRegistry();
      const f1 = createMockCardFormat({ id: 'f1', name: 'F1', supportedExtensions: ['.json'] });
      const f2 = createMockCardFormat({ id: 'f2', name: 'F2', supportedExtensions: ['.json'] });
      registry.registerCardFormat(f1);
      expect(() => registry.registerCardFormat(f2)).toThrow('conflicts on extension');
    });

    it('lists all registered card formats', () => {
      const registry = new PluginRegistry();
      const f1 = createMockCardFormat({ id: 'f1', name: 'F1' });
      const f2 = createMockCardFormat({
        id: 'f2',
        name: 'F2',
        supportedExtensions: ['.png'],
      });
      registry.registerCardFormat(f1);
      registry.registerCardFormat(f2);
      expect(registry.listCardFormats()).toHaveLength(2);
    });
  });

  // === ImageProviderPlugin ===
  describe('image providers', () => {
    it('registers and retrieves an image provider', () => {
      const registry = new PluginRegistry();
      const img = createMockImageProvider();
      registry.registerImageProvider(img);
      expect(registry.getImageProvider('test-image-provider')).toBe(img);
    });

    it('throws when retrieving a non-existent image provider', () => {
      const registry = new PluginRegistry();
      expect(() => registry.getImageProvider('nonexistent')).toThrow('not found');
    });

    it('throws when registering a duplicate image provider', () => {
      const registry = new PluginRegistry();
      registry.registerImageProvider(createMockImageProvider());
      expect(() => registry.registerImageProvider(createMockImageProvider())).toThrow(
        'already registered'
      );
    });

    it('lists all registered image providers', () => {
      const registry = new PluginRegistry();
      registry.registerImageProvider(createMockImageProvider());
      expect(registry.listImageProviders()).toHaveLength(1);
    });
  });

  // === PromptBuilderPlugin ===
  describe('prompt builders', () => {
    it('registers and retrieves a prompt builder', () => {
      const registry = new PluginRegistry();
      const builder = {
        id: 'default-builder',
        name: 'Default Builder',
        buildSystemPrompt: () => '',
        buildContext: () => '',
      };
      registry.registerPromptBuilder(builder);
      expect(registry.getPromptBuilder('default-builder')).toBe(builder);
    });

    it('throws when retrieving a non-existent prompt builder', () => {
      const registry = new PluginRegistry();
      expect(() => registry.getPromptBuilder('nonexistent')).toThrow('not found');
    });

    it('throws when registering a duplicate prompt builder', () => {
      const registry = new PluginRegistry();
      const b = {
        id: 'dup-builder',
        name: 'Dup Builder',
        buildSystemPrompt: () => '',
        buildContext: () => '',
      };
      registry.registerPromptBuilder(b);
      expect(() => registry.registerPromptBuilder({ ...b })).toThrow(
        'already registered'
      );
    });

    it('lists all registered prompt builders', () => {
      const registry = new PluginRegistry();
      const b = {
        id: 'b1',
        name: 'B1',
        buildSystemPrompt: () => '',
        buildContext: () => '',
      };
      registry.registerPromptBuilder(b);
      expect(registry.listPromptBuilders()).toHaveLength(1);
    });
  });
});
