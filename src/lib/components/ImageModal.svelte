<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';

  let { src, onclose, prompt = '' } = $props<{
    src: string;
    onclose: () => void;
    prompt?: string;
  }>();
  let showTags = $state(false);
  let downloadError = $state('');

  function getFileInfo(dataUrl: string): { bytes: Uint8Array; extension: string } {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Unsupported image format');
    }

    const mime = match[1];
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    return { bytes, extension };
  }

  async function handleDownload() {
    downloadError = '';

    try {
      const { bytes, extension } = getFileInfo(src);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const path = await save({
        defaultPath: `generated-image-${timestamp}.${extension}`,
        filters: [{ name: 'Image', extensions: [extension] }],
      });

      if (!path) return;
      await writeFile(path, bytes);
    } catch (error) {
      downloadError = error instanceof Error ? error.message : 'Failed to save image';
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <div
    role="presentation"
    class="max-w-[90vw] max-h-[90vh] flex flex-col gap-3"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        onclick={handleDownload}
        class="bg-surface0/90 text-text text-xs rounded-md px-3 py-1.5 border border-surface1 hover:bg-surface1 transition-colors"
      >
        Download
      </button>
      {#if $settingsStore.developerMode && prompt}
        <button
          type="button"
          onclick={() => { showTags = !showTags; }}
          class="bg-surface0/90 text-text text-xs rounded-md px-3 py-1.5 border border-surface1 hover:bg-surface1 transition-colors"
        >
          {showTags ? 'Hide Tags' : 'View Tags'}
        </button>
      {/if}
      <button
        type="button"
        onclick={onclose}
        class="bg-surface0/90 text-text text-xs rounded-md px-3 py-1.5 border border-surface1 hover:bg-surface1 transition-colors"
      >
        Close
      </button>
    </div>

    <div class="relative overflow-hidden rounded-lg border border-surface1 bg-base shadow-2xl">
      <img
        src={src}
        alt="Full-size illustration"
        class="block max-w-[90vw] max-h-[85vh] object-contain"
      />

      {#if $settingsStore.developerMode && showTags && prompt}
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-crust via-crust/95 to-crust/70 px-4 py-3">
          <div class="max-h-[32vh] overflow-y-auto pr-1">
            <p class="text-xs text-subtext0 mb-2">Image Tags</p>
            <p class="text-xs text-text break-words whitespace-pre-wrap">{prompt}</p>
          </div>
        </div>
      {/if}
    </div>

    {#if downloadError}
      <div class="bg-red/10 border border-red/30 rounded-md px-3 py-2">
        <p class="text-xs text-red">{downloadError}</p>
      </div>
    {/if}
  </div>
</div>
