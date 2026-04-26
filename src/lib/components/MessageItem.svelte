<script lang="ts">
  import type { Message } from '$lib/types';
  import { settingsStore } from '$lib/stores/settings';
  import { formatChatText } from '$lib/core/chat/text-formatter';
  import { showConfirmDialog } from '$lib/utils/app-dialog';
  import GenerationInfoBadge from './GenerationInfoBadge.svelte';
  import GenerationInfoPanel from './GenerationInfoPanel.svelte';
  import ImageModal from './ImageModal.svelte';

  let {
    message,
    index,
    onedit,
    onreroll,
    ondelete,
  }: {
    message: Message;
    index: number;
    onedit: (index: number, newContent: string) => Promise<void>;
    onreroll: (userMessageIndex: number) => Promise<void>;
    ondelete: (messageIndex: number) => Promise<void>;
  } = $props();

  let showPanel = $state(false);
  let showImage = $state(false);
  let modalSrc = $state('');
  let modalPrompt = $state('');
  let editing = $state(false);
  let editContent = $state('');

  function openImage(src: string, prompt?: string) {
    modalSrc = src;
    modalPrompt = prompt ?? '';
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
      return onreroll(index - 1);
    }
    if (message.role === 'user') {
      return onreroll(index);
    }
    return Promise.resolve();
  }

  async function handleDelete() {
    const confirmed = await showConfirmDialog('Delete this message and every message after it?');
    if (!confirmed) return;
    await ondelete(index);
  }

  const roleLabelMap: Record<string, string> = {
    user: 'User Input',
    assistant: 'Model Output',
    narrator: 'Narration',
    system: 'System',
  };

  const layoutStyles: Record<string, string> = {
    user: 'justify-end',
    assistant: 'justify-start',
    narrator: 'justify-center',
    system: 'justify-center',
  };

  const bubbleStyles: Record<string, string> = {
    user: 'bg-blue/10 border-blue/30',
    assistant: 'bg-surface0/85 border-surface1',
    narrator: 'bg-surface0/55 border-overlay0 italic',
    system: 'bg-yellow/10 border-yellow/30 text-subtext0',
  };

  const textStyles: Record<string, string> = {
    user: 'text-text',
    assistant: 'text-text',
    narrator: 'text-text',
    system: 'text-subtext0',
  };
</script>

<div class="w-full flex {layoutStyles[message.role] || 'justify-start'} py-1.5">
  <div class="relative group w-full max-w-[min(100%,48rem)]">
    {#if !editing}
      <div
        class="absolute -top-2 right-0 z-10 flex flex-wrap gap-1 transition-opacity sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-focus-within:pointer-events-auto"
      >
        {#if message.role === 'user'}
          <button
            onclick={startEdit}
            class="text-[11px] text-subtext0 hover:text-text bg-base px-2 py-1 rounded-md cursor-pointer border border-surface1"
            title="Edit message"
          >
            Edit
          </button>
        {/if}
        {#if message.role === 'assistant' || message.role === 'user'}
          <button
            onclick={handleDelete}
            class="text-[11px] text-subtext0 hover:text-text bg-base px-2 py-1 rounded-md cursor-pointer border border-surface1"
            title="Delete this message and everything after it"
          >
            Delete From Here
          </button>
        {/if}
        {#if message.role === 'assistant'}
          <button
            onclick={handleReroll}
            class="text-[11px] text-subtext0 hover:text-text bg-base px-2 py-1 rounded-md cursor-pointer border border-surface1"
            title="Reroll response"
          >
            Reroll
          </button>
        {/if}
      </div>
    {/if}

    <div class="mb-1 flex items-center gap-2 px-0.5">
      <span class="text-[10px] uppercase tracking-[0.08em] text-subtext0 font-medium">
        {roleLabelMap[message.role] || message.role}
      </span>
      {#if message.isFirstMessage}
        <span class="text-[10px] uppercase tracking-[0.08em] text-subtext0 font-medium">
          Greeting
        </span>
      {/if}
    </div>

    <div class="rounded-lg border px-4 py-3 shadow-sm {bubbleStyles[message.role] || 'bg-surface0/85 border-surface1'}">
      {#if editing}
        <div class="space-y-2">
          <textarea
            bind:value={editContent}
            rows="3"
            class="w-full bg-base text-text text-sm rounded-md px-3 py-2 border border-surface1
                   focus:outline-none focus:border-mauve resize-y"
          ></textarea>
          <div class="flex flex-wrap gap-2">
            <button
              onclick={saveEdit}
              class="text-xs bg-mauve text-crust px-3 py-1 rounded-md hover:opacity-90 cursor-pointer border-none"
            >
              Save
            </button>
            <button
              onclick={cancelEdit}
              class="text-xs bg-surface1 text-text px-3 py-1 rounded-md hover:bg-surface2 cursor-pointer border-none"
            >
              Cancel
            </button>
            <button
              onclick={async () => { await saveEdit(); await handleReroll(); }}
              class="text-xs bg-surface1 text-lavender px-3 py-1 rounded-md hover:bg-surface2 cursor-pointer border-none"
              title="Save edit and regenerate response"
            >
              Save & Reroll
            </button>
          </div>
        </div>
      {:else if message.segments && message.segments.length > 0}
        <div class="space-y-3">
          {#each message.segments as seg}
            {#if seg.type === 'text' && seg.text}
              <p class="{textStyles[message.role] || 'text-text'} text-sm leading-relaxed whitespace-pre-wrap">{fmt(seg.text)}</p>
            {:else if seg.type === 'image' && seg.dataUrl}
              <div>
                <button onclick={() => openImage(seg.dataUrl!, seg.prompt)} class="block max-w-lg cursor-pointer bg-transparent border-none p-0">
                  <img
                    src={seg.dataUrl}
                    alt="Generated illustration"
                    class="rounded-lg max-w-full hover:opacity-90 transition-opacity"
                  />
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="{textStyles[message.role] || 'text-text'} text-sm leading-relaxed whitespace-pre-wrap">{fmt(message.content)}</p>
      {/if}

      {#if !editing && $settingsStore.developerMode && message.role === 'assistant' && message.generationInfo}
        <div class="mt-2">
          <GenerationInfoBadge info={message.generationInfo} onclick={() => showPanel = true} />
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showPanel && message.generationInfo}
  <GenerationInfoPanel info={message.generationInfo} onclose={() => showPanel = false} />
{/if}

{#if showImage && modalSrc}
  <ImageModal src={modalSrc} prompt={modalPrompt} onclose={() => showImage = false} />
{/if}
