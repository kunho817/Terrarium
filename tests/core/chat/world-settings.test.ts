import { describe, it, expect } from 'vitest';
import { resolveEffectiveSettings } from '$lib/core/chat/world-settings';
import type { WorldSettings } from '$lib/types';

describe('resolveEffectiveSettings', () => {
	const globalConfig = {
		providerId: 'openai',
		model: 'gpt-4',
		temperature: 0.7,
		maxTokens: 4096,
	};

	it('returns global config when no world settings', () => {
		const result = resolveEffectiveSettings(globalConfig, undefined);
		expect(result.providerId).toBe('openai');
		expect(result.model).toBe('gpt-4');
		expect(result.temperature).toBe(0.7);
	});

	it('returns global config when world settings is empty', () => {
		const result = resolveEffectiveSettings(globalConfig, {});
		expect(result.providerId).toBe('openai');
		expect(result.temperature).toBe(0.7);
	});

	it('overrides specific fields from world settings', () => {
		const worldSettings: WorldSettings = {
			temperature: 0.9,
			maxTokens: 2048,
		};
		const result = resolveEffectiveSettings(globalConfig, worldSettings);
		expect(result.temperature).toBe(0.9);
		expect(result.maxTokens).toBe(2048);
		expect(result.providerId).toBe('openai');
	});

	it('overrides provider and model', () => {
		const worldSettings: WorldSettings = {
			providerId: 'anthropic',
			model: 'claude-3',
		};
		const result = resolveEffectiveSettings(globalConfig, worldSettings);
		expect(result.providerId).toBe('anthropic');
		expect(result.model).toBe('claude-3');
	});
});
