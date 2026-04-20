import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import MemoryCard from '$lib/components/MemoryCard.svelte';
import type { MemoryType } from '$lib/types/memory';

const memory = {
	id: 'mem-1',
	type: 'event' as MemoryType,
	content: 'Alice found the silver key',
	importance: 0.7,
	turnNumber: 3,
	createdAt: 1_700_000_000_000,
};

describe('MemoryCard', () => {
	afterEach(() => cleanup());

	it('expands, edits, and saves a memory', async () => {
		const onupdate = vi.fn();
		const { container, getByText } = render(MemoryCard, {
			props: { memory, onupdate, ondelete: vi.fn() },
		});

		await fireEvent.click(getByText('Alice found the silver key'));

		const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
		const select = container.querySelector('select') as HTMLSelectElement;
		const range = container.querySelector('input[type="range"]') as HTMLInputElement;

		await fireEvent.input(textarea, { target: { value: 'Alice gave the silver key to Mara' } });
		await fireEvent.change(select, { target: { value: 'relationship' } });
		await fireEvent.input(range, { target: { value: '0.9' } });
		await fireEvent.click(getByText('Save'));

		expect(onupdate).toHaveBeenCalledWith('mem-1', {
			content: 'Alice gave the silver key to Mara',
			importance: 0.9,
			type: 'relationship',
		});
	});

	it('deletes a memory from expanded mode', async () => {
		const ondelete = vi.fn();
		const { getByText } = render(MemoryCard, {
			props: { memory, onupdate: vi.fn(), ondelete },
		});

		await fireEvent.click(getByText('Alice found the silver key'));
		await fireEvent.click(getByText('Delete'));

		expect(ondelete).toHaveBeenCalledWith('mem-1');
	});
});
