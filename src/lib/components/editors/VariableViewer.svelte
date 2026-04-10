<script lang="ts">
  import type { VariableStore, VariableValue } from '$lib/types/script';

  let { variables, ondelete }: {
    variables: VariableStore;
    ondelete: (key: string) => void;
  } = $props();

  const entries = $derived(Object.entries(variables));

  function inferType(value: VariableValue): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  }

  function formatValue(value: VariableValue): string {
    if (typeof value === 'string') return value;
    return String(value);
  }
</script>

<div class="flex flex-col gap-2">
  <h3 class="text-sm font-semibold text-subtext1">Variables</h3>

  {#if entries.length === 0}
    <p class="text-xs text-overlay0 py-2 text-center">No variables set.</p>
  {:else}
    <div class="rounded-lg border border-surface0 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-mantle text-subtext0 text-xs">
            <th class="text-left px-3 py-2 font-medium">Key</th>
            <th class="text-left px-3 py-2 font-medium">Value</th>
            <th class="text-left px-3 py-2 font-medium w-20">Type</th>
            <th class="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {#each entries as [key, value] (key)}
            <tr class="border-t border-surface0 hover:bg-surface0/50 transition-colors">
              <td class="px-3 py-1.5 text-mauve font-mono text-xs">{key}</td>
              <td class="px-3 py-1.5 text-text font-mono text-xs max-w-xs truncate">{formatValue(value)}</td>
              <td class="px-3 py-1.5">
                <span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-overlay1">
                  {inferType(value)}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                <button
                  onclick={() => ondelete(key)}
                  class="text-red/70 hover:text-red transition-colors text-sm"
                  title="Delete variable"
                >
                  &times;
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
