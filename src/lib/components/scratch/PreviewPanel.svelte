<script lang="ts">
  import { countTokens } from '$lib/utils/tokenizer';

  interface Props {
    prompt: string;
    tokens: number;
    isOpen?: boolean;
    onClose?: () => void;
  }

  let { prompt, tokens, isOpen = true, onClose }: Props = $props();

  const hasContent = $derived(prompt.trim().length > 0);
  const displayTokens = $derived(tokens);

  function handleClose() {
    onClose?.();
  }
</script>

{#if isOpen}
  <aside class="preview-panel"  aria-label="Prompt preview">
    <header class="preview-header">
      <h3>Preview</h3>
      <button
        type="button"
        class="close-btn"
        data-action="close"
        onclick={handleClose}
        aria-label="Close preview"
      >
        ✕
      </button>
    </header>

    <div class="preview-content">
      {#if hasContent}
        <pre class="prompt-text">{prompt}</pre>
        <footer class="token-count">
          <span>~{displayTokens} tokens</span>
        </footer>
      {:else}
        <p class="empty-state">No content to preview</p>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .preview-panel {
    width: 280px;
    background: var(--surface0, #313244);
    border-left: 1px solid var(--surface2, #585b70);
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--surface2, #585b70);
  }

  .preview-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--overlay1, #9399b2);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .close-btn:hover {
    background: var(--surface2, #585b70);
  }

  .preview-content {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .prompt-text {
    margin: 0;
    padding: 12px;
    background: var(--base, #1e1e2e);
    border-radius: 6px;
    font-size: 0.75rem;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: var(--text, #cdd6f4);
  }

  .token-count {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--surface2, #585b70);
    font-size: 0.75rem;
    color: var(--overlay1, #7f849c);
  }

  .empty-state {
    color: var(--overlay0, #9399b2);
    text-align: center;
    margin: 0;
  }
</style>
