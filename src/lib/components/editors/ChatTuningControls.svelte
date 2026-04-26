<script lang="ts">
  import {
    OUTPUT_LANGUAGE_OPTIONS,
    RESPONSE_LENGTH_TIERS,
    clampTargetImageCount,
    getResponseLengthTier,
    type ResponseLengthTierId,
  } from '$lib/types/chat-settings';

  let {
    responseLengthTier = $bindable('standard' as ResponseLengthTierId),
    outputLanguage = $bindable(''),
    autoGenerate = $bindable(false),
    targetImageCount = $bindable(2),
    imageProviderAvailable = false,
  }: {
    responseLengthTier: ResponseLengthTierId;
    outputLanguage: string;
    autoGenerate: boolean;
    targetImageCount: number;
    imageProviderAvailable?: boolean;
  } = $props();

  const activeTier = $derived(getResponseLengthTier(responseLengthTier));
  const maxImages = $derived(activeTier.maxImages);

  $effect(() => {
    const clamped = clampTargetImageCount(targetImageCount, responseLengthTier);
    if (clamped !== targetImageCount) {
      targetImageCount = clamped;
    }
  });
</script>

<section class="space-y-4 rounded-lg border border-surface1 p-4">
  <div>
    <h2 class="text-sm font-medium text-text">Response Length</h2>
    <p class="text-xs text-subtext0">Choose how much the assistant should write. Each tier also sets the maximum illustration cap.</p>
  </div>

  <div class="grid gap-2">
    {#each RESPONSE_LENGTH_TIERS as tier}
      <button
        type="button"
        onclick={() => { responseLengthTier = tier.id; }}
        class="rounded-md border px-3 py-3 text-left transition-colors
          {responseLengthTier === tier.id
            ? 'border-mauve bg-mauve/10'
            : 'border-surface1 bg-surface0/40 hover:bg-surface0'}"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-medium text-text">{tier.label}</div>
            <div class="text-xs text-subtext0">{tier.paragraphLabel}</div>
          </div>
          <div class="text-xs text-subtext0">Up to {tier.maxImages} image(s)</div>
        </div>
        <p class="mt-2 text-xs text-subtext0">{tier.description}</p>
      </button>
    {/each}
  </div>
</section>

<section class="space-y-4 rounded-lg border border-surface1 p-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <h2 class="text-sm font-medium text-text">Auto Illustrations</h2>
      <p class="text-xs text-subtext0">Generate images automatically after the assistant reply finishes.</p>
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

  <div class="space-y-1">
    <label for="quick-target-count" class="text-sm text-text">Target Images Per Response: {targetImageCount}</label>
    <input
      id="quick-target-count"
      type="range"
      min="1"
      max={maxImages}
      step="1"
      value={targetImageCount}
      oninput={(e) => { targetImageCount = clampTargetImageCount(Number((e.target as HTMLInputElement).value), responseLengthTier); }}
      class="w-full accent-mauve"
    />
    <p class="text-xs text-subtext0">
      {activeTier.label} currently allows up to {maxImages} image(s).
      {#if !imageProviderAvailable}
        Select an image provider in Image Generation settings before auto illustrations can run.
      {/if}
    </p>
  </div>
</section>

<section class="space-y-2 rounded-lg border border-surface1 p-4">
  <div>
    <h2 class="text-sm font-medium text-text">Output Language</h2>
    <p class="text-xs text-subtext0">Override the response language for the next turns.</p>
  </div>

  <select
    bind:value={outputLanguage}
    class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1 focus:outline-none focus:border-mauve"
  >
    {#each OUTPUT_LANGUAGE_OPTIONS as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</section>
