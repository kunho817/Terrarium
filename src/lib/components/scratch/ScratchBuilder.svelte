<script lang="ts">
  import BlockPalette from './BlockPalette.svelte';
  import ScratchCanvas from './ScratchCanvas.svelte';
  import PreviewPanel from './PreviewPanel.svelte';
  import { scratchScriptStore } from '$lib/stores/scratch-script';
  import { executeChain } from '$lib/blocks/scratch-executor';
  import { countTokens } from '$lib/utils/tokenizer';

  let previewOpen = $state(true);
  const scriptState = $derived($scratchScriptStore);

  const prompt = $derived(
    scriptState.currentScript?.root
      ? executeChain(scriptState.currentScript.root, {})
      : ''
  );

  const tokens = $derived(countTokens(prompt));

  function togglePreview() {
    previewOpen = !previewOpen;
  }
</script>

<div class="scratch-builder">
  <header class="builder-header">
    <h1>Prompt Builder</h1>
    <div class="header-actions">
      <button
        type="button"
        class="toggle-btn"
        data-action="toggle-preview"
        onclick={togglePreview}
        aria-pressed={previewOpen}
      >
        {previewOpen ? '◀ Hide Preview' : '▶ Show Preview'}
      </button>
    </div>
  </header>

  <main class="builder-main">
    <BlockPalette />
    <ScratchCanvas />
    <PreviewPanel
      prompt={prompt}
      tokens={tokens}
      isOpen={previewOpen}
      onClose={togglePreview}
    />
  </main>
</div>

<style>
  .scratch-builder {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--mantle, #181825);
  }

  .builder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--surface2, #585b70);
    background: var(--surface0, #313244);
  }

  .builder-header h1 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .toggle-btn {
    background: var(--surface1, #45475a);
    border: none;
    color: var(--text, #cdd6f4);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .toggle-btn:hover {
    background: var(--surface2, #585b70);
  }

  .builder-main {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
</style>
