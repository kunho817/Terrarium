<script lang="ts">
  import type { Trigger } from '$lib/types/trigger';
  import TriggerForm from './TriggerForm.svelte';

  let { triggers, onchange }: {
    triggers: Trigger[];
    onchange: (triggers: Trigger[]) => void;
  } = $props();

  let expandedIndex = $state<number | null>(null);

  function addTrigger() {
    const newTrigger: Trigger = {
      id: crypto.randomUUID(),
      name: 'New Trigger',
      enabled: true,
      event: 'on_message',
      pattern: '',
      matchOn: 'user_input',
      script: '',
    };
    onchange([...triggers, newTrigger]);
    expandedIndex = triggers.length;
  }

  function updateTrigger(index: number, updated: Trigger) {
    const next = [...triggers];
    next[index] = updated;
    onchange(next);
  }

  function removeTrigger(index: number) {
    const next = [...triggers];
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
    <h3 class="text-sm font-semibold text-subtext1">Triggers</h3>
    <button
      onclick={addTrigger}
      class="px-3 py-1 rounded-md text-xs font-medium bg-surface0 text-blue
             hover:bg-surface1 transition-colors"
    >
      + Add Trigger
    </button>
  </div>

  {#if triggers.length === 0}
    <p class="text-xs text-overlay0 py-2 text-center">No triggers configured.</p>
  {:else}
    {#each triggers as trigger, i (trigger.id)}
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
        <span class="flex-1 text-sm text-text truncate">{trigger.name}</span>
        {#if trigger.enabled}
          <span class="text-xs px-1.5 py-0.5 rounded bg-green/20 text-green">ON</span>
        {:else}
          <span class="text-xs px-1.5 py-0.5 rounded bg-surface1 text-overlay0">OFF</span>
        {/if}
        <span class="text-xs text-overlay0">{trigger.event}</span>
      </div>

      <!-- Accordion body -->
      {#if expandedIndex === i}
        <div class="ml-2">
          <TriggerForm
            {trigger}
            onchange={(t) => updateTrigger(i, t)}
            onremove={() => removeTrigger(i)}
          />
        </div>
      {/if}
    {/each}
  {/if}
</div>
