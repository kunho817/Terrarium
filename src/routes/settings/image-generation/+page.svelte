<script lang="ts">
	import { onMount } from 'svelte';
	import { settingsStore } from '$lib/stores/settings';
	import { settingsRepo } from '$lib/repositories/settings-repo';
	import { DEFAULT_ART_PRESETS } from '$lib/types';
	import type { ImageGenerationConfig } from '$lib/types';
	import { DEFAULT_IMAGE_CONFIG, DEFAULT_IMAGE_JAILBREAK, DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS } from '$lib/types';
	import { clampTargetImageCount, getResponseLengthTier } from '$lib/types/chat-settings';
	import { NOVELAI_MODELS, getCompatibleNoiseSchedules } from '$lib/core/image-gen/novelai-constants';
	import type { ArtStylePreset } from '$lib/types/art-style';
	import { getRegistry } from '$lib/core/bootstrap';
	import { ImageGenerator, resolveArtStyle } from '$lib/core/image/generator';

	import ImageProviderConfig from '$lib/components/editors/ImageProviderConfig.svelte';
	import ImagePromptConfig from '$lib/components/editors/ImagePromptConfig.svelte';
	import ImagePresetManager from '$lib/components/editors/ImagePresetManager.svelte';
	import ImageTestPanel from '$lib/components/editors/ImageTestPanel.svelte';

	let loaded = $state(false);

	let provider = $state<string>('none');
	let autoGenerate = $state(false);
	let artStylePresetId = $state('anime');
	let imagePromptInstructions = $state('');
	let jailbreak = $state(DEFAULT_IMAGE_JAILBREAK);
	let positivePrompt = $state('');
	let negativePrompt = $state('');
	let maxTokens = $state(64000);
	let targetImageCount = $state(2);
	let placementInstructions = $state(DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS);

	let novelaiApiKey = $state('');
	let novelaiModel = $state('');
	let novelaiWidth = $state(832);
	let novelaiHeight = $state(1216);
	let novelaiSteps = $state(28);
	let novelaiScale = $state(5);
	let novelaiSampler = $state('');
	let novelaiNoiseSchedule = $state('karras');

	let comfyuiUrl = $state('');
	let comfyuiWorkflow = $state('');
	let comfyuiTimeout = $state(60);

	let customPresets = $state<ArtStylePreset[]>([]);

	let testPrompt = $state('1girl, smile, beautiful scenery, detailed');
	let testGenerating = $state(false);
	let testResult: string | null = $state(null);
	let testError: string | null = $state(null);
	let testFullPrompt: string | null = $state(null);

	const allPresets = $derived([...DEFAULT_ART_PRESETS, ...customPresets]);
	const compatibleSchedules = $derived(getCompatibleNoiseSchedules(novelaiModel, novelaiSampler));
	const activeResponseLengthTier = $derived(getResponseLengthTier($settingsStore.responseLengthTier));
	const maxImagesForTier = $derived(activeResponseLengthTier.maxImages);

	const modelGroups = $derived(() => {
		const groups: Record<string, typeof NOVELAI_MODELS> = {};
		for (const m of NOVELAI_MODELS) {
			if (!groups[m.group]) groups[m.group] = [];
			groups[m.group].push(m);
		}
		return Object.entries(groups);
	});

	function loadFromStore() {
		const ig = $settingsStore.imageGeneration ?? { ...DEFAULT_IMAGE_CONFIG };
		provider = ig.provider ?? 'none';
		autoGenerate = ig.autoGenerate ?? false;
		artStylePresetId = ig.artStylePresetId ?? 'anime';
		jailbreak = ig.jailbreak ?? DEFAULT_IMAGE_JAILBREAK;
		maxTokens = ig.maxTokens ?? 64000;
		targetImageCount = clampTargetImageCount(ig.targetImageCount ?? 2, $settingsStore.responseLengthTier);
		placementInstructions = ig.placementInstructions ?? DEFAULT_IMAGE_PLACEMENT_INSTRUCTIONS;
		imagePromptInstructions = ig.imagePromptInstructions ?? DEFAULT_IMAGE_CONFIG.imagePromptInstructions;

		novelaiApiKey = ig.novelai?.apiKey ?? '';
		novelaiModel = ig.novelai?.model ?? 'nai-diffusion-4-5-full';
		novelaiWidth = ig.novelai?.width ?? 832;
		novelaiHeight = ig.novelai?.height ?? 1216;
		novelaiSteps = ig.novelai?.steps ?? 28;
		novelaiScale = ig.novelai?.scale ?? 5;
		novelaiSampler = ig.novelai?.sampler ?? 'k_euler_ancestral';
		novelaiNoiseSchedule = ig.novelai?.noiseSchedule ?? 'karras';

		comfyuiUrl = ig.comfyui?.url ?? 'http://localhost:8188';
		comfyuiWorkflow = ig.comfyui?.workflow ?? '';
		comfyuiTimeout = ig.comfyui?.timeout ?? 60;

		const settings = $settingsStore;
		customPresets = settings.customArtStylePresets ?? [];

		const preset = allPresets.find((p) => p.id === artStylePresetId) ?? DEFAULT_ART_PRESETS[0];
		positivePrompt = preset.positivePrompt;
		negativePrompt = preset.negativePrompt;
	}

	function buildConfig(): ImageGenerationConfig {
		const clampedTargetImageCount = clampTargetImageCount(targetImageCount, $settingsStore.responseLengthTier);
		return {
			...($settingsStore.imageGeneration ?? DEFAULT_IMAGE_CONFIG),
			provider: provider as ImageGenerationConfig['provider'],
			autoGenerate,
			artStylePresetId,
			jailbreak,
			maxTokens,
			targetImageCount: clampedTargetImageCount,
			placementInstructions,
			imagePromptInstructions,
			novelai: {
				apiKey: novelaiApiKey,
				model: novelaiModel,
				width: novelaiWidth,
				height: novelaiHeight,
				steps: novelaiSteps,
				scale: novelaiScale,
				sampler: novelaiSampler,
				noiseSchedule: novelaiNoiseSchedule,
			},
			comfyui: {
				url: comfyuiUrl,
				workflow: comfyuiWorkflow,
				timeout: comfyuiTimeout,
			},
		};
	}

	async function handleSave() {
		settingsStore.update({
			imageGeneration: buildConfig(),
			customArtStylePresets: customPresets,
		});
		await settingsRepo.save();
	}

	async function handleTestGenerate() {
		testGenerating = true;
		testResult = null;
		testError = null;
		testFullPrompt = null;

		try {
			const imageConfig = buildConfig();
			if (imageConfig.provider === 'none') {
				testError = 'No image provider selected.';
				return;
			}

			if (imageConfig.provider === 'novelai' && !imageConfig.novelai.apiKey) {
				testError = 'NovelAI API key is required.';
				return;
			}

			const artStyle = resolveArtStyle(artStylePresetId, customPresets);
			const generator = new ImageGenerator(getRegistry());

			const result = await generator.generateDirect(testPrompt, imageConfig, artStyle);
			testResult = result.dataUrl;
			testFullPrompt = result.prompt;
		} catch (e: any) {
			testError = e?.message || String(e);
		} finally {
			testGenerating = false;
		}
	}

	onMount(async () => {
		await settingsRepo.load();
		loadFromStore();
		loaded = true;
	});

	$effect(() => {
		const clamped = clampTargetImageCount(targetImageCount, $settingsStore.responseLengthTier);
		if (clamped !== targetImageCount) {
			targetImageCount = clamped;
		}
	});
</script>

{#if !loaded}
	<div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
	<div class="flex-1 overflow-y-auto">
		<div class="max-w-2xl mx-auto p-6 space-y-8">
			<div class="flex items-center justify-between">
				<h1 class="text-lg font-semibold text-text">Image Generation</h1>
				<a
					href="/settings"
					class="text-mauve hover:text-lavender text-sm"
				>
					&larr; Back to Settings
				</a>
			</div>

			<ImageProviderConfig
				bind:provider
				bind:novelaiApiKey
				bind:novelaiModel
				bind:novelaiWidth
				bind:novelaiHeight
				bind:novelaiSteps
				bind:novelaiScale
				bind:novelaiSampler
				bind:novelaiNoiseSchedule
				bind:comfyuiUrl
				bind:comfyuiWorkflow
				bind:comfyuiTimeout
				{modelGroups}
				{compatibleSchedules}
			/>

			<ImagePromptConfig
				bind:autoGenerate
				bind:imagePromptInstructions
				bind:jailbreak
				bind:positivePrompt
				bind:negativePrompt
			/>

			<section class="space-y-2 rounded-lg border border-surface1 p-4">
				<div>
					<h2 class="text-sm font-medium text-text">Prompt Model Budget</h2>
					<p class="text-xs text-subtext0">Maximum tokens for the illustration planning and tag-generation model.</p>
				</div>

				<div class="space-y-1">
					<label for="image-max-tokens" class="text-sm text-text">Max Tokens: {maxTokens}</label>
					<input
						id="image-max-tokens"
						type="range"
						min="4096"
						max="64000"
						step="512"
						value={maxTokens}
						oninput={(e) => { maxTokens = Number((e.target as HTMLInputElement).value); }}
						class="w-full accent-mauve"
					/>
				</div>
			</section>

			<section class="space-y-4 rounded-lg border border-surface1 p-4">
				<div>
					<h2 class="text-sm font-medium text-text">Illustration Placement</h2>
					<p class="text-xs text-subtext0">Guide how many images should appear and which moments deserve them. The current response-length profile allows up to {maxImagesForTier} image(s).</p>
				</div>

				<div class="space-y-1">
					<label for="image-target-count" class="text-sm text-text">Target Images Per Response: {targetImageCount}</label>
					<input
						id="image-target-count"
						type="range"
						min="1"
						max={maxImagesForTier}
						step="1"
						value={targetImageCount}
						oninput={(e) => { targetImageCount = clampTargetImageCount(Number((e.target as HTMLInputElement).value), $settingsStore.responseLengthTier); }}
						class="w-full accent-mauve"
					/>
					<p class="text-xs text-subtext0">The planner will aim for this many inserts, but can return fewer when the response lacks enough distinct visual beats. Adjust the response-length profile in <a href="/settings/chat-controls" class="text-mauve hover:text-lavender">Chat Controls</a> to raise or lower the cap.</p>
				</div>

				<div class="space-y-1">
					<label for="image-placement-instructions" class="text-sm text-text">Placement Guidance</label>
					<textarea
						id="image-placement-instructions"
						rows="5"
						value={placementInstructions}
						oninput={(e) => { placementInstructions = (e.target as HTMLTextAreaElement).value; }}
						class="w-full rounded-md border border-surface1 bg-base px-3 py-2 text-sm text-text"
						placeholder="Describe which kinds of moments should receive illustrations..."
					></textarea>
					<p class="text-xs text-subtext0">This guidance is sent to the illustration planner so it can choose fitting insertion points.</p>
				</div>
			</section>

			<ImagePresetManager
				bind:artStylePresetId
				bind:customPresets
				bind:positivePrompt
				bind:negativePrompt
			/>

			{#if provider !== 'none'}
				<ImageTestPanel
					bind:testPrompt
					{testGenerating}
					{testResult}
					{testError}
					{testFullPrompt}
					ongenerate={handleTestGenerate}
				/>
			{/if}

			<div class="pt-2 pb-6">
				<button
					type="button"
					onclick={handleSave}
					class="bg-mauve text-crust rounded-md px-4 py-2 text-sm font-medium
						   hover:opacity-90 transition-opacity"
				>
					Save Settings
				</button>
			</div>
		</div>
	</div>
{/if}
