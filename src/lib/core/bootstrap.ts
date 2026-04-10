/**
 * App bootstrap — creates singleton PluginRegistry and ChatEngine.
 * Called once from the root layout on mount.
 */

import { PluginRegistry } from '$lib/plugins/registry';
import { ChatEngine } from '$lib/core/chat/engine';
import { registerBuiltinProviders } from '$lib/plugins/providers/builtin';
import { registerBuiltinCardFormats } from '$lib/plugins/card-formats/builtin';
import { registerBuiltinPromptBuilders } from '$lib/plugins/prompt-builder/builtin';

let _registry: PluginRegistry | null = null;
let _engine: ChatEngine | null = null;

export function getRegistry(): PluginRegistry {
  if (!_registry) {
    _registry = new PluginRegistry();
    registerBuiltinProviders(_registry);
    registerBuiltinCardFormats(_registry);
    registerBuiltinPromptBuilders(_registry);
  }
  return _registry;
}

export function getEngine(): ChatEngine {
  if (!_engine) {
    _engine = new ChatEngine(getRegistry());
  }
  return _engine;
}
