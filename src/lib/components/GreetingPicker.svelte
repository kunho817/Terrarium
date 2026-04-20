<script lang="ts">
	import type { AlternateGreeting } from '$lib/types';

	let { greetings, onselect, oncancel } = $props<{
		greetings: AlternateGreeting[];
		onselect: (greeting: AlternateGreeting) => void;
		oncancel: () => void;
	}>();

	let selectedId = $state<string | null>(null);

	$effect(() => {
		if (greetings.length === 1 && selectedId === null) {
			selectedId = greetings[0].id;
		} else if (selectedId && !greetings.some((greeting: AlternateGreeting) => greeting.id === selectedId)) {
			selectedId = greetings.length === 1 ? greetings[0].id : null;
		}
	});

	function handleStart() {
		if (!selectedId) return;
		const greeting = greetings.find((greeting: AlternateGreeting) => greeting.id === selectedId);
		if (greeting) onselect(greeting);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-overlay0/50"
	tabindex="-1"
	onclick={oncancel}
	onkeydown={(e) => {
		if (e.key === 'Escape') oncancel();
	}}
>
	<div
		class="bg-mantle rounded-xl border border-surface1 shadow-2xl max-w-lg w-full mx-4"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="p-6 border-b border-surface0">
			<h2 class="text-lg font-semibold text-text">Choose a Starting Scenario</h2>
			<p class="text-sm text-subtext0 mt-1">Select how the story begins</p>
		</div>

		<div class="max-h-80 overflow-y-auto p-4 space-y-2">
			{#each greetings as greeting}
				{@const isSelected = selectedId === greeting.id}
				<button
					class="w-full text-left p-3 rounded-lg border transition-colors {isSelected
						? 'border-mauve bg-mauve/10'
						: 'border-surface0 hover:border-surface1 hover:bg-surface0/50'}"
					onclick={() => (selectedId = greeting.id)}
				>
					<div class="flex items-center gap-2">
						{#if isSelected}
							<svg class="w-4 h-4 text-mauve shrink-0" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
									clip-rule="evenodd"
								/>
							</svg>
						{:else}
							<div class="w-4 h-4 shrink-0 rounded-full border border-surface1"></div>
						{/if}
						<span class="font-medium text-text">{greeting.name}</span>
					</div>
					<p class="text-sm text-subtext0 mt-1 line-clamp-3 pl-6">{greeting.content}</p>
				</button>
			{/each}
		</div>

		<div class="flex justify-end gap-3 p-4 border-t border-surface0">
			<button
				class="px-4 py-2 text-sm text-subtext0 hover:text-text transition-colors"
				onclick={oncancel}
			>
				Cancel
			</button>
			<button
				class="px-4 py-2 bg-mauve text-crust rounded-md text-sm font-medium
				       hover:bg-lavender disabled:opacity-50 disabled:cursor-not-allowed
				       transition-colors"
				disabled={!selectedId}
				onclick={handleStart}
			>
				Start
			</button>
		</div>
	</div>
</div>
