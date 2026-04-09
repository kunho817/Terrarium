import { describe, it, expect } from 'vitest';
import { registerBuiltinPromptBuilders } from '$lib/plugins/prompt-builder/builtin';
import { PluginRegistry } from '$lib/plugins/registry';

describe('registerBuiltinPromptBuilders', () => {
  it('registers default prompt builder', () => {
    const registry = new PluginRegistry();
    registerBuiltinPromptBuilders(registry);

    const builders = registry.listPromptBuilders();
    expect(builders).toHaveLength(1);
    expect(builders[0].id).toBe('default');
  });

  it('can be retrieved by id', () => {
    const registry = new PluginRegistry();
    registerBuiltinPromptBuilders(registry);

    const builder = registry.getPromptBuilder('default');
    expect(builder.name).toBe('Default');
  });

  it('throws on duplicate registration', () => {
    const registry = new PluginRegistry();
    registerBuiltinPromptBuilders(registry);

    expect(() => registerBuiltinPromptBuilders(registry)).toThrow('already registered');
  });
});
