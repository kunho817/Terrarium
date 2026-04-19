<script lang="ts">
	import type { WorldCharacter } from '$lib/types/world';
	import type { LorebookEntry } from '$lib/types/lorebook';

	let { character, lorebookEntries, onchange, onremove } = $props<{
		character: WorldCharacter;
		lorebookEntries: LorebookEntry[];
		onchange: (char: WorldCharacter) => void;
		onremove: () => void;
	}>();

	let tagsText = $state(character.tags.join(', '));

	const examplePlaceholder = '{' + '{char}}: Hello there!\n{' + '{user}}: *waves* Hi!';

	function update(partial: Partial<WorldCharacter>) {
		onchange({ ...character, ...partial });
	}

	function handleTagsInput(value: string) {
		tagsText = value;
		const arr = value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		update({ tags: arr });
	}

	function toggleLorebookEntry(entryId: string) {
		const ids = character.lorebookEntryIds.includes(entryId)
			? character.lorebookEntryIds.filter((lid: string) => lid !== entryId)
			: [...character.lorebookEntryIds, entryId];
		update({ lorebookEntryIds: ids });
	}
</script>

<div class="flex flex-col gap-3">
	<label class="flex flex-col gap-1">
		<span class="text-xs text-subtext0">Name</span>
		<input
			type="text"
			value={character.name}
			oninput={(e) => update({ name: e.currentTarget.value })}
			class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
				focus:border-mauve focus:outline-none transition-colors"
		/>
	</label>

	<label class="flex flex-col gap-1">
		<span class="text-xs text-subtext0">Tags</span>
		<input
			type="text"
			value={tagsText}
			oninput={(e) => handleTagsInput(e.currentTarget.value)}
			placeholder="tag1, tag2, tag3"
			class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
				focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
		/>
	</label>

	<label class="flex flex-col gap-1">
		<span class="text-xs text-subtext0">Description</span>
		<textarea
			value={character.description}
			oninput={(e) => update({ description: e.currentTarget.value })}
			rows={3}
			class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
				focus:border-mauve focus:outline-none transition-colors resize-y placeholder:text-overlay0"
		></textarea>
	</label>

	<label class="flex flex-col gap-1">
		<span class="text-xs text-subtext0">Personality</span>
		<textarea
			value={character.personality}
			oninput={(e) => update({ personality: e.currentTarget.value })}
			rows={2}
			placeholder="Personality traits, quirks, speech patterns..."
			class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
				focus:border-mauve focus:outline-none transition-colors resize-y placeholder:text-overlay0"
		></textarea>
	</label>

	<label class="flex flex-col gap-1">
		<span class="text-xs text-subtext0">Example Messages</span>
		<textarea
			value={character.exampleMessages}
			oninput={(e) => update({ exampleMessages: e.currentTarget.value })}
			rows={3}
			placeholder={examplePlaceholder}
			class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
				focus:border-mauve focus:outline-none transition-colors resize-y font-mono placeholder:text-overlay0"
		></textarea>
	</label>

	{#if lorebookEntries.length > 0}
		<div class="flex flex-col gap-1">
			<span class="text-xs text-subtext0">Linked Lorebook Entries</span>
			<div class="flex flex-wrap gap-1.5">
				{#each lorebookEntries as entry (entry.id)}
					{@const linked = character.lorebookEntryIds.includes(entry.id)}
					<button
						type="button"
						onclick={() => toggleLorebookEntry(entry.id)}
						class="px-2 py-0.5 rounded text-xs border transition-colors
							{linked
								? 'bg-mauve/20 text-mauve border-mauve/40'
								: 'bg-surface0 text-subtext0 border-surface1 hover:border-overlay0'}"
					>
						{entry.name}
						</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="flex items-center gap-4">
		<label class="flex items-center gap-1.5 cursor-pointer">
			<input
				type="checkbox"
				checked={character.trackState}
				onchange={(e) => update({ trackState: e.currentTarget.checked })}
				class="accent-mauve"
			/>
			<span class="text-xs text-subtext1">Track State</span>
		</label>
	</div>

	<div class="flex justify-end">
		<button
			type="button"
			onclick={onremove}
			class="px-3 py-1 rounded text-xs text-red hover:bg-red/10 transition-colors"
		>
			Remove Character
		</button>
	</div>
</div>
