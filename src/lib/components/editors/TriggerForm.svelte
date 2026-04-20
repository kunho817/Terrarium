<script lang="ts">
  import type { Trigger, TriggerEvent, TriggerMatchOn } from '$lib/types/trigger';

  let { trigger, onchange, onremove }: {
    trigger: Trigger;
    onchange: (trigger: Trigger) => void;
    onremove: () => void;
  } = $props();

  const events: TriggerEvent[] = [
    'on_message',
    'on_user_message',
    'on_ai_message',
    'on_chat_start',
    'on_chat_end',
    'on_character_enter',
    'on_character_leave',
    'on_scene_change',
    'on_variable_change',
    'on_timer',
    'on_regex_match',
    'on_manual',
  ];

  const matchOnOptions: TriggerMatchOn[] = ['user_input', 'ai_output', 'both'];

  function update(partial: Partial<Trigger>) {
    onchange({ ...trigger, ...partial });
  }
</script>

<div class="flex flex-col gap-3 p-3 bg-mantle rounded-lg border border-surface0">
  <!-- Name + Enabled + Delete -->
  <div class="flex items-center gap-3">
    <input
      type="text"
      value={trigger.name}
      oninput={(e) => update({ name: (e.target as HTMLInputElement).value })}
      placeholder="Trigger name"
      class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
             focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0"
    />
    <label class="flex items-center gap-1.5 text-sm text-subtext0 cursor-pointer select-none shrink-0">
      <input
        type="checkbox"
        checked={trigger.enabled}
        onchange={() => update({ enabled: !trigger.enabled })}
        class="accent-mauve"
      />
      Enabled
    </label>
    <button
      onclick={onremove}
      class="px-2 py-1 rounded-md text-sm text-red hover:bg-surface0 transition-colors"
      title="Delete trigger"
    >
      &times;
    </button>
  </div>

  <!-- Event -->
  <div class="flex items-center gap-2">
    <label for="trigger-{trigger.id}-event" class="text-xs text-subtext0 w-16 shrink-0">Event</label>
    <select
      id="trigger-{trigger.id}-event"
      value={trigger.event}
      onchange={(e) => update({ event: (e.target as HTMLSelectElement).value as TriggerEvent })}
      class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
             focus:border-blue focus:outline-none transition-colors"
    >
      {#each events as evt}
        <option value={evt}>{evt}</option>
      {/each}
    </select>
  </div>

  <!-- Pattern -->
  <div class="flex items-center gap-2">
    <label for="trigger-{trigger.id}-pattern" class="text-xs text-subtext0 w-16 shrink-0">Pattern</label>
    <input
      id="trigger-{trigger.id}-pattern"
      type="text"
      value={trigger.pattern ?? ''}
      oninput={(e) => update({ pattern: (e.target as HTMLInputElement).value })}
      placeholder="Optional pattern to match"
      class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
             focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0"
    />
  </div>

  <!-- Match On -->
  <div class="flex items-center gap-2">
    <label for="trigger-{trigger.id}-match-on" class="text-xs text-subtext0 w-16 shrink-0">Match On</label>
    <select
      id="trigger-{trigger.id}-match-on"
      value={trigger.matchOn ?? 'user_input'}
      onchange={(e) => update({ matchOn: (e.target as HTMLSelectElement).value as TriggerMatchOn })}
      class="flex-1 bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
             focus:border-blue focus:outline-none transition-colors"
    >
      {#each matchOnOptions as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
  </div>

  <!-- Script -->
  <div class="flex flex-col gap-1">
    <label for="trigger-{trigger.id}-script" class="text-xs text-subtext0">Lua Script</label>
    <textarea
      id="trigger-{trigger.id}-script"
      value={trigger.script}
      oninput={(e) => update({ script: (e.target as HTMLTextAreaElement).value })}
      placeholder="-- Lua script here"
      rows={6}
      class="w-full bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
             focus:border-blue focus:outline-none transition-colors placeholder:text-overlay0
             font-mono resize-y"
    ></textarea>
  </div>
</div>
