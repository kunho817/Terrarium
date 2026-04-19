<script lang="ts">
  import type { MessageType } from '$lib/types';

  let { onSend, onGenerateImage, imageProviderAvailable = false, disabled = false } = $props<{
    onSend: (text: string, type: MessageType) => void;
    onGenerateImage?: () => void;
    imageProviderAvailable?: boolean;
    disabled?: boolean;
  }>();

  let text = $state('');
  let mode: MessageType = $state('dialogue');
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(textareaEl).lineHeight) || 20;
    const maxRows = 5;
    const maxHeight = lineHeight * maxRows;
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, maxHeight) + 'px';
  }

  const modes: { value: MessageType; label: string }[] = [
    { value: 'dialogue', label: 'Dialogue' },
    { value: 'narrator', label: 'Narrate' },
    { value: 'action', label: 'Action' },
    { value: 'system', label: 'System' },
  ];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, mode);
    text = '';
    if (textareaEl) textareaEl.style.height = 'auto';
  }
</script>

<div class="border-t border-surface0 bg-mantle p-3">
  <div class="max-w-3xl mx-auto">
    <div class="flex gap-2">
      <!-- Mode selector -->
      <select
        bind:value={mode}
        class="bg-surface0 text-text text-xs rounded-md px-2 py-1.5 border border-surface1
               focus:outline-none focus:border-mauve"
      >
        {#each modes as m}
          <option value={m.value}>{m.label}</option>
        {/each}
      </select>

      <!-- Text input -->
      <textarea
        bind:this={textareaEl}
        bind:value={text}
        onkeydown={handleKeydown}
        oninput={autoResize}
        placeholder="Type a message..."
        rows="1"
        disabled={disabled}
        class="flex-1 bg-surface0 text-text text-sm rounded-md px-3 py-1.5 border border-surface1
               focus:outline-none focus:border-mauve resize-none placeholder:text-subtext0
               disabled:opacity-50 overflow-y-auto"
        style="max-height: calc(1lh * 5 + 0.75rem); min-height: calc(1lh + 0.75rem);"
      ></textarea>

      <!-- Generate image button -->
      {#if imageProviderAvailable && onGenerateImage}
        <button
          onclick={onGenerateImage}
          disabled={disabled}
          class="px-2 py-1.5 bg-surface0 text-text rounded-md text-sm
                 hover:bg-surface1 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-colors"
          title="Generate illustration"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 00-1.06 0L2.5 11.06zm10-3.56a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clip-rule="evenodd" />
          </svg>
        </button>
      {/if}

      <!-- Send button -->
      <button
        onclick={handleSend}
        disabled={disabled || !text.trim()}
        class="px-4 py-1.5 bg-mauve text-crust rounded-md text-sm font-medium
               hover:bg-lavender disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors"
      >
        Send
      </button>
    </div>
  </div>
</div>
