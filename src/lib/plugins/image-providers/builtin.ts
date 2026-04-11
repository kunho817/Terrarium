import type { PluginRegistry } from '$lib/plugins/registry';
import { createNovelAIProvider } from './novelai';
import { createComfyUIProvider } from './comfyui';

export function registerBuiltinImageProviders(registry: PluginRegistry): void {
  registry.registerImageProvider(createNovelAIProvider());
  registry.registerImageProvider(createComfyUIProvider());
}