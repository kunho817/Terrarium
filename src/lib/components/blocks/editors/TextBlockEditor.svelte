<script lang="ts">
  interface Props {
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
  }

  let { config, onChange }: Props = $props();

  let content = $state((config.content as string) || '');
  let enabled = $state((config.enabled as boolean) ?? true);

  // Auto-save on change (with debounce)
  function handleContentChange(e: Event) {
    content = (e.target as HTMLTextAreaElement).value;
    onChange({ content, enabled });
  }

  function handleEnabledChange(e: Event) {
    enabled = (e.target as HTMLInputElement).checked;
    onChange({ content, enabled });
  }

  // Detect template variables
  const detectedVariables = $derived(() => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches.map(m => m.slice(2, -2)))] : [];
  });
</script>

<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-text mb-2">
      Content
    </label>
    <textarea
      class="w-full h-32 p-3 bg-surface0 rounded-lg border border-surface2 text-text text-sm resize-none focus:border-mauve focus:outline-none"
      placeholder="Enter text content... Use {{char}} and {{user}} for variables"
      value={content}
      oninput={handleContentChange}
    ></textarea>
  </div>

  <div class="flex items-center gap-2">
    <input
      type="checkbox"
      id="enabled"
      checked={enabled}
      onchange={handleEnabledChange}
      class="w-4 h-4 rounded border-surface2 bg-surface0 text-mauve focus:ring-mauve"
    />
    <label for="enabled" class="text-sm text-text">Enabled</label>
  </div>

  {#if detectedVariables().length > 0}
    <div class="pt-2 border-t border-surface2">
      <p class="text-xs text-subtext0 mb-1">Detected variables:</p>
      <div class="flex flex-wrap gap-1">
        {#each detectedVariables() as variable}
          <code class="px-2 py-0.5 bg-surface0 rounded text-xs text-mauve">
            {'{{'}${variable}{'}}'}
          </code>
        {/each}
      </div>
    </div>
  {/if}
</div>
