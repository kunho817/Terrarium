<script lang="ts">
  import { chatStore } from '$lib/stores/chat';
  import { deleteFromMessage, editMessage, rerollFromMessage } from '$lib/core/chat/use-chat';
  import MessageItem from './MessageItem.svelte';

  let { streamingMessage = null } = $props<{
    streamingMessage: string | null;
  }>();

  let container: HTMLDivElement | undefined = $state();

  $effect(() => {
    if ($chatStore.messages.length || streamingMessage) {
      setTimeout(() => {
        container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  });

  async function handleEdit(index: number, newContent: string) {
    await editMessage(index, newContent);
  }

  async function handleReroll(userMessageIndex: number) {
    await rerollFromMessage(userMessageIndex);
  }

  async function handleDelete(messageIndex: number) {
    await deleteFromMessage(messageIndex);
  }
</script>

<div bind:this={container} class="flex-1 overflow-y-auto px-4 py-4">
  {#if $chatStore.messages.length === 0 && !streamingMessage}
    <div class="flex items-center justify-center h-full text-subtext0 text-sm">
      Start a conversation...
    </div>
  {:else}
    <div class="max-w-4xl mx-auto space-y-2">
      {#each $chatStore.messages as message, i (message.timestamp + '-' + (message.revision ?? 0))}
        <MessageItem {message} index={i} onedit={handleEdit} onreroll={handleReroll} ondelete={handleDelete} />
      {/each}
      {#if streamingMessage !== null}
        <div class="w-full flex justify-start py-1.5">
          <div class="w-full max-w-[min(100%,48rem)]">
            <div class="mb-1 flex items-center gap-2 px-0.5">
              <span class="text-[10px] uppercase tracking-[0.08em] text-subtext0 font-medium">
                Model Output
              </span>
            </div>
            <div class="rounded-lg border border-surface1 bg-surface0/85 px-4 py-3 shadow-sm">
              <p class="text-text text-sm leading-relaxed whitespace-pre-wrap">
                {streamingMessage}
                <span class="inline-block w-1.5 h-4 bg-text animate-pulse ml-0.5 align-middle"></span>
              </p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
