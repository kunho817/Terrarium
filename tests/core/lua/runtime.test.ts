// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LuaRuntime } from '$lib/core/lua/runtime';

describe('LuaRuntime', () => {
	describe('sandbox', () => {
		it('blocks io library', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			await expect(runtime.doString('io.open("test.txt", "r")')).rejects.toThrow();
			await runtime.close();
		});

		it('allows math, string, table', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			await expect(runtime.doString('return math.abs(-1)')).resolves.toBeDefined();
			await expect(runtime.doString('return string.len("hello")')).resolves.toBeDefined();
			await runtime.doString('table.insert({}, 1)');
			await runtime.close();
		});
	});

	describe('variable hydration', () => {
		it('hydrates variables from initial state', async () => {
			const runtime = new LuaRuntime();
			await runtime.init({ reputation: 50, chapter: 1, player_name: 'Alice' });
			const result = await runtime.doString('return get_var("reputation")');
			expect(result).toBe(50);
			await runtime.close();
		});

		it('persists variables back to extractable state', async () => {
			const runtime = new LuaRuntime();
			await runtime.init({ count: 0 });
			await runtime.doString('set_var("count", 42)');
			const vars = runtime.extractVariables();
			expect(vars.count).toBe(42);
			await runtime.close();
		});
	});

	describe('API bridge functions', () => {
		it('get_var returns nil for undefined variables', async () => {
			const runtime = new LuaRuntime();
			await runtime.init({});
			const result = await runtime.doString('return get_var("nonexistent")');
			expect(result).toBeUndefined();
			await runtime.close();
		});

		it('has_var returns boolean', async () => {
			const runtime = new LuaRuntime();
			await runtime.init({ foo: 'bar' });
			const result = await runtime.doString('return has_var("foo")');
			expect(result).toBe(true);
			await runtime.close();
		});

		it('set_var creates new variables', async () => {
			const runtime = new LuaRuntime();
			await runtime.init({});
			await runtime.doString('set_var("new_var", "hello")');
			expect(runtime.extractVariables().new_var).toBe('hello');
			await runtime.close();
		});
	});

	describe('doString', () => {
		it('evaluates simple expressions', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			const result = await runtime.doString('return 1 + 1');
			expect(result).toBe(2);
			await runtime.close();
		});

		it('handles Lua errors gracefully', async () => {
			const runtime = new LuaRuntime();
			await runtime.init();
			await expect(runtime.doString('error("test error")')).rejects.toThrow();
			await runtime.close();
		});
	});
});
