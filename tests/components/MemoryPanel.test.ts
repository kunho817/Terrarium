import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import MemoryPanel from '$lib/components/MemoryPanel.svelte';
import { MEMORY_TYPES, type MemoryType } from '$lib/types/memory';

const memoryRepoMock = vi.hoisted(() => ({
	getForSession: vi.fn(),
	getSummaries: vi.fn(),
	addMemory: vi.fn(),
	updateMemory: vi.fn(),
	deleteMemory: vi.fn(),
	updateSummary: vi.fn(),
	deleteSummary: vi.fn(),
}));

vi.mock('$lib/repositories/memory-repo', () => ({
	memoryRepo: memoryRepoMock,
}));

function memory(id: string, type: MemoryType, content: string, createdAt: number) {
	return {
		id,
		type,
		content,
		importance: 0.7,
		turnNumber: 2,
		createdAt,
	};
}

function renderPanel() {
	return render(MemoryPanel, {
		props: {
			sessionId: 'session-1',
			onclose: vi.fn(),
		},
	});
}

describe('MemoryPanel', () => {
	beforeEach(() => {
		memoryRepoMock.getForSession.mockResolvedValue([
			memory('world', 'world_fact', 'World capital is Valdris', 300),
			memory('personal', 'personal_event', 'Alice helped the cartwright', 200),
			memory('event', 'event', 'The gate opened at dusk', 100),
		]);
		memoryRepoMock.getSummaries.mockResolvedValue([]);
		memoryRepoMock.addMemory.mockResolvedValue(undefined);
		memoryRepoMock.updateMemory.mockResolvedValue(undefined);
		memoryRepoMock.deleteMemory.mockResolvedValue(undefined);
		memoryRepoMock.updateSummary.mockResolvedValue(undefined);
		memoryRepoMock.deleteSummary.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('exposes every memory type and filters newly classified world memories', async () => {
		const view = renderPanel();

		await waitFor(() => expect(view.getByText('World capital is Valdris')).toBeTruthy());

		for (const type of MEMORY_TYPES) {
			expect(view.getByRole('button', { name: type })).toBeTruthy();
		}

		await fireEvent.click(view.getByRole('button', { name: 'world_fact' }));

		expect(view.getByText('World capital is Valdris')).toBeTruthy();
		expect(view.queryByText('Alice helped the cartwright')).toBeNull();
		expect(view.queryByText('The gate opened at dusk')).toBeNull();
	});

	it('adds a manual memory using the full memory type list', async () => {
		const { container, getByPlaceholderText, getByText } = renderPanel();

		await waitFor(() => expect(getByText('+ Add Memory')).toBeTruthy());
		await fireEvent.click(getByText('+ Add Memory'));

		const content = getByPlaceholderText('Memory content...');
		const select = container.querySelector('select') as HTMLSelectElement;
		const optionValues = Array.from(select.options).map(option => option.value);

		expect(optionValues).toEqual([...MEMORY_TYPES]);

		await fireEvent.input(content, { target: { value: 'Manual general note' } });
		await fireEvent.change(select, { target: { value: 'general' } });
		await fireEvent.click(getByText('Add'));

		await waitFor(() => {
			expect(memoryRepoMock.addMemory).toHaveBeenCalledWith(
				'session-1',
				'general',
				'Manual general note',
				0.7
			);
		});
	});
});
