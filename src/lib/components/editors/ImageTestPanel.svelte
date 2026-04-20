<script lang="ts">
	let {
		testPrompt = $bindable(),
		testGenerating,
		testResult,
		testError,
		testFullPrompt,
		ongenerate,
	}: {
		testPrompt: string;
		testGenerating: boolean;
		testError: string | null;
		testResult: string | null;
		testFullPrompt: string | null;
		ongenerate: () => void;
	} = $props();
</script>

<section class="space-y-3">
	<div>
		<h2 class="text-sm font-medium text-text">Test Image Generation</h2>
		<p class="text-xs text-subtext0">Generate a test image with your current settings to verify everything works.</p>
	</div>

	<div class="space-y-1">
		<label class="text-xs font-medium text-subtext0" for="test-prompt">Test Prompt</label>
		<input
			id="test-prompt"
			type="text"
			bind:value={testPrompt}
			disabled={testGenerating}
			class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
				   focus:outline-none focus:border-mauve disabled:opacity-50"
			placeholder="1girl, smile, beautiful scenery, detailed"
		/>
	</div>

	<button
		type="button"
		onclick={ongenerate}
		disabled={testGenerating || !testPrompt.trim()}
		class="bg-surface1 text-text rounded-md px-4 py-2 text-sm font-medium
			   hover:bg-surface2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
	>
		{testGenerating ? 'Generating...' : 'Generate Test Image'}
	</button>

	{#if testGenerating}
		<div class="flex items-center gap-2 text-xs text-subtext0">
			<div class="w-3 h-3 border-2 border-mauve border-t-transparent rounded-full animate-spin"></div>
			Generating image... This may take a moment.
		</div>
	{/if}

	{#if testError}
		<div class="p-3 bg-red/10 border border-red/30 rounded-md">
			<p class="text-xs text-red font-medium">Error</p>
			<p class="text-xs text-red mt-1">{testError}</p>
		</div>
	{/if}

	{#if testFullPrompt}
		<div class="p-2 bg-surface0 rounded-md border border-surface1">
			<p class="text-xs text-subtext0 mb-1">Combined prompt sent to provider:</p>
			<p class="text-xs text-text break-all">{testFullPrompt}</p>
		</div>
	{/if}

	{#if testResult}
		<div class="space-y-2">
			<p class="text-xs text-green font-medium">Success!</p>
			<div class="inline-block bg-surface0 rounded-lg border border-surface1 overflow-hidden">
				<img src={testResult} alt="Generated preview" class="max-w-sm max-h-96" />
			</div>
		</div>
	{/if}
</section>
