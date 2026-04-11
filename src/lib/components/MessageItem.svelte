<script lang="ts">
  import type { Message } from '$lib/types';
  import { settingsStore } from '$lib/stores/settings';
  import GenerationInfoBadge from './GenerationInfoBadge.svelte';
  import GenerationInfoPanel from './GenerationInfoPanel.svelte';
  import ImageModal from './ImageModal.svelte';

  let { message } = $props<{ message: Message }>();

  let showPanel = $state(false);
  let showImage = $state(false);

  const imageSrc = $derived(
    message.image?.filename
      ? `https://asset.localhost/${message.image.filename}`
      : ''
  );

  const roleStyles: Record<string, string> = {
    user: 'border-l-2 border-l-blue pl-3',
    assistant: 'border-l-2 border-l-mauve pl-3',
    narrator: 'border-l-2 border-l-overlay0 pl-3 bg-surface0/30 rounded-r-lg italic',
    system: 'border-l-2 border-l-yellow pl-3 text-subtext0 text-sm',
  };
</script>

<div class="py-2 {roleStyles[message.role] || ''}">
  <p class="text-text text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

  {#if message.image && imageSrc}
    <div class="mt-2">
      <button onclick={() => showImage = true} class="block max-w-xs cursor-pointer bg-transparent border-none p-0">
        <img src={imageSrc} alt="Generated illustration" class="rounded-lg max-w-full hover:opacity-90 transition-opacity" />
      </button>
    </div>
  {/if}

  {#if $settingsStore.developerMode && message.role === 'assistant' && message.generationInfo}
    <div class="mt-1.5">
      <GenerationInfoBadge info={message.generationInfo} onclick={() => showPanel = true} />
    </div>
  {/if}
</div>

{#if showPanel && message.generationInfo}
  <GenerationInfoPanel info={message.generationInfo} onclose={() => showPanel = false} />
{/if}

{#if showImage && imageSrc}
  <ImageModal src={imageSrc} onclose={() => showImage = false} />
{/if}
