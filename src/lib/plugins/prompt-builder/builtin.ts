/**
 * Registers built-in prompt builder plugins with a PluginRegistry.
 */

import type { PluginRegistry } from '$lib/plugins/registry';
import { defaultPromptBuilder } from './default';

export function registerBuiltinPromptBuilders(registry: PluginRegistry): void {
  registry.registerPromptBuilder(defaultPromptBuilder);
}
