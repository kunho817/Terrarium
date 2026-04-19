<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { worldsStore } from '$lib/stores/worlds';
	import { worldsRepo } from '$lib/repositories/worlds-repo';
	import { createDefaultWorldCard } from '$lib/types/world';
	import type { WorldCard, WorldCharacter } from '$lib/types/world';
	import * as worldImport from '$lib/storage/world-import';
	import { settingsStore } from '$lib/stores/settings';

	import LorebookEditor from '$lib/components/editors/LorebookEditor.svelte';
	import RegexEditor from '$lib/components/editors/RegexEditor.svelte';
	import TriggerEditor from '$lib/components/editors/TriggerEditor.svelte';
	import WorldCharacterForm from '$lib/components/editors/WorldCharacterForm.svelte';
	import GreetingList from '$lib/components/editors/GreetingList.svelte';
	import WorldSettingsEditor from '$lib/components/editors/WorldSettingsEditor.svelte';

	let tab = $state<'overview' | 'system' | 'lorebook' | 'characters' | 'scripts' | 'settings' | 'theme'>('overview');
	let card = $state<WorldCard>(createDefaultWorldCard());
	let saving = $state(false);
	let saved = $state(false);
	let error = $state('');
	let loaded = $state(false);
	const worldId = $derived($page.params.id ?? '');
	let tagsText = $state('');
	let newCharName = $state('');
	let expandedCharIds = $state<Set<string>>(new Set());
	const providerIds = $derived(Object.keys($settingsStore.providers));

	onMount(async () => {
		try {
			await worldsRepo.selectWorld(worldId);
			const state = $worldsStore;
			if (state.current) {
				card = JSON.parse(JSON.stringify(state.current));
				tagsText = card.tags.join(', ');
			}
			loaded = true;
		} catch {
			error = 'Failed to load world';
			loaded = true;
		}
	});

	async function handleSave() {
		saving = true;
		saved = false;
		error = '';
		try {
			card.tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
			await worldsRepo.saveWorld(worldId, card);
			saved = true;
			setTimeout(() => { saved = false; }, 2000);
		} catch (e: any) {
			error = e?.message || 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function handleExport() {
		try {
			const data = worldImport.exportWorldCard(card);
			const { save } = await import('@tauri-apps/plugin-dialog');
			const { writeFile } = await import('@tauri-apps/plugin-fs');
			const filePath = await save({
				defaultPath: `${card.name || 'world'}.tcworld`,
				filters: [{ name: 'World Cards', extensions: ['tcworld'] }],
			});
			if (!filePath) return;
			await writeFile(filePath, new Uint8Array(data));
		} catch (e: any) {
			error = e?.message || 'Export failed';
		}
	}

	function addCharacter() {
		if (!newCharName.trim()) return;
		const char: WorldCharacter = {
			id: crypto.randomUUID(),
			name: newCharName.trim(),
			description: '',
			personality: '',
			exampleMessages: '',
			avatar: null,
			lorebookEntryIds: [],
			trackState: false,
			tags: [],
		};
		card.characters = [...card.characters, char];
		expandedCharIds = new Set([...expandedCharIds, char.id]);
		newCharName = '';
	}

	function updateCharacter(index: number, updated: WorldCharacter) {
		const next = [...card.characters];
		next[index] = updated;
		card.characters = next;
	}

	function removeCharacter(index: number) {
		const removed = card.characters[index];
		const ids = new Set(expandedCharIds);
		ids.delete(removed.id);
		expandedCharIds = ids;
		card.characters = card.characters.filter((_: WorldCharacter, i: number) => i !== index);
	}

	function toggleCharExpand(id: string) {
		const ids = new Set(expandedCharIds);
		if (ids.has(id)) {
			ids.delete(id);
		} else {
			ids.add(id);
		}
		expandedCharIds = ids;
	}

	const tabs = [
		{ key: 'overview' as const, label: 'Overview' },
		{ key: 'system' as const, label: 'System Prompt' },
		{ key: 'lorebook' as const, label: 'Lorebook' },
		{ key: 'characters' as const, label: 'Characters' },
		{ key: 'scripts' as const, label: 'Scripts' },
		{ key: 'settings' as const, label: 'Settings' },
		{ key: 'theme' as const, label: 'Theme' },
	];
</script>

<div class="flex-1 flex flex-col overflow-hidden">
	<div class="flex items-center justify-between p-4 border-b border-surface0">
		<div class="flex items-center gap-3">
			<button onclick={() => goto('/worlds')} class="text-subtext0 hover:text-text bg-transparent border-none cursor-pointer text-lg">&larr;</button>
			<div>
				<h1 class="text-lg font-semibold text-text">Edit World</h1>
				{#if card.name}
					<p class="text-xs text-subtext0">{card.name}</p>
				{/if}
			</div>
		</div>
		<div class="flex gap-2">
			<button
				onclick={handleExport}
				class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
			>
				Export
			</button>
			<button
				onclick={() => goto(`/chat/${worldId}?cardType=world`)}
				class="px-3 py-1.5 bg-surface1 text-text rounded-md text-sm hover:bg-surface2 transition-colors cursor-pointer border-none"
			>
				Chat
			</button>
			<button
				onclick={handleSave}
				disabled={saving}
				class="px-3 py-1.5 rounded-md text-sm font-medium
					hover:bg-lavender disabled:opacity-50 transition-colors cursor-pointer border-none
					{saved ? 'bg-green text-crust' : 'bg-mauve text-crust'}"
			>
				{saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="px-4 py-2 bg-red/10 text-red text-sm border-b border-surface0">{error}</div>
	{/if}

	{#if !loaded}
		<div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
	{:else}
		<div class="flex gap-1 px-4 py-2 border-b border-surface0 overflow-x-auto">
			{#each tabs as t}
				<button
					onclick={() => tab = t.key}
					class="px-3 py-1 rounded-md text-sm transition-colors cursor-pointer border-none
						{tab === t.key ? 'bg-surface1 text-text font-medium' : 'bg-transparent text-subtext0 hover:text-text'}"
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div class="flex-1 overflow-y-auto p-4">
			{#if tab === 'overview'}
				<div class="max-w-2xl space-y-4">
					<div>
						<label class="block text-xs text-subtext0 mb-1">Name</label>
						<input type="text" bind:value={card.name} class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Description</label>
						<textarea bind:value={card.description} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Scenario</label>
						<textarea bind:value={card.scenario} rows="3" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">First Message</label>
						<textarea bind:value={card.firstMessage} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
					</div>

					<hr class="border-surface1" />

					<GreetingList
						greetings={card.alternateGreetings}
						onchange={(greetings) => { card.alternateGreetings = greetings; }}
					/>

					<hr class="border-surface1" />

					<div>
						<label class="block text-xs text-subtext0 mb-1">Tags</label>
						<input type="text" bind:value={tagsText} placeholder="tag1, tag2, ..." class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve" />
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Creator Notes</label>
						<textarea bind:value={card.creatorNotes} rows="2" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y"></textarea>
					</div>
				</div>

			{:else if tab === 'system'}
				<div class="max-w-2xl space-y-4">
					<div>
						<label class="block text-xs text-subtext0 mb-1">System Prompt</label>
						<textarea bind:value={card.systemPrompt} rows="8" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Post History Instructions</label>
						<textarea bind:value={card.postHistoryInstructions} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Depth Prompt</label>
						<textarea
							value={card.depthPrompt?.prompt ?? ''}
							oninput={(e) => {
								const val = (e.target as HTMLTextAreaElement).value;
								if (val) {
									card.depthPrompt = { prompt: val, depth: card.depthPrompt?.depth ?? 4 };
								} else {
									card.depthPrompt = undefined;
								}
							}}
							rows="4"
							class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"
						></textarea>
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Depth Position</label>
						<input
							type="number"
							value={card.depthPrompt?.depth ?? 4}
							oninput={(e) => {
								const val = parseInt((e.target as HTMLInputElement).value) || 4;
								if (card.depthPrompt) {
									card.depthPrompt = { ...card.depthPrompt, depth: val };
								} else {
									card.depthPrompt = { prompt: '', depth: val };
								}
							}}
							class="w-24 bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve"
						/>
					</div>
				</div>

			{:else if tab === 'lorebook'}
				<div class="max-w-3xl">
					<LorebookEditor
						entries={card.lorebook}
						onchange={(entries) => { card.lorebook = entries; }}
					/>
				</div>

			{:else if tab === 'characters'}
				<div class="max-w-2xl">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-2">
							<h2 class="text-sm font-medium text-text">Characters</h2>
							<span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-subtext0">{card.characters.length}</span>
						</div>
					</div>

					<div class="flex flex-col gap-2 mb-4">
						{#each card.characters as char, i (char.id)}
							{@const isExpanded = expandedCharIds.has(char.id)}
							<div class="rounded-lg border border-surface1 bg-crust overflow-hidden">
								<div
									class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface0 transition-colors cursor-pointer"
									onclick={() => toggleCharExpand(char.id)}
									role="button"
									tabindex="0"
									onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleCharExpand(char.id); }}
								>
									<span class="text-xs text-overlay0 transition-transform" class:rotate-90={isExpanded}>&#9654;</span>
									<span class="text-sm text-text flex-1 truncate">{char.name || 'Unnamed'}</span>
									{#if char.trackState}
										<span class="text-xs px-1.5 py-0.5 rounded bg-blue/20 text-blue">Tracked</span>
									{/if}
									<button
										type="button"
										onclick={(e) => { e.stopPropagation(); removeCharacter(i); }}
										class="px-1.5 py-0.5 rounded text-xs text-red hover:bg-surface0 transition-colors"
									>
										✕
									</button>
								</div>

								{#if isExpanded}
									<div class="px-3 pb-3 border-t border-surface1">
										<WorldCharacterForm
											character={char}
											lorebookEntries={card.lorebook}
											onchange={(updated) => updateCharacter(i, updated)}
											onremove={() => removeCharacter(i)}
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<div class="p-3 rounded-lg bg-surface0 border border-surface1 border-dashed">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newCharName}
								class="flex-1 bg-surface1 text-text text-sm px-2 py-1 rounded border border-surface1 focus:outline-none focus:border-mauve"
								placeholder="Character name"
							/>
							<button
								onclick={addCharacter}
								class="px-3 py-1 bg-mauve text-crust rounded text-sm font-medium hover:bg-lavender transition-colors cursor-pointer border-none"
							>
								Add
							</button>
						</div>
					</div>
				</div>

			{:else if tab === 'scripts'}
				<div class="max-w-2xl space-y-6">
					<RegexEditor
						scripts={card.regexScripts}
						onchange={(scripts) => { card.regexScripts = scripts; }}
					/>
					<hr class="border-surface1" />
					<TriggerEditor
						triggers={card.triggers}
						onchange={(triggers) => { card.triggers = triggers; }}
					/>
				</div>

			{:else if tab === 'settings'}
				<div class="max-w-2xl">
					<WorldSettingsEditor
						settings={card.worldSettings ?? {}}
						onchange={(settings) => { card.worldSettings = settings; }}
						{providerIds}
					/>
				</div>

			{:else if tab === 'theme'}
				<div class="max-w-2xl space-y-4">
					<div>
						<label class="block text-xs text-subtext0 mb-1">Background HTML</label>
						<textarea bind:value={card.backgroundHTML} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
					</div>
					<div>
						<label class="block text-xs text-subtext0 mb-1">Background CSS</label>
						<textarea bind:value={card.backgroundCSS} rows="4" class="w-full bg-surface0 text-text text-sm px-3 py-2 rounded-lg border border-surface1 focus:outline-none focus:border-mauve resize-y font-mono"></textarea>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
