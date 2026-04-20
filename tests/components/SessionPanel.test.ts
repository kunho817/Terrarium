import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import SessionPanel from '$lib/components/SessionPanel.svelte';
import { makeCharacterId, makeSessionId } from '$lib/types/branded';
import type { ChatSession } from '$lib/types';

function makeSession(id: string, name: string, lastMessageAt: number, pinnedAt?: number): ChatSession {
	return {
		id: makeSessionId(id),
		characterId: makeCharacterId('char-1'),
		name,
		createdAt: lastMessageAt - 100,
		lastMessageAt,
		preview: `Preview for ${name}`,
		pinnedAt,
	};
}

const handlers = () => ({
	onselect: vi.fn(),
	onrename: vi.fn(),
	ondelete: vi.fn(),
	oncreate: vi.fn(),
	onclose: vi.fn(),
	onsetpersona: vi.fn(),
	onpin: vi.fn(),
	onexport: vi.fn(),
	onarchive: vi.fn(),
	onrestore: vi.fn(),
	onpermanentlyDelete: vi.fn(),
});

describe('SessionPanel', () => {
	afterEach(() => cleanup());

	it('sorts pinned sessions first, then unpinned by recency', () => {
		const h = handlers();
		const { getByText } = render(SessionPanel, {
			props: {
				sessions: [
					makeSession('old', 'Old unpinned', 100),
					makeSession('new', 'New unpinned', 300),
					makeSession('pin', 'Pinned session', 200, 400),
				],
				archivedSessions: [],
				activeSessionId: null,
				personas: [],
				...h,
			},
		});

		const pinned = getByText('Pinned session');
		const newer = getByText('New unpinned');
		const older = getByText('Old unpinned');

		expect(pinned.compareDocumentPosition(newer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('creates a named session from the inline input', async () => {
		const h = handlers();
		const { getByText, getByPlaceholderText } = render(SessionPanel, {
			props: {
				sessions: [makeSession('one', 'One', 100)],
				archivedSessions: [],
				activeSessionId: null,
				personas: [],
				...h,
			},
		});

		await fireEvent.click(getByText('+ New Session'));
		const input = getByPlaceholderText('Session name...');
		await fireEvent.input(input, { target: { value: 'Custom Session' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(h.oncreate).toHaveBeenCalledWith('Custom Session');
	});

	it('filters active and archived sessions by the same search query', async () => {
		const h = handlers();
		const { getByPlaceholderText, getByText, queryByText } = render(SessionPanel, {
			props: {
				sessions: [
					makeSession('one', 'Forest Run', 100),
					makeSession('two', 'Castle Run', 200),
				],
				archivedSessions: [makeSession('arch', 'Archived Forest', 50)],
				activeSessionId: null,
				personas: [],
				...h,
			},
		});

		await fireEvent.input(getByPlaceholderText('Search sessions...'), { target: { value: 'forest' } });

		expect(getByText('Forest Run')).toBeTruthy();
		expect(queryByText('Castle Run')).toBeNull();

		await fireEvent.click(getByText(/Archived/));
		expect(getByText('Archived Forest')).toBeTruthy();
	});
});
