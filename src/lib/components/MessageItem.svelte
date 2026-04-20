<script lang="ts">
  import type { Message } from '$lib/types';
  import { settingsStore } from '$lib/stores/settings';
  import { formatChatText } from '$lib/core/chat/text-formatter';
  import GenerationInfoBadge from './GenerationInfoBadge.svelte';
  import GenerationInfoPanel from './GenerationInfoPanel.svelte';
  import ImageModal from './ImageModal.svelte';

  let {
    message,
    index,
    onedit,
    onreroll,
  }: {
    message: Message;
    index: number;
    onedit: (index: number, newContent: string) => Promise<void>;
    onreroll: (userMessageIndex: number) => Promise<void>;
  } = $props();

  let showPanel = $state(false);
  let showImage = $state(false);
  let modalSrc = $state('');
  let editing = $state(false);
  let editContent = $state('');
  let hovered = $state(false);

  function openImage(src: string) {
    modalSrc = src;
    showImage = true;
  }

  function fmt(text: string): string {
    return message.role === 'assistant' ? formatChatText(text) : text;
  }

  function startEdit() {
    editContent = message.content;
    editing = true;
  }

  async function saveEdit() {
    if (editContent.trim() && editContent !== message.content) {
      await onedit(index, editContent.trim());
    }
    editing = false;
  }

  function cancelEdit() {
    editing = false;
  }

  function handleReroll() {
    if (message.role === 'assistant' && index > 0) {
      onreroll(index - 1);
    } else if (message.role === 'user') {
      onreroll(index);
    }
  }

  const roleStyles: Record<string, string> = {
    user: 'border-l-2 border-l-blue pl-3',
    assistant: 'border-l-2 border-l-mauve pl-3',
    narrator: 'border-l-2 border-l-overlay0 pl-3 bg-surface0/30 rounded-r-lg italic',
    system: 'border-l-2 border-l-yellow pl-3 text-subtext0 text-sm',
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative group py-2 {roleStyles[message.role] || ''}"
  onmouseenter={() => hovered = true}
  onmouseleave={() => hovered = false}
>
  <!-- Action buttons -->
  {#if hovered && !editing && !message.isFirstMessage}
    <div class="absolute -top-1 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {#if message.role === 'user'}
        <button
          onclick={startEdit}
          class="text-xs text-subtext0 hover:text-text bg-surface0 px-1.5 py-0.5 rounded cursor-pointer border-none"
          title="Edit message"
        >
          ✎
        </button>
      {/if}
      {#if message.role === 'assistant'}
        <button
          onclick={handleReroll}
          class="text-xs text-subtext0 hover:text-text bg-surface0 px-1.5 py-0.5 rounded cursor-pointer border-none"
          title="Reroll response"
        >
          ↻
        </button>
      {/if}
    </div>
  {/if}

  <!-- Edit mode -->
  {#if editing}
    <div class="space-y-2">
      <textarea
        bind:value={editContent}
        rows="3"
        class="w-full bg-surface0 text-text text-sm rounded-md px-3 py-2 border border-surface1
               focus:outline-none focus:border-mauve resize-y"
      ></textarea>
      <div class="flex gap-2">
        <button
          onclick={saveEdit}
          class="text-xs bg-mauve text-crust px-3 py-1 rounded hover:opacity-90 cursor-pointer border-none"
        >
          Save
        </button>
        <button
          onclick={cancelEdit}
          class="text-xs bg-surface1 text-text px-3 py-1 rounded hover:bg-surface2 cursor-pointer border-none"
        >
          Cancel
        </button>
        <button
          onclick={async () => { await saveEdit(); await handleReroll(); }}
          class="text-xs bg-surface1 text-lavender px-3 py-1 rounded hover:bg-surface2 cursor-pointer border-none"
          title="Save edit and regenerate response"
        >
          Save & Reroll
        </button>
      </div>
    </div>
  {:else}
    <!-- Normal display -->
    {#if message.isFirstMessage}
      <div class="mb-1.5">
        <span class="text-[10px] uppercase tracking-wider text-subtext0 font-medium bg-surface0 px-2 py-0.5 rounded">
          Greeting
        </span>
      </div>
    {/if}
    {#if message.segments && message.segments.length > 0}
      {#each message.segments as seg}
        {#if seg.type === 'text' && seg.text}
          <p class="text-text text-sm leading-relaxed whitespace-pre-wrap mb-3">{fmt(seg.text)}</p>
        {:else if seg.type === 'image' && seg.dataUrl}
          <div class="my-2">
            <button onclick={() => openImage(seg.dataUrl!)} class="block max-w-lg cursor-pointer bg-transparent border-none p-0">
              <img
                src={seg.dataUrl}
                alt="Generated illustration"
                class="rounded-lg max-w-full hover:opacity-90 transition-opacity"
              />
            </button>
          </div>
        {/if}
      {/each}
    {:else}
      <p class="text-text text-sm leading-relaxed whitespace-pre-wrap">{fmt(message.content)}</p>
    {/if}

    {#if $settingsStore.developerMode && message.role === 'assistant' && message.generationInfo}
      <div class="mt-1.5">
        <GenerationInfoBadge info={message.generationInfo} onclick={() => showPanel = true} />
      </div>
    {/if}
  {/if}
</div>

{#if showPanel && message.generationInfo}
  <GenerationInfoPanel info={message.generationInfo} onclose={() => showPanel = false} />
{/if}

{#if showImage && modalSrc}
  <ImageModal src={modalSrc} onclose={() => showImage = false} />
{/if}
