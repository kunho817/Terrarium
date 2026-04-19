<script lang="ts">
	import type { SessionSummary } from '$lib/types/memory';

	let {
		summaries,
		onupdate,
		ondelete,
	}: {
		summaries: SessionSummary[];
		onupdate: (id: string, patch: { summary: string }) => void;
		ondelete: (id: string) => void;
	} = $props();

	let expandedId = $state<string | null>(null);
	let editText = $state('');

	function toggle(id: string, currentText: string) {
		if (expandedId === id) {
			expandedId = null;
		} else {
			expandedId = id;
			editText = currentText;
		}
	}

	function save(id: string) {
		onupdate(id, { summary: editText });
		expandedId = null;
	}
</script>

{#if summaries.length === 0}
	<div class="text-center text-subtext0 text-sm py-8">No summaries yet</div>
{:else}
	<div class="space-y-2">
		{#each summaries as summary}
			<div class="bg-surface0 rounded-lg border border-surface1 p-3">
				<button
					class="w-full text-left bg-transparent border-none cursor-pointer"
					onclick={() => toggle(summary.id, summary.summary)}
				>
					<div class="flex items-center justify-between mb-1">
						<span class="text-xs text-subtext0">Turns {summary.startTurn}–{summary.endTurn}</span>
						<span class="text-xs text-subtext0">{new Date(summary.createdAt).toLocaleString()}</span>
					</div>
					{#if expandedId !== summary.id}
						<p class="text-sm text-text line-clamp-2">{summary.summary}</p>
					{/if}
				</button>

				{#if expandedId === summary.id}
					<div class="mt-2 space-y-2">
						<textarea
							bind:value={editText}
							class="w-full bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 resize-y min-h-[80px]"
						></textarea>
						<div class="flex items-center gap-2">
							<button
								onclick={() => save(summary.id)}
								class="text-xs text-green bg-transparent border border-green/30 rounded px-2 py-1 hover:bg-green/10 cursor-pointer"
							>Save</button>
							<button
								onclick={() => ondelete(summary.id)}
								class="text-xs text-red bg-transparent border border-red/30 rounded px-2 py-1 hover:bg-red/10 cursor-pointer"
							>Delete</button>
							<button
								onclick={() => expandedId = null}
								class="text-xs text-subtext0 bg-transparent border-none hover:text-text cursor-pointer"
							>Cancel</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
