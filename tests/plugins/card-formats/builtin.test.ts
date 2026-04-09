import { describe, it, expect } from 'vitest';
import { registerBuiltinCardFormats } from '$lib/plugins/card-formats/builtin';
import { PluginRegistry } from '$lib/plugins/registry';

describe('registerBuiltinCardFormats', () => {
  it('registers all 3 built-in card formats', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const formats = registry.listCardFormats();
    expect(formats).toHaveLength(3);

    const ids = formats.map((f) => f.id).sort();
    expect(ids).toEqual(['generic-json', 'risuai', 'sillytavern']);
  });

  it('registers risuai with .json extension', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const byExt = registry.getCardFormat('.json');
    expect(byExt.id).toBe('risuai');
  });

  it('registers generic-json with .tcjson extension', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const byExt = registry.getCardFormat('.tcjson');
    expect(byExt.id).toBe('generic-json');
  });

  it('retrieves sillytavern by id', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    const st = registry.getCardFormat('sillytavern');
    expect(st.name).toBe('SillyTavern');
  });

  it('throws on duplicate registration', () => {
    const registry = new PluginRegistry();
    registerBuiltinCardFormats(registry);

    expect(() => registerBuiltinCardFormats(registry)).toThrow('already registered');
  });
});
