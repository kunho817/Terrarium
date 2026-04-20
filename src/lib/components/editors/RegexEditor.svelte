<script lang="ts">
  import type { RegexScript, RegexStage } from '$lib/types/script';

  let { scripts, onchange }: {
    scripts: RegexScript[];
    onchange: (scripts: RegexScript[]) => void;
  } = $props();

  const stages: RegexStage[] = ['modify_input', 'modify_output', 'modify_request', 'modify_display'];

  let expandedIndex = $state<number | null>(null);

  function addScript() {
    const newScript: RegexScript = {
      id: crypto.randomUUID(),
      name: 'New Regex',
      pattern: '',
      replacement: '',
      stage: 'modify_output',
      enabled: true,
      flag: 'gi',
    };
    onchange([...scripts, newScript]);
    expandedIndex = scripts.length;
  }

  function updateScript(index: number, updated: RegexScript) {
    const next = [...scripts];
    next[index] = updated;
    onchange(next);
  }

  function removeScript(index: number) {
    const next = [...scripts];
    next.splice(index, 1);
    onchange(next);
    if (expandedIndex !== null) {
      if (index < expandedIndex) {
        expandedIndex--;
      } else if (index === expandedIndex) {
        expandedIndex = null;
      }
    }
  }

  function toggle(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-semibold text-subtext1">Regex Scripts</h3>
    <button
      onclick={addScript}
      class="px-3 py-1 rounded-md text-xs font-medium bg-surface0 text-blue
             hover:bg-surface1 transition-colors"
    >
      + Add Regex
    </button>
  </div>

  {#if scripts.length === 0}
    <p class="text-xs text-overlay0 py-2 text-center">No regex scripts configured.</p>
  {:else}
    {#each scripts as script, i (script.id)}
      <!-- Accordion header -->
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer select-none
               bg-mantle border border-surface0 hover:border-surface1 transition-colors"
        onclick={() => toggle(i)}
        role="button"
        tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(i); }}
      >
        <span class="text-xs text-overlay0 transition-transform {expandedIndex === i ? 'rotate-90' : ''}">&#9654;</span>
        <span class="flex-1 text-sm text-text truncate">{script.name}</span>
        {#if script.enabled}
          <span class="text-xs px-1.5 py-0.5 rounded bg-green/20 text-green">ON</span>
        {:else}
          <span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-overlay0">OFF</span>
        {/if}
        <span class="text-xs text-overlay0">{script.stage}</span>
      </div>

      <!-- Accordion body -->
      {#if expandedIndex === i}
        <div class="p-3 bg-mantle rounded-lg border border-surface0 ml-2">
          <div class="flex flex-col gap-3">
            <!-- Name + Enabled + Delete -->
            <div class="flex items-center gap-3">
              <input
                type="text"
                value={script.name}
                oninput={(e) => updateScript(i, { ...script, name: (e.target as HTMLInputElement).value })}
                placeholder="Script name"
                class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                       focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0"
              />
              <label class="flex items-center gap-1.5 text-sm text-subtext0 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={script.enabled}
                  onchange={() => updateScript(i, { ...script, enabled: !script.enabled })}
                  class="accent-mauve"
                />
                Enabled
              </label>
              <button
                onclick={() => removeScript(i)}
                class="px-2 py-1 rounded-md text-sm text-red hover:bg-surface0 transition-colors"
                title="Delete script"
              >
                &times;
              </button>
            </div>

            <!-- Pattern -->
            <div class="flex items-center gap-2">
              <label for="regex-{script.id}-pattern" class="text-xs text-subtext0 w-24 shrink-0">Pattern</label>
              <input
                id="regex-{script.id}-pattern"
                type="text"
                value={script.pattern}
                oninput={(e) => updateScript(i, { ...script, pattern: (e.target as HTMLInputElement).value })}
                placeholder="Regex pattern"
                class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                       focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0
                       font-mono"
              />
            </div>

            <!-- Replacement -->
            <div class="flex items-center gap-2">
              <label for="regex-{script.id}-replacement" class="text-xs text-subtext0 w-24 shrink-0">Replacement</label>
              <input
                id="regex-{script.id}-replacement"
                type="text"
                value={script.replacement}
                oninput={(e) => updateScript(i, { ...script, replacement: (e.target as HTMLInputElement).value })}
                placeholder="Replacement string"
                class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                       focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0
                       font-mono"
              />
            </div>

            <!-- Stage + Flags -->
            <div class="flex items-center gap-2">
              <label for="regex-{script.id}-stage" class="text-xs text-subtext0 w-24 shrink-0">Stage</label>
              <select
                id="regex-{script.id}-stage"
                value={script.stage}
                onchange={(e) => updateScript(i, { ...script, stage: (e.target as HTMLSelectElement).value as RegexStage })}
                class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                       focus:border-blue focus:outline-none transition-colors"
              >
                {#each stages as s}
                  <option value={s}>{s}</option>
                {/each}
              </select>
            </div>

            <div class="flex items-center gap-2">
              <label for="regex-{script.id}-flags" class="text-xs text-subtext0 w-24 shrink-0">Flags</label>
              <input
                id="regex-{script.id}-flags"
                type="text"
                value={script.flag ?? ''}
                oninput={(e) => updateScript(i, { ...script, flag: (e.target as HTMLInputElement).value })}
                placeholder="gi"
                class="w-20 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                       focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0
                       font-mono"
              />
            </div>
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</div>
