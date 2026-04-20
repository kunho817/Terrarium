<script lang="ts">
	let {
		autoGenerate = $bindable(),
		imagePromptInstructions = $bindable(),
		positivePrompt = $bindable(),
		negativePrompt = $bindable(),
	}: {
		autoGenerate: boolean;
		imagePromptInstructions: string;
		positivePrompt: string;
		negativePrompt: string;
	} = $props();
</script>

<section class="space-y-3">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-sm font-medium text-text">Auto-generate Illustrations</h2>
			<p class="text-xs text-subtext0">Automatically generate images during roleplay based on scene context.</p>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={autoGenerate}
			aria-label="Auto-generate illustrations"
			onclick={() => { autoGenerate = !autoGenerate; }}
			class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
				   transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-mauve focus:ring-offset-2 focus:ring-offset-base
				   {autoGenerate ? 'bg-mauve' : 'bg-surface1'}"
		>
			<span
				class="pointer-events-none inline-block h-5 w-5 rounded-full bg-text shadow ring-0
					   transition-transform duration-200 ease-in-out
					   {autoGenerate ? 'translate-x-5' : 'translate-x-0'}"
			></span>
		</button>
	</div>
</section>

<section class="space-y-3">
	<div>
		<h2 class="text-sm font-medium text-text">Image Prompt Instructions</h2>
		<p class="text-xs text-subtext0">Instructions for the AI when generating image prompts from scene context.</p>
	</div>
	<textarea
		bind:value={imagePromptInstructions}
		rows={6}
		class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
			   focus:outline-none focus:border-mauve resize-y"
		placeholder="Describe how the AI should generate image prompts..."
	></textarea>
</section>
