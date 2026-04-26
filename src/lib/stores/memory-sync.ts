import { writable } from 'svelte/store';

function createMemorySyncStore() {
	const { subscribe, update } = writable(0);

	return {
		subscribe,
		bump() {
			update((version) => version + 1);
		},
	};
}

export const memorySyncStore = createMemorySyncStore();
