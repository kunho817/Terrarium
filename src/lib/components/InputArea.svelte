<script lang="ts">
  import type { MessageType } from '$lib/types';

  let { onSend, disabled = false } = $props<{
    onSend: (text: string, type: MessageType) => void;
    disabled?: boolean;
  }>();

  let text = $state('');
  let mode: MessageType = $state('dialogue');

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
        bind:value={text}
        onkeydown={handleKeydown}
        placeholder="Type a message..."
        rows="1"
        disabled={disabled}
        class="flex-1 bg-surface0 text-text text-sm rounded-md px-3 py-1.5 border border-surface1
               focus:outline-none focus:border-mauve resize-none placeholder:text-subtext0
               disabled:opacity-50"
      ></textarea>

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
