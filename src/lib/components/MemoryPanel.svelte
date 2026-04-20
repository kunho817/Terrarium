<script lang="ts">
	import { onMount } from 'svelte';
	import { memoryRepo, type MemoryView } from '$lib/repositories/memory-repo';
	import { MEMORY_TYPES, type MemoryType, type SessionSummary } from '$lib/types/memory';
	import MemoryCard from './MemoryCard.svelte';
	import SummaryList from './SummaryList.svelte';

	let {
		sessionId,
		onclose,
	}: {
		sessionId: string;
		onclose: () => void;
	} = $props();


	let tab = $state<'memories' | 'summaries'>('memories');
	let memories = $state<MemoryView[]>([]);
	let summaries = $state<SessionSummary[]>([]);
	let searchQuery = $state('');
	let typeFilter = $state<Set<MemoryType>>(new Set());
	let sortBy = $state<'importance' | 'recency'>('recency');
	let showAddForm = $state(false);
	let newContent = $state('');
	let newType = $state<MemoryType>('event');
	let newImportance = $state(0.7);

	const allTypes = MEMORY_TYPES;

	async function load() {
		try {
			memories = await memoryRepo.getForSession(sessionId);
			summaries = await memoryRepo.getSummaries(sessionId);
		} catch {
			memories = [];
			summaries = [];
		}
	}

	onMount(load);

	function toggleType(t: MemoryType) {
		const next = new Set(typeFilter);
		if (next.has(t)) next.delete(t); else next.add(t);
		typeFilter = next;
	}

	let filteredMemories = $derived.by(() => {
		let result = memories;
		if (typeFilter.size > 0) {
			result = result.filter(m => typeFilter.has(m.type));
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(m => m.content.toLowerCase().includes(q));
		}
		if (sortBy === 'importance') {
			result = [...result].sort((a, b) => b.importance - a.importance);
		} else {
			result = [...result].sort((a, b) => b.createdAt - a.createdAt);
		}
		return result;
	});

	async function handleUpdate(id: string, patch: { content?: string; importance?: number; type?: MemoryType }) {
		await memoryRepo.updateMemory(id, patch);
		await load();
	}

	async function handleDelete(id: string) {
		await memoryRepo.deleteMemory(id);
		await load();
	}

	async function handleAddMemory() {
		if (!newContent.trim()) return;
		await memoryRepo.addMemory(sessionId, newType, newContent.trim(), newImportance);
		newContent = '';
		newType = 'event';
		newImportance = 0.7;
		showAddForm = false;
		await load();
	}

	async function handleUpdateSummary(id: string, patch: { summary: string }) {
		await memoryRepo.updateSummary(id, patch);
		await load();
	}

	async function handleDeleteSummary(id: string) {
		await memoryRepo.deleteSummary(id);
		await load();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="fixed inset-0 z-50 flex justify-end bg-overlay/50"
	onclick={onclose}
	onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="w-96 h-full bg-mantle border-l border-surface0 flex flex-col shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between px-4 py-3 border-b border-surface0">
			<h2 class="text-sm font-semibold text-text">Memory Inspector</h2>
			<button
				onclick={onclose}
				class="text-subtext0 hover:text-text text-lg bg-transparent border-none cursor-pointer"
			>✕</button>
		</div>

		<div class="flex border-b border-surface0">
			<button
				onclick={() => tab = 'memories'}
				class="flex-1 text-xs py-2 bg-transparent border-none cursor-pointer {tab === 'memories' ? 'text-text border-b-2 border-lavender' : 'text-subtext0'}"
			>Memories ({memories.length})</button>
			<button
				onclick={() => tab = 'summaries'}
				class="flex-1 text-xs py-2 bg-transparent border-none cursor-pointer {tab === 'summaries' ? 'text-text border-b-2 border-lavender' : 'text-subtext0'}"
			>Summaries ({summaries.length})</button>
		</div>

		{#if tab === 'memories'}
			<div class="p-3 border-b border-surface0 space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search memories..."
						class="flex-1 bg-surface0 text-text text-xs px-2 py-1.5 rounded border border-surface1 focus:outline-none focus:border-mauve"
					/>
					<button
						onclick={() => sortBy = sortBy === 'importance' ? 'recency' : 'importance'}
						class="text-xs text-subtext0 hover:text-text bg-surface0 border border-surface1 rounded px-2 py-1.5 cursor-pointer"
					>{sortBy === 'importance' ? '★' : '🕐'}</button>
				</div>
				<div class="flex flex-wrap gap-1">
					{#each allTypes as t}
						<button
							onclick={() => toggleType(t)}
							class="text-xs px-2 py-0.5 rounded-full border cursor-pointer {typeFilter.has(t) ? 'bg-lavender/20 border-lavender text-lavender' : 'bg-transparent border-surface1 text-subtext0 hover:text-text'}"
						>{t}</button>
					{/each}
				</div>
				<button
					onclick={() => showAddForm = !showAddForm}
					class="text-xs text-green bg-transparent border-none cursor-pointer hover:text-lavender"
				>+ Add Memory</button>
				{#if showAddForm}
					<div class="bg-surface0 rounded-lg p-3 space-y-2">
						<textarea
							bind:value={newContent}
							placeholder="Memory content..."
							class="w-full bg-surface1 text-text text-xs px-2 py-1.5 rounded border border-surface1 resize-y min-h-[50px] focus:outline-none focus:border-mauve"
						></textarea>
						<div class="flex items-center gap-2">
							<select
								bind:value={newType}
								class="bg-surface1 text-text text-xs px-2 py-1 rounded border border-surface1"
							>
								{#each allTypes as t}
									<option value={t}>{t}</option>
								{/each}
							</select>
							<div class="flex-1 flex items-center gap-1">
								<input type="range" min="0" max="1" step="0.05" bind:value={newImportance} class="flex-1" />
								<span class="text-xs text-subtext0">{Math.round(newImportance * 100)}%</span>
							</div>
						</div>
						<div class="flex gap-2">
							<button onclick={handleAddMemory} class="text-xs text-green bg-transparent border border-green/30 rounded px-2 py-1 hover:bg-green/10 cursor-pointer">Add</button>
							<button onclick={() => showAddForm = false} class="text-xs text-subtext0 bg-transparent border-none hover:text-text cursor-pointer">Cancel</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex-1 overflow-y-auto p-3 space-y-2">
				{#if filteredMemories.length === 0}
					<div class="text-center text-subtext0 text-sm py-8">{memories.length === 0 ? 'No memories yet' : 'No matching memories'}</div>
				{:else}
					{#each filteredMemories as memory (memory.id)}
						<MemoryCard {memory} onupdate={handleUpdate} ondelete={handleDelete} />
					{/each}
				{/if}
			</div>
		{:else}
			<div class="flex-1 overflow-y-auto p-3">
				<SummaryList summaries={summaries} onupdate={handleUpdateSummary} ondelete={handleDeleteSummary} />
			</div>
		{/if}
	</div>
</div>
