import { describe, it, expect } from 'vitest';

describe('Test infrastructure', () => {
	it('Vitest is working', () => {
		expect(1 + 1).toBe(2);
	});

	it('TypeScript types compile', () => {
		const greeting: string = 'hello';
		expect(greeting).toBeTypeOf('string');
	});
});
