import type { AppSettings } from '$lib/storage/settings';
import type { ModelProfile, ModelSlot, UserConfig } from '$lib/types/config';

export interface ResolvedSlotConfig {
  slot?: ModelSlot;
  profile?: ModelProfile;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

export function resolveSlotConfig(
  settings: AppSettings,
  slotIds: string[],
  chatConfig?: Partial<UserConfig>,
): ResolvedSlotConfig {
  const slots = settings.modelSlots ?? {};
  const fallbackProvider = chatConfig?.providerId || settings.defaultProvider;

  let slot: ModelSlot | undefined;
  for (const slotId of slotIds) {
    const candidate = slots[slotId];
    if (candidate) {
      slot = candidate;
      break;
    }
  }

  const profile = slot?.profileId ? settings.modelProfiles?.[slot.profileId] : undefined;
  const provider = profile?.provider || slot?.provider || fallbackProvider;
  const providerDefaults = provider
    ? (settings.providers?.[provider] as Record<string, unknown> | undefined)
    : undefined;
  const fallbackDefaults = fallbackProvider
    ? (settings.providers?.[fallbackProvider] as Record<string, unknown> | undefined)
    : undefined;

  return {
    slot,
    profile,
    provider,
    apiKey: pickFirst(
      profile?.apiKey,
      slot?.apiKey,
      providerDefaults?.apiKey as string | undefined,
      chatConfig?.apiKey,
      fallbackDefaults?.apiKey as string | undefined,
    ),
    baseUrl: pickFirst(
      profile?.baseUrl,
      slot?.baseUrl,
      providerDefaults?.baseUrl as string | undefined,
      chatConfig?.baseUrl,
      fallbackDefaults?.baseUrl as string | undefined,
    ),
    model: pickFirst(
      profile?.model,
      slot?.model,
      providerDefaults?.model as string | undefined,
      chatConfig?.model,
      fallbackDefaults?.model as string | undefined,
    ),
    temperature:
      slot?.temperature
      ?? profile?.temperature
      ?? (providerDefaults?.temperature as number | undefined)
      ?? chatConfig?.temperature
      ?? (fallbackDefaults?.temperature as number | undefined),
    maxTokens:
      slot?.maxTokens
      ?? profile?.maxTokens
      ?? (providerDefaults?.maxTokens as number | undefined)
      ?? chatConfig?.maxTokens
      ?? (fallbackDefaults?.maxTokens as number | undefined),
  };
}

export function applyProviderDefaults(
  settings: AppSettings,
  config: Partial<UserConfig>,
): UserConfig {
  const providerId = config.providerId || settings.defaultProvider;
  const providerDefaults = providerId
    ? (settings.providers?.[providerId] as Record<string, unknown> | undefined)
    : undefined;

  return {
    ...(config as UserConfig),
    providerId: providerId || '',
    apiKey: pickFirst(
      config.apiKey as string | undefined,
      providerDefaults?.apiKey as string | undefined,
    ),
    baseUrl: pickFirst(
      config.baseUrl as string | undefined,
      providerDefaults?.baseUrl as string | undefined,
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
