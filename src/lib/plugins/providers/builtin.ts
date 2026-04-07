/**
 * Registers all built-in AI provider plugins with a PluginRegistry.
 */

import type { PluginRegistry } from '$lib/plugins/registry';
import { createOpenAICompatibleProvider } from './openai-compatible';
import { createClaudeProvider } from './claude';

export function registerBuiltinProviders(registry: PluginRegistry): void {
  // Priority order: NanoGPT → OpenAI → Claude → Local LLM

  registry.registerProvider(
    createOpenAICompatibleProvider({
      id: 'nanogpt',
      name: 'NanoGPT',
      defaultBaseUrl: 'https://api.nanogpt.io/v1',
      requiresApiKey: true,
    })
  );

  registry.registerProvider(
    createOpenAICompatibleProvider({
      id: 'openai',
      name: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      requiresApiKey: true,
    })
  );

  registry.registerProvider(createClaudeProvider());

  registry.registerProvider(
    createOpenAICompatibleProvider({
      id: 'local-llm',
      name: 'Local LLM',
      defaultBaseUrl: 'http://localhost:11434/v1',
      requiresApiKey: false,
    })
  );
}
