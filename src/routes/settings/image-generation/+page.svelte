<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { DEFAULT_ART_PRESETS } from '$lib/types';
  import type { ImageGenerationConfig } from '$lib/types';
  import { DEFAULT_IMAGE_CONFIG } from '$lib/types';

  let loaded = $state(false);

  let provider = $state<string>('none');
  let autoGenerate = $state(false);
  let artStylePresetId = $state('anime');
  let imagePromptInstructions = $state('');
  let positivePrompt = $state('');
  let negativePrompt = $state('');

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

  let selectedPreset = $derived(
    DEFAULT_ART_PRESETS.find((p) => p.id === artStylePresetId) ?? DEFAULT_ART_PRESETS[0]
  );

  function loadFromStore() {
    const ig = $settingsStore.imageGeneration ?? { ...DEFAULT_IMAGE_CONFIG };
    provider = ig.provider ?? 'none';
    autoGenerate = ig.autoGenerate ?? false;
    artStylePresetId = ig.artStylePresetId ?? 'anime';
    imagePromptInstructions = ig.imagePromptInstructions ?? DEFAULT_IMAGE_CONFIG.imagePromptInstructions;

    const preset = DEFAULT_ART_PRESETS.find((p) => p.id === artStylePresetId) ?? DEFAULT_ART_PRESETS[0];
    positivePrompt = preset.positivePrompt;
    negativePrompt = preset.negativePrompt;

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
  }

  function handlePresetChange(id: string) {
    artStylePresetId = id;
    const preset = DEFAULT_ART_PRESETS.find((p) => p.id === id) ?? DEFAULT_ART_PRESETS[0];
    positivePrompt = preset.positivePrompt;
    negativePrompt = preset.negativePrompt;
  }

  function buildConfig(): ImageGenerationConfig {
    return {
      provider: provider as ImageGenerationConfig['provider'],
      autoGenerate,
      artStylePresetId,
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
    settingsStore.update({ imageGeneration: buildConfig() });
    await settingsStore.save();
  }

  onMount(async () => {
    await settingsStore.load();
    loadFromStore();
    loaded = true;
  });
</script>

{#if !loaded}
  <div class="flex-1 flex items-center justify-center text-subtext0">Loading...</div>
{:else}
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6 space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-text">Image Generation</h1>
        <a
          href="/settings"
          class="text-mauve hover:text-lavender text-sm"
        >
          &larr; Back to Settings
        </a>
      </div>

      <!-- Section 1: Provider Selection -->
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

      <!-- Section 2: Auto-Generate Toggle -->
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

      <!-- Section 3: Art Style Preset -->
      <section class="space-y-3">
        <h2 class="text-sm font-medium text-text">Art Style Preset</h2>
        <select
          value={artStylePresetId}
          onchange={(e) => handlePresetChange((e.target as HTMLSelectElement).value)}
          class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                 focus:outline-none focus:border-mauve"
        >
          {#each DEFAULT_ART_PRESETS as preset}
            <option value={preset.id}>{preset.name}</option>
          {/each}
        </select>

        <!-- Positive Prompt -->
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

        <!-- Negative Prompt -->
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

      <!-- Section 4: Image Prompt Instructions -->
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

      <!-- Section 5: NovelAI Settings -->
      {#if provider === 'novelai'}
        <section class="space-y-3">
          <h2 class="text-sm font-medium text-text">NovelAI Settings</h2>

          <!-- API Key -->
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

          <!-- Model -->
          <div class="space-y-1">
            <label class="text-xs font-medium text-subtext0" for="nai-model">Model</label>
            <input
              id="nai-model"
              type="text"
              bind:value={novelaiModel}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
              placeholder="nai-diffusion-4-5-full"
            />
          </div>

          <!-- Width & Height -->
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

          <!-- Steps & CFG Scale -->
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

          <!-- Sampler -->
          <div class="space-y-1">
            <label class="text-xs font-medium text-subtext0" for="nai-sampler">Sampler</label>
            <input
              id="nai-sampler"
              type="text"
              bind:value={novelaiSampler}
              class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
                     focus:outline-none focus:border-mauve"
              placeholder="k_euler_ancestral"
            />
          </div>
        </section>
      {/if}

      <!-- Section 6: ComfyUI Settings -->
      {#if provider === 'comfyui'}
        <section class="space-y-3">
          <h2 class="text-sm font-medium text-text">ComfyUI Settings</h2>

          <!-- URL -->
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

          <!-- Workflow JSON -->
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

          <!-- Timeout -->
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

      <!-- Save Button -->
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
