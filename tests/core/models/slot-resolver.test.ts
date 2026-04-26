import { describe, expect, it } from 'vitest';
import { applyProviderDefaults, resolveSlotConfig } from '$lib/core/models/slot-resolver';
import type { AppSettings } from '$lib/storage/settings';

describe('resolveSlotConfig', () => {
  const baseSettings: AppSettings = {
    defaultProvider: 'chat-provider',
    theme: 'default',
    providers: {
      'chat-provider': {
        apiKey: 'chat-provider-key',
        model: 'chat-provider-model',
        baseUrl: 'https://chat-provider.example/v1',
        temperature: 0.7,
        maxTokens: 4096,
      },
      'memory-provider': {
        apiKey: 'memory-provider-key',
        model: 'memory-provider-model',
        baseUrl: 'https://memory-provider.example/v1',
        temperature: 0.2,
        maxTokens: 8192,
      },
    },
    modelProfiles: {
      memory: {
        id: 'memory',
        name: 'Memory Card',
        provider: 'memory-provider',
        model: '',
      },
    },
    modelSlots: {
      memory: {
        profileId: 'memory',
      },
    },
    memorySettings: {
      extractionBatchSize: 5,
      tokenBudget: 4096,
      topK: 15,
      summaryThreshold: 50,
      embeddingProvider: '',
      embeddingApiKey: '',
      embeddingModel: '',
    },
    outputLanguage: '',
    responseLengthTier: 'standard',
    agentSettings: {
      enabled: true,
      jailbreak: '',
      turnMaintenance: { enabled: true, contextMessages: 20, tokenBudget: 2048, timeoutMs: 240000 },
      extraction: { enabled: true, tokenBudget: 1024, repairAttempts: 2 },
      director: { mode: 'light' },
      worldMode: {
        extractEntities: true,
        extractRelations: true,
        sectionWorldInjection: true,
      },
    },
  };

  it('prefers the assigned provider defaults over the chat config when slot fields are blank', () => {
    const resolved = resolveSlotConfig(baseSettings, ['memory'], {
      providerId: 'chat-provider',
      apiKey: 'chat-config-key',
      model: 'chat-config-model',
      baseUrl: 'https://chat-config.example/v1',
      temperature: 0.9,
      maxTokens: 2048,
    });

    expect(resolved.provider).toBe('memory-provider');
    expect(resolved.apiKey).toBe('memory-provider-key');
    expect(resolved.model).toBe('memory-provider-model');
    expect(resolved.baseUrl).toBe('https://memory-provider.example/v1');
    expect(resolved.temperature).toBe(0.2);
    expect(resolved.maxTokens).toBe(8192);
  });

  it('still falls back to chat config when the slot provider has no configured defaults', () => {
    const settings: AppSettings = {
      ...baseSettings,
      modelProfiles: {
        memory: {
          id: 'memory',
          name: 'Memory Card',
          provider: 'unconfigured-provider',
          model: '',
        },
      },
    };

    const resolved = resolveSlotConfig(settings, ['memory'], {
      providerId: 'chat-provider',
      apiKey: 'chat-config-key',
      model: 'chat-config-model',
      baseUrl: 'https://chat-config.example/v1',
      temperature: 0.9,
      maxTokens: 2048,
    });

    expect(resolved.provider).toBe('unconfigured-provider');
    expect(resolved.apiKey).toBe('chat-config-key');
    expect(resolved.model).toBe('chat-config-model');
    expect(resolved.baseUrl).toBe('https://chat-config.example/v1');
    expect(resolved.temperature).toBe(0.9);
    expect(resolved.maxTokens).toBe(2048);
  });

  it('backfills final config from the final provider defaults after later overrides', () => {
    const hydrated = applyProviderDefaults(baseSettings, {
      providerId: 'memory-provider',
      model: 'memory-provider-model',
    });

    expect(hydrated.providerId).toBe('memory-provider');
    expect(hydrated.apiKey).toBe('memory-provider-key');
    expect(hydrated.baseUrl).toBe('https://memory-provider.example/v1');
    expect(hydrated.temperature).toBe(0.2);
    expect(hydrated.maxTokens).toBe(8192);
  });
});
