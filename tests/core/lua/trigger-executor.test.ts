// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TriggerExecutor } from '$lib/core/lua/trigger-executor';
import type { Trigger } from '$lib/types';

describe('TriggerExecutor', () => {
	const triggers: Trigger[] = [
		{
			id: 't1',
			name: 'High rep',
			enabled: true,
			event: 'on_user_message',
			script: 'if get_var("reputation") > 50 then set_var("chapter", 2) end',
		},
		{
			id: 't2',
			name: 'Low rep',
			enabled: true,
			event: 'on_user_message',
			script: 'if get_var("reputation") < 10 then set_var("chapter", 0) end',
		},
		{
			id: 't3',
			name: 'Disabled',
			enabled: false,
			event: 'on_user_message',
			script: 'set_var("never", true)',
		},
	];

	it('executes matching triggers', async () => {
		const executor = new TriggerExecutor(triggers, { reputation: 60 });
		const result = await executor.execute('on_user_message');
		expect(result.variables.reputation).toBe(60);
		expect(result.variables.chapter).toBe(2);
		expect(result.errors).toHaveLength(0);
	});

	it('skips disabled triggers', async () => {
		const executor = new TriggerExecutor(triggers, { reputation: 60 });
		const result = await executor.execute('on_user_message');
		expect(result.variables.never).toBeUndefined();
	});

	it('skips triggers that do not match event', async () => {
		const executor = new TriggerExecutor(triggers, { reputation: 60 });
		const result = await executor.execute('on_ai_message');
		expect(result.variables.chapter).toBeUndefined();
	});

	it('collects errors without crashing', async () => {
		const badTriggers: Trigger[] = [
			{
				id: 'bad',
				name: 'Bad trigger',
				enabled: true,
				event: 'on_message',
				script: 'error("boom")',
			},
		];
		const executor = new TriggerExecutor(badTriggers, {});
		const result = await executor.execute('on_message');
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it('returns empty result when no triggers match', async () => {
		const executor = new TriggerExecutor([], {});
		const result = await executor.execute('on_user_message');
		expect(result.variables).toEqual({});
		expect(result.errors).toHaveLength(0);
	});
});
