import { LuaFactory } from 'wasmoon';
import type { VariableStore } from '$lib/types';
import { applySandbox } from './sandbox';
import { createApiBridge, type LuaApiContext } from './api-bridge';

let factoryPromise: Promise<LuaFactory> | null = null;

async function getFactory(): Promise<LuaFactory> {
	if (!factoryPromise) {
		factoryPromise = (async () => {
			return new LuaFactory();
		})();
	}
	return factoryPromise;
}

export class LuaRuntime {
	private engine: Awaited<ReturnType<LuaFactory['createEngine']>> | null = null;
	private variables: VariableStore = {};

	async init(variables?: VariableStore): Promise<void> {
		const factory = await getFactory();
		this.engine = await factory.createEngine();
		this.variables = { ...(variables || {}) };

		await applySandbox(this.engine);

		const ctx: LuaApiContext = {
			getVar: (name: string) => this.variables[name],
			setVar: (name: string, value: unknown) => { this.variables[name] = value as any; },
			hasVar: (name: string) => name in this.variables,
		};

		const bridge = createApiBridge(ctx);
		for (const [key, fn] of Object.entries(bridge)) {
			this.engine.global.set(key, fn);
		}
	}

	async doString(code: string): Promise<unknown> {
		if (!this.engine) throw new Error('LuaRuntime not initialized');
		return this.engine.doString(code);
	}

	extractVariables(): VariableStore {
		return { ...this.variables };
	}

	async close(): Promise<void> {
		if (this.engine) {
			this.engine.global.close();
			this.engine = null;
		}
	}
}
