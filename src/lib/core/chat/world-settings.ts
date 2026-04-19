import type { WorldSettings, UserConfig } from '$lib/types';

export function resolveEffectiveSettings(
	globalConfig: UserConfig,
	worldSettings: WorldSettings | undefined,
): UserConfig {
	if (!worldSettings) return globalConfig;

	return {
		...globalConfig,
		...(worldSettings.providerId && { providerId: worldSettings.providerId }),
		...(worldSettings.model && { model: worldSettings.model }),
		...(worldSettings.temperature !== undefined && { temperature: worldSettings.temperature }),
		...(worldSettings.topP !== undefined && { topP: worldSettings.topP }),
		...(worldSettings.maxTokens !== undefined && { maxTokens: worldSettings.maxTokens }),
	};
}
