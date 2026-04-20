<script lang="ts">
	import { MEMORY_TYPES, type MemoryType } from '$lib/types/memory';

	type MemoryView = {
		id: string;
		type: MemoryType;
		content: string;
		importance: number;
		turnNumber: number;
		createdAt: number;
	};

	let {
		memory,
		onupdate,
		ondelete,
	}: {
		memory: MemoryView;
		onupdate: (id: string, patch: { content?: string; importance?: number; type?: MemoryType }) => void;
		ondelete: (id: string) => void;
	} = $props();

	let expanded = $state(false);
	let editContent = $state('');
	let editImportance = $state(0);
	let editType = $state<MemoryType>('event');

	const typeColors: Record<MemoryType, string> = {
		event: 'text-blue',
		trait: 'text-green',
		relationship: 'text-pink',
		location: 'text-yellow',
		state: 'text-mauve',
		world_fact: 'text-teal',
		personal_event: 'text-peach',
		general: 'text-subtext0',
	};
	const allTypes = MEMORY_TYPES;

	$effect(() => {
		if (!expanded) {
			editContent = memory.content;
			editImportance = memory.importance;
			editType = memory.type;
		}
	});

	function toggle() {
		expanded = !expanded;
		if (expanded) {
			editContent = memory.content;
			editImportance = memory.importance;
			editType = memory.type;
		}
	}

	function save() {
		onupdate(memory.id, {
			content: editContent,
			importance: editImportance,
			type: editType,
		});
		expanded = false;
	}

	function remove() {
		ondelete(memory.id);
	}

	let importancePercent = $derived(Math.round(memory.importance * 100));
</script>

<article
	class="w-full text-left bg-surface0 rounded-lg border border-surface1 p-3 hover:border-surface2 transition-colors"
>
	{#if !expanded}
		<button type="button" class="w-full text-left cursor-pointer" onclick={toggle} aria-expanded={expanded}>
			<div class="flex items-start justify-between gap-2">
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-1">
						<span class="text-xs font-medium {typeColors[memory.type]}">{memory.type}</span>
						<div class="flex-1 h-1 bg-surface1 rounded-full overflow-hidden">
							<div class="h-full bg-lavender rounded-full" style="width: {importancePercent}%"></div>
						</div>
						<span class="text-xs text-subtext0">{importancePercent}%</span>
					</div>
					<p class="text-sm text-text truncate">{memory.content}</p>
					<p class="text-xs text-subtext0 mt-1">
						Turn {memory.turnNumber} - {new Date(memory.createdAt).toLocaleString()}
					</p>
				</div>
			</div>
		</button>
	{:else}
		<div class="flex items-start justify-between gap-2">
			<div class="flex-1 min-w-0">
				<div class="space-y-3">
					<div>
						<label for="memory-{memory.id}-type" class="text-xs text-subtext0">Type</label>
						<select
							id="memory-{memory.id}-type"
							bind:value={editType}
							class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 mt-1"
						>
							{#each allTypes as type}
								<option value={type}>{type}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="memory-{memory.id}-content" class="text-xs text-subtext0">Content</label>
						<textarea
							id="memory-{memory.id}-content"
							bind:value={editContent}
							class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 mt-1 resize-y min-h-[60px]"
						></textarea>
					</div>
					<div>
						<label for="memory-{memory.id}-importance" class="text-xs text-subtext0">
							Importance: {Math.round(editImportance * 100)}%
						</label>
						<input
							id="memory-{memory.id}-importance"
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={editImportance}
							class="w-full mt-1"
						/>
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={save}
							class="text-xs text-green bg-transparent border border-green/30 rounded px-2 py-1 hover:bg-green/10 cursor-pointer"
						>
							Save
						</button>
						<button
							type="button"
							onclick={remove}
							class="text-xs text-red bg-transparent border border-red/30 rounded px-2 py-1 hover:bg-red/10 cursor-pointer"
						>
							Delete
						</button>
						<button
							type="button"
							onclick={() => expanded = false}
							class="text-xs text-subtext0 bg-transparent border-none hover:text-text cursor-pointer"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</article>
