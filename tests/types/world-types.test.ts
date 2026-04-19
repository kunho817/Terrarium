import { describe, it, expect } from 'vitest';
import {
	createDefaultWorldCard,
	type WorldCard,
	type WorldCharacter,
	type AlternateGreeting,
	type WorldScenario,
	type WorldSettings,
} from '$lib/types';

describe('WorldCard types', () => {
	describe('createDefaultWorldCard', () => {
		it('returns a valid default WorldCard', () => {
			const card = createDefaultWorldCard();
			expect(card.name).toBe('');
			expect(card.description).toBe('');
			expect(card.scenario).toBe('');
			expect(card.firstMessage).toBe('');
			expect(card.alternateGreetings).toEqual([]);
			expect(card.scenarios).toEqual([]);
			expect(card.worldSettings).toBeUndefined();
			expect(card.lorebook).toEqual([]);
			expect(card.characters).toEqual([]);
			expect(card.regexScripts).toEqual([]);
			expect(card.triggers).toEqual([]);
		});
	});

	describe('WorldCharacter defaults', () => {
		it('has all required fields with sensible defaults', () => {
			const char: WorldCharacter = {
				id: 'test-id',
				name: 'Test',
				description: 'A test character',
				personality: '',
				exampleMessages: '',
				avatar: null,
				lorebookEntryIds: [],
				trackState: false,
				tags: [],
			};
			expect(char.trackState).toBe(false);
			expect(char.lorebookEntryIds).toEqual([]);
			expect(char.avatar).toBeNull();
		});
	});

	describe('AlternateGreeting', () => {
		it('has id, name, and content', () => {
			const greeting: AlternateGreeting = {
				id: 'g1',
				name: 'Tavern Start',
				content: 'The tavern door creaks open...',
			};
			expect(greeting.id).toBe('g1');
			expect(greeting.name).toBe('Tavern Start');
			expect(greeting.content).toContain('tavern');
		});
	});

	describe('WorldScenario', () => {
		it('has condition and actions fields', () => {
			const scenario: WorldScenario = {
				id: 's1',
				name: 'Reputation Event',
				description: 'Triggered when reputation is high',
				condition: 'get_var("reputation") > 50',
				actions: 'set_var("chapter", 2)',
				enabled: true,
			};
			expect(scenario.condition).toContain('get_var');
			expect(scenario.actions).toContain('set_var');
			expect(scenario.enabled).toBe(true);
		});
	});

	describe('WorldSettings', () => {
		it('all fields are optional', () => {
			const settings: WorldSettings = {};
			expect(settings.temperature).toBeUndefined();
			expect(settings.agents).toBeUndefined();
		});

		it('allows partial agent overrides', () => {
			const settings: WorldSettings = {
				temperature: 0.8,
				agents: {
					memory: { enabled: false },
					narrativeConsistency: { enabled: true, tokenBudget: 512 },
				},
			};
			expect(settings.agents?.memory?.enabled).toBe(false);
			expect(settings.agents?.narrativeConsistency?.tokenBudget).toBe(512);
		});
	});
});
