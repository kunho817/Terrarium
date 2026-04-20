/**
 * Plugin registry — central hub for registering and retrieving plugins.
 * Spec reference: Section 3.6 — Plugin Registry
 */

import type {
  ProviderPlugin,
  CardFormatPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
} from '$lib/types/plugin';

export class PluginRegistry {
  private providers = new Map<string, ProviderPlugin>();
  private cardFormatsById = new Map<string, CardFormatPlugin>();
  private cardFormatsByExtension = new Map<string, CardFormatPlugin>();
  private imageProviders = new Map<string, ImageProviderPlugin>();
  private promptBuilders = new Map<string, PromptBuilderPlugin>();

  // === Provider ===

  registerProvider(plugin: ProviderPlugin): void {
    if (this.providers.has(plugin.id)) {
      throw new Error(`Provider plugin "${plugin.id}" is already registered`);
    }
    this.providers.set(plugin.id, plugin);
  }

  getProvider(id: string): ProviderPlugin {
    const plugin = this.providers.get(id);
    if (!plugin) {
      throw new Error(`Provider plugin "${id}" not found`);
    }
    return plugin;
  }

  listProviders(): ProviderPlugin[] {
    return Array.from(this.providers.values());
  }

  // === Card Format ===

  registerCardFormat(plugin: CardFormatPlugin): void {
    if (this.cardFormatsById.has(plugin.id)) {
      throw new Error(`Card format plugin "${plugin.id}" is already registered`);
    }
    this.cardFormatsById.set(plugin.id, plugin);
    for (const ext of plugin.supportedExtensions) {
      const existing = this.cardFormatsByExtension.get(ext);
      if (existing) {
        throw new Error(
          `Card format plugin "${plugin.id}" conflicts on extension "${ext}" ` +
          `(already registered by "${existing.id}")`
        );
      }
      this.cardFormatsByExtension.set(ext, plugin);
    }
  }

  getCardFormat(idOrExtension: string): CardFormatPlugin {
    const byId = this.cardFormatsById.get(idOrExtension);
    if (byId) return byId;

    const byExt = this.cardFormatsByExtension.get(idOrExtension);
    if (byExt) return byExt;

    throw new Error(`Card format plugin "${idOrExtension}" not found`);
  }

  listCardFormats(): CardFormatPlugin[] {
    return Array.from(this.cardFormatsById.values());
  }

  // === Image Provider ===

  registerImageProvider(plugin: ImageProviderPlugin): void {
    if (this.imageProviders.has(plugin.id)) {
      throw new Error(`Image provider plugin "${plugin.id}" is already registered`);
    }
    this.imageProviders.set(plugin.id, plugin);
  }

  getImageProvider(id: string): ImageProviderPlugin {
    const plugin = this.imageProviders.get(id);
    if (!plugin) {
      throw new Error(`Image provider plugin "${id}" not found`);
    }
    return plugin;
  }

  listImageProviders(): ImageProviderPlugin[] {
    return Array.from(this.imageProviders.values());
  }

  // === Prompt Builder ===

  registerPromptBuilder(plugin: PromptBuilderPlugin): void {
    if (this.promptBuilders.has(plugin.id)) {
      throw new Error(`Prompt builder plugin "${plugin.id}" is already registered`);
    }
    this.promptBuilders.set(plugin.id, plugin);
  }

  getPromptBuilder(id: string): PromptBuilderPlugin {
    const plugin = this.promptBuilders.get(id);
    if (!plugin) {
      throw new Error(`Prompt builder plugin "${id}" not found`);
    }
    return plugin;
  }

  listPromptBuilders(): PromptBuilderPlugin[] {
    return Array.from(this.promptBuilders.values());
  }
}
