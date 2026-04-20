<script lang="ts">
	import { DEFAULT_ART_PRESETS } from '$lib/types';
	import type { ArtStylePreset } from '$lib/types/art-style';

	let {
		artStylePresetId = $bindable(),
		customPresets = $bindable(),
		positivePrompt = $bindable(),
		negativePrompt = $bindable(),
	}: {
		artStylePresetId: string;
		customPresets: ArtStylePreset[];
		positivePrompt: string;
		negativePrompt: string;
	} = $props();

	let showPresetEditor = $state(false);
	let editingPreset: ArtStylePreset | null = $state(null);
	let newPresetName = $state('');
	let newPresetPositive = $state('');
	let newPresetNegative = $state('');

	const allPresets = $derived([...DEFAULT_ART_PRESETS, ...customPresets]);

	function handlePresetChange(id: string) {
		artStylePresetId = id;
		const preset = allPresets.find((p) => p.id === id);
		if (preset) {
			positivePrompt = preset.positivePrompt;
			negativePrompt = preset.negativePrompt;
		}
	}

	function handleNewPreset() {
		newPresetName = '';
		newPresetPositive = positivePrompt;
		newPresetNegative = negativePrompt;
		editingPreset = null;
		showPresetEditor = true;
	}

	function handleEditPreset(id: string) {
		const preset = customPresets.find((p) => p.id === id);
		if (!preset) return;
		newPresetName = preset.name;
		newPresetPositive = preset.positivePrompt;
		newPresetNegative = preset.negativePrompt;
		editingPreset = preset;
		showPresetEditor = true;
	}

	function handleSavePreset() {
		if (!newPresetName.trim()) return;
		if (editingPreset) {
			const idx = customPresets.findIndex((p) => p.id === editingPreset!.id);
			if (idx >= 0) {
				customPresets[idx] = {
					...editingPreset,
					name: newPresetName,
					positivePrompt: newPresetPositive,
					negativePrompt: newPresetNegative,
				};
				customPresets = [...customPresets];
			}
		} else {
			const newPreset: ArtStylePreset = {
				id: crypto.randomUUID(),
				name: newPresetName,
				positivePrompt: newPresetPositive,
				negativePrompt: newPresetNegative,
			};
			customPresets = [...customPresets, newPreset];
			artStylePresetId = newPreset.id;
			positivePrompt = newPreset.positivePrompt;
			negativePrompt = newPreset.negativePrompt;
		}
		showPresetEditor = false;
		editingPreset = null;
	}

	function handleDeletePreset(id: string) {
		customPresets = customPresets.filter((p) => p.id !== id);
		if (artStylePresetId === id) {
			handlePresetChange('anime');
		}
	}
</script>

<section class="space-y-3">
	<h2 class="text-sm font-medium text-text">Art Style Preset</h2>
	<select
		value={artStylePresetId}
		onchange={(e) => handlePresetChange((e.target as HTMLSelectElement).value)}
		class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
			   focus:outline-none focus:border-mauve"
	>
		<optgroup label="Built-in">
			{#each DEFAULT_ART_PRESETS as preset}
				<option value={preset.id}>{preset.name}</option>
			{/each}
		</optgroup>
		{#if customPresets.length > 0}
			<optgroup label="My Presets">
				{#each customPresets as preset}
					<option value={preset.id}>{preset.name}</option>
				{/each}
			</optgroup>
		{/if}
	</select>

	<div class="flex gap-2">
		<button
			type="button"
			onclick={handleNewPreset}
			class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2"
		>
			+ New
		</button>
		{#if customPresets.find((p) => p.id === artStylePresetId)}
			<button
				type="button"
				onclick={() => handleEditPreset(artStylePresetId)}
				class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2"
			>
				Edit
			</button>
			<button
				type="button"
				onclick={() => handleDeletePreset(artStylePresetId)}
				class="text-xs bg-surface1 text-red px-3 py-1 rounded hover:bg-surface2"
			>
				Delete
			</button>
		{/if}
	</div>

	{#if showPresetEditor}
		<div class="space-y-2 p-3 bg-surface0 rounded-md border border-surface1">
			<input
				bind:value={newPresetName}
				placeholder="Preset name"
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
			/>
			<textarea
				bind:value={newPresetPositive}
				rows={2}
				placeholder="Positive prompt"
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve resize-y"
			></textarea>
			<textarea
				bind:value={newPresetNegative}
				rows={2}
				placeholder="Negative prompt"
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve resize-y"
			></textarea>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={handleSavePreset}
					class="text-xs bg-mauve text-crust px-3 py-1 rounded hover:opacity-90"
				>
					Save Preset
				</button>
				<button
					type="button"
					onclick={() => { showPresetEditor = false; }}
					class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<div class="space-y-1">
		<label class="text-xs font-medium text-subtext0" for="positive-prompt">Positive Prompt</label>
		<textarea
			id="positive-prompt"
			bind:value={positivePrompt}
			rows={3}
			class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
				   focus:outline-none focus:border-mauve resize-y"
			placeholder="Tags and phrases to include in generated images..."
		></textarea>
	</div>

	<div class="space-y-1">
		<label class="text-xs font-medium text-subtext0" for="negative-prompt">Negative Prompt</label>
		<textarea
			id="negative-prompt"
			bind:value={negativePrompt}
			rows={3}
			class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
				   focus:outline-none focus:border-mauve resize-y"
			placeholder="Tags and phrases to exclude from generated images..."
		></textarea>
	</div>
</section>
