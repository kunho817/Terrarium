import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import GreetingPicker from '$lib/components/GreetingPicker.svelte';
import type { AlternateGreeting } from '$lib/types';

const greetings: AlternateGreeting[] = [
	{ id: 'g1', name: 'Tavern Start', content: 'The tavern door opens.' },
	{ id: 'g2', name: 'Forest Start', content: 'Mist gathers under the pines.' },
];

describe('GreetingPicker', () => {
	afterEach(() => cleanup());

	it('selects the chosen greeting when Start is clicked', async () => {
		const onselect = vi.fn();
		const { getByText } = render(GreetingPicker, {
			props: { greetings, onselect, oncancel: vi.fn() },
		});

		await fireEvent.click(getByText('Forest Start'));
		await fireEvent.click(getByText('Start'));

		expect(onselect).toHaveBeenCalledWith(greetings[1]);
	});

	it('preselects a single greeting so it can start immediately', async () => {
		const onselect = vi.fn();
		const single = [greetings[0]];
		const { getByText } = render(GreetingPicker, {
			props: { greetings: single, onselect, oncancel: vi.fn() },
		});

		await tick();
		await fireEvent.click(getByText('Start'));

		expect(onselect).toHaveBeenCalledWith(single[0]);
	});

	it('cancels when the backdrop is clicked', async () => {
		const oncancel = vi.fn();
		const { container } = render(GreetingPicker, {
			props: { greetings, onselect: vi.fn(), oncancel },
		});

		await fireEvent.click(container.firstElementChild as HTMLElement);

		expect(oncancel).toHaveBeenCalledOnce();
	});
});
