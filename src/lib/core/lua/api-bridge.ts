import type { VariableStore } from '$lib/types';

export interface LuaApiContext {
	getVar: (name: string) => unknown;
	setVar: (name: string, value: unknown) => void;
	hasVar: (name: string) => boolean;
}

export function createApiBridge(ctx: LuaApiContext): Record<string, (...args: unknown[]) => unknown> {
	return {
		get_var: (name: unknown) => ctx.getVar(String(name)),
		set_var: (name: unknown, value: unknown) => ctx.setVar(String(name), value),
		has_var: (name: unknown) => ctx.hasVar(String(name)),
	};
}
