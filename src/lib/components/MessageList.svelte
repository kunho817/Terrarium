<script lang="ts">
  import type { Message } from '$lib/types';
  import MessageItem from './MessageItem.svelte';

  let { messages = [], streamingMessage = null } = $props<{
    messages: Message[];
    streamingMessage: string | null;
  }>();

  let container: HTMLDivElement | undefined = $state();

  $effect(() => {
    // Auto-scroll to bottom when new messages or streaming content arrives
    if (messages.length || streamingMessage) {
      setTimeout(() => {
        container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  });
</script>

<div bind:this={container} class="flex-1 overflow-y-auto px-4 py-4">
  {#if messages.length === 0 && !streamingMessage}
    <div class="flex items-center justify-center h-full text-subtext0 text-sm">
      Start a conversation...
    </div>
  {:else}
    <div class="max-w-3xl mx-auto space-y-1">
      {#each messages as message (message.timestamp)}
        <MessageItem {message} />
      {/each}
      {#if streamingMessage !== null}
        <div class="py-2 border-l-2 border-l-mauve pl-3">
          <p class="text-text text-sm leading-relaxed whitespace-pre-wrap">
            {streamingMessage}
            <span class="inline-block w-1.5 h-4 bg-text animate-pulse ml-0.5 align-middle"></span>
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
