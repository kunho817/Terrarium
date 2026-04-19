<script lang="ts">
	interface AlternateGreeting {
		id: string;
		name: string;
		content: string;
	}

	let {
		greetings,
		onchange,
		label = 'Alternate Greetings',
	}: {
		greetings: AlternateGreeting[];
		onchange: (greetings: AlternateGreeting[]) => void;
		label?: string;
	} = $props();

	let expandedIds = $state<Set<string>>(new Set());

	function addGreeting() {
		const newGreeting: AlternateGreeting = {
			id: crypto.randomUUID(),
			name: 'New Greeting',
			content: '',
		};
		const next = [...greetings, newGreeting];
		expandedIds = new Set([...expandedIds, newGreeting.id]);
		onchange(next);
	}

	function updateGreeting(index: number, field: keyof AlternateGreeting, value: string) {
		const next = [...greetings];
		next[index] = { ...next[index], [field]: value };
		onchange(next);
	}

	function removeGreeting(index: number) {
		const removed = greetings[index];
		const next = greetings.filter((_: AlternateGreeting, i: number) => i !== index);
		const ids = new Set(expandedIds);
		ids.delete(removed.id);
		expandedIds = ids;
		onchange(next);
	}

	function toggleExpand(id: string) {
		const ids = new Set(expandedIds);
		if (ids.has(id)) {
			ids.delete(id);
		} else {
			ids.add(id);
		}
		expandedIds = ids;
	}

	function expandAll() {
		expandedIds = new Set(greetings.map((g: AlternateGreeting) => g.id));
	}

	function collapseAll() {
		expandedIds = new Set();
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-medium text-text">{label}</h3>
			<span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-subtext0">
				{greetings.length}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={expandAll}
				class="px-2 py-1 rounded text-xs text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
			>
				Expand All
			</button>
			<button
				type="button"
				onclick={collapseAll}
				class="px-2 py-1 rounded text-xs text-subtext0 hover:text-text hover:bg-surface0 transition-colors"
			>
				Collapse All
			</button>
			<button
				type="button"
				onclick={addGreeting}
				class="px-3 py-1 rounded text-xs font-medium bg-mauve text-crust hover:bg-lavender transition-colors"
			>
				+ Add Greeting
			</button>
		</div>
	</div>

	{#each greetings as greeting, index (greeting.id)}
		{@const isExpanded = expandedIds.has(greeting.id)}
		<div class="rounded-lg border border-surface1 bg-crust overflow-hidden">
			<button
				type="button"
				onclick={() => toggleExpand(greeting.id)}
				class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface0 transition-colors"
			>
				<span class="text-xs text-overlay0 transition-transform" class:rotate-90={isExpanded}>
					&#9654;
				</span>
				<span class="text-sm text-text flex-1 truncate">
					{greeting.name || 'Untitled'}
				</span>
				{#if !isExpanded && greeting.content}
					<span class="text-xs text-overlay0 truncate max-w-60">
						{greeting.content.slice(0, 60)}{greeting.content.length > 60 ? '...' : ''}
					</span>
				{/if}
			</button>

			{#if isExpanded}
				<div class="px-3 pb-3 border-t border-surface1 flex flex-col gap-2">
					<div class="flex items-center gap-2 pt-2">
						<label class="text-xs text-subtext0 w-14 shrink-0">Name</label>
						<input
							type="text"
							value={greeting.name}
							oninput={(e) => updateGreeting(index, 'name', e.currentTarget.value)}
							class="flex-1 px-2 py-1 rounded text-sm bg-surface0 text-text border border-surface1 focus:border-mauve focus:outline-none transition-colors"
						/>
						<button
							type="button"
							onclick={() => removeGreeting(index)}
							class="px-2 py-1 rounded text-xs text-red hover:bg-surface0 transition-colors"
						>
							Delete
						</button>
					</div>
					<textarea
						rows="4"
						value={greeting.content}
						oninput={(e) => updateGreeting(index, 'content', e.currentTarget.value)}
						class="w-full px-2 py-1 rounded text-sm bg-surface0 text-text border border-surface1 focus:border-mauve focus:outline-none resize-y transition-colors"
					></textarea>
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-xs text-overlay0 text-center py-4">No greetings yet. Click "Add Greeting" to start.</p>
	{/each}
</div>
