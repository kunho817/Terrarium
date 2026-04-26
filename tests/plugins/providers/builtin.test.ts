import { describe, it, expect } from 'vitest';
import { registerBuiltinProviders } from '$lib/plugins/providers/builtin';
import { PluginRegistry } from '$lib/plugins/registry';

describe('registerBuiltinProviders', () => {
  it('registers all 6 built-in providers', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const providers = registry.listProviders();
    expect(providers).toHaveLength(6);

    const ids = providers.map((p) => p.id).sort();
    expect(ids).toEqual(['claude', 'fireworks', 'local-llm', 'nanogpt', 'openai', 'opencode-go']);
  });

  it('registers nanogpt provider with correct defaults', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const nanogpt = registry.getProvider('nanogpt');
    expect(nanogpt.name).toBe('NanoGPT');
  });

  it('registers openai provider', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const openai = registry.getProvider('openai');
    expect(openai.name).toBe('OpenAI');
  });

  it('registers claude provider', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const claude = registry.getProvider('claude');
    expect(claude.name).toBe('Claude');
  });

  it('registers OpenCode Go provider', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const provider = registry.getProvider('opencode-go');
    expect(provider.name).toBe('OpenCode Go');
  });

  it('registers local-llm provider without api key requirement', async () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    const local = registry.getProvider('local-llm');
    expect(local.name).toBe('Local LLM');
    expect(await local.validateConfig({ providerId: 'local-llm' })).toBe(true);
  });

  it('does not register duplicates on multiple calls', () => {
    const registry = new PluginRegistry();
    registerBuiltinProviders(registry);

    expect(() => registerBuiltinProviders(registry)).toThrow('already registered');
  });
});
