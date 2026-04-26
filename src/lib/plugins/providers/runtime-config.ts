import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import type { UserConfig } from '$lib/types';

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

export function hydrateProviderRuntimeConfig(
  config: UserConfig,
  providerId?: string,
  fallbackBaseUrl?: string,
): UserConfig {
  const settings = get(settingsStore);
  const resolvedProviderId = providerId || config.providerId || settings.defaultProvider || '';
  const providerDefaults = resolvedProviderId
    ? (settings.providers?.[resolvedProviderId] as Record<string, unknown> | undefined)
    : undefined;

  return {
    ...config,
    providerId: resolvedProviderId,
    apiKey: pickFirst(
      config.apiKey as string | undefined,
      providerDefaults?.apiKey as string | undefined,
    ),
    baseUrl: pickFirst(
      config.baseUrl as string | undefined,
      providerDefaults?.baseUrl as string | undefined,
      fallbackBaseUrl,
    ),
    model: pickFirst(
      config.model as string | undefined,
      providerDefaults?.model as string | undefined,
    ),
    temperature:
      (config.temperature as number | undefined)
      ?? (providerDefaults?.temperature as number | undefined),
    maxTokens:
      (config.maxTokens as number | undefined)
      ?? (providerDefaults?.maxTokens as number | undefined),
  };
}
