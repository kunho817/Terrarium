<script lang="ts">
	import { NOVELAI_SAMPLERS } from '$lib/core/image-gen/novelai-constants';

	let {
		provider = $bindable(),
		novelaiApiKey = $bindable(),
		novelaiModel = $bindable(),
		novelaiWidth = $bindable(),
		novelaiHeight = $bindable(),
		novelaiSteps = $bindable(),
		novelaiScale = $bindable(),
		novelaiSampler = $bindable(),
		novelaiNoiseSchedule = $bindable(),
		comfyuiUrl = $bindable(),
		comfyuiWorkflow = $bindable(),
		comfyuiTimeout = $bindable(),
		modelGroups,
		compatibleSchedules,
	}: {
		provider: string;
		novelaiApiKey: string;
		novelaiModel: string;
		novelaiWidth: number;
		novelaiHeight: number;
		novelaiSteps: number;
		novelaiScale: number;
		novelaiSampler: string;
		novelaiNoiseSchedule: string;
		comfyuiUrl: string;
		comfyuiWorkflow: string;
		comfyuiTimeout: number;
		modelGroups: () => [string, { value: string; label: string }[]][];
		compatibleSchedules: { value: string; label: string }[];
	} = $props();
</script>

<section class="space-y-3">
	<h2 class="text-sm font-medium text-text">Image Provider</h2>
	<select
		bind:value={provider}
		class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
			   focus:outline-none focus:border-mauve"
	>
		<option value="none">None</option>
		<option value="novelai">NovelAI</option>
		<option value="comfyui">ComfyUI</option>
	</select>
	<p class="text-xs text-subtext0">Select the image generation provider to use for illustrations.</p>
</section>

{#if provider === 'novelai'}
	<section class="space-y-3">
		<h2 class="text-sm font-medium text-text">NovelAI Settings</h2>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-key">API Key</label>
			<input
				id="nai-key"
				type="password"
				bind:value={novelaiApiKey}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
				placeholder="Your NovelAI API key"
			/>
		</div>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-model">Model</label>
			<select
				id="nai-model"
				bind:value={novelaiModel}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
			>
				{#each modelGroups() as [group, models]}
					<optgroup label={group}>
						{#each models as model}
							<option value={model.value}>{model.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-width">Width</label>
				<input
					id="nai-width"
					type="number"
					bind:value={novelaiWidth}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
						   focus:outline-none focus:border-mauve"
				/>
			</div>
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-height">Height</label>
				<input
					id="nai-height"
					type="number"
					bind:value={novelaiHeight}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
						   focus:outline-none focus:border-mauve"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-steps">Steps</label>
				<input
					id="nai-steps"
					type="number"
					bind:value={novelaiSteps}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
						   focus:outline-none focus:border-mauve"
				/>
			</div>
			<div class="space-y-1">
				<label class="text-xs font-medium text-subtext0" for="nai-scale">CFG Scale</label>
				<input
					id="nai-scale"
					type="number"
					bind:value={novelaiScale}
					class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
						   focus:outline-none focus:border-mauve"
				/>
			</div>
		</div>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-sampler">Sampler</label>
			<select
				id="nai-sampler"
				bind:value={novelaiSampler}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
			>
				{#each NOVELAI_SAMPLERS as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</div>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="nai-noise-schedule">Noise Schedule</label>
			<select
				id="nai-noise-schedule"
				bind:value={novelaiNoiseSchedule}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
			>
				{#each compatibleSchedules as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</div>
	</section>
{/if}

{#if provider === 'comfyui'}
	<section class="space-y-3">
		<h2 class="text-sm font-medium text-text">ComfyUI Settings</h2>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="cui-url">Server URL</label>
			<input
				id="cui-url"
				type="text"
				bind:value={comfyuiUrl}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
				placeholder="http://localhost:8188"
			/>
		</div>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="cui-workflow">Workflow JSON</label>
			<textarea
				id="cui-workflow"
				bind:value={comfyuiWorkflow}
				rows={8}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve resize-y font-mono"
				placeholder="Paste your ComfyUI workflow JSON here..."
			></textarea>
		</div>

		<div class="space-y-1">
			<label class="text-xs font-medium text-subtext0" for="cui-timeout">Timeout (seconds)</label>
			<input
				id="cui-timeout"
				type="number"
				bind:value={comfyuiTimeout}
				class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
					   focus:outline-none focus:border-mauve"
			/>
		</div>
	</section>
{/if}
