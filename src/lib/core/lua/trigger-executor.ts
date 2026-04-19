import { LuaRuntime } from './runtime';
import type { Trigger, TriggerEvent, VariableStore } from '$lib/types';
import { logger } from '$lib/utils/logger';

const log = logger.scope('TriggerExecutor');

export interface TriggerResult {
	variables: VariableStore;
	errors: Array<{ triggerId: string; error: Error }>;
}

export class TriggerExecutor {
	private triggers: Trigger[];
	private variables: VariableStore;

	constructor(triggers: Trigger[], variables: VariableStore) {
		this.triggers = triggers;
		this.variables = { ...variables };
	}

	async execute(event: TriggerEvent): Promise<TriggerResult> {
		const matching = this.triggers
			.filter((t) => t.enabled && t.event === event);

		if (matching.length === 0) {
			return { variables: this.variables, errors: [] };
		}

		const runtime = new LuaRuntime();
		const errors: Array<{ triggerId: string; error: Error }> = [];

		try {
			await runtime.init(this.variables);

			for (const trigger of matching) {
				try {
					if (!trigger.script) continue;
					await runtime.doString(trigger.script);
					this.variables = runtime.extractVariables();
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					log.warn(`Trigger "${trigger.name}" (${trigger.id}) failed:`, { error: error.message });
					errors.push({ triggerId: trigger.id, error });
				}
			}
		} finally {
			await runtime.close();
		}

		return { variables: this.variables, errors };
	}
}
