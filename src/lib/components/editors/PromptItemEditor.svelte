<script lang="ts">
  import type { PromptItem, PromptItemType, PromptItemRole } from '$lib/types/prompt-preset';
  import type { LorebookPosition } from '$lib/types/lorebook';

  let { item, onchange, onremove }: {
    item: PromptItem;
    onchange: (item: PromptItem) => void;
    onremove: () => void;
  } = $props();

  let expanded = $state(true);

  const templateVars = ['{{char}}', '{{user}}', '{{slot}}', '{{time}}', '{{date}}'];

  function update(partial: Partial<PromptItem>) {
    onchange({ ...item, ...partial });
  }

  const typeOptions: { value: PromptItemType; label: string }[] = [
    { value: 'plain', label: 'Plain' },
    { value: 'system', label: 'System' },
    { value: 'description', label: 'Description' },
    { value: 'persona', label: 'Persona' },
    { value: 'personality', label: 'Personality' },
    { value: 'scenario', label: 'Scenario' },
    { value: 'exampleMessages', label: 'Example Messages' },
    { value: 'chatHistory', label: 'Chat History' },
    { value: 'lorebook', label: 'Lorebook' },
    { value: 'authornote', label: 'Author Note' },
    { value: 'postHistoryInstructions', label: 'Post-History Instructions' },
    { value: 'depthPrompt', label: 'Depth Prompt' },
    { value: 'jailbreak', label: 'Jailbreak' },
    { value: 'prefill', label: 'Prefill' },
    { value: 'memory', label: 'Memory (Agent)' },
    { value: 'director', label: 'Director (Agent)' },
    { value: 'sceneState', label: 'Scene State (Agent)' },
    { value: 'characterState', label: 'Character State (Agent)' },
  ];

  const roleOptions: { value: PromptItemRole; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'user', label: 'User' },
    { value: 'assistant', label: 'Assistant' },
  ];

  const lorebookPositionOptions: { value: LorebookPosition; label: string }[] = [
    { value: 'before_char', label: 'Before Character' },
    { value: 'before_scenario', label: 'Before Scenario' },
    { value: 'after_char', label: 'After Character' },
    { value: 'after_messages', label: 'After Messages' },
    { value: 'author_note', label: 'Author Note' },
  ];

  const typeBadgeColors: Record<PromptItemType, string> = {
    plain: 'bg-surface1 text-subtext0',
    system: 'bg-mauve/20 text-mauve',
    description: 'bg-blue/20 text-blue',
    persona: 'bg-green/20 text-green',
    personality: 'bg-peach/20 text-peach',
    scenario: 'bg-yellow/20 text-yellow',
    exampleMessages: 'bg-teal/20 text-teal',
    chatHistory: 'bg-lavender/20 text-lavender',
    lorebook: 'bg-pink/20 text-pink',
    authornote: 'bg-red/20 text-red',
    postHistoryInstructions: 'bg-maroon/20 text-maroon',
    depthPrompt: 'bg-sky/20 text-sky',
    jailbreak: 'bg-flamingo/20 text-flamingo',
    prefill: 'bg-rosewater/20 text-rosewater',
    memory: 'bg-lavender/20 text-lavender',
    director: 'bg-mauve/20 text-mauve',
    sceneState: 'bg-blue/20 text-blue',
    characterState: 'bg-peach/20 text-peach',
  };

  // Types that use "Prompt Text" label for content
  const promptTextTypes: Set<PromptItemType> = new Set(['plain', 'system', 'jailbreak', 'prefill']);
  // Types that hide the content textarea (auto-resolved)
  const hiddenContentTypes: Set<PromptItemType> = new Set(['chatHistory', 'exampleMessages', 'memory', 'director', 'sceneState', 'characterState']);

  function getContentLabel(): string {
    if (promptTextTypes.has(item.type)) return 'Prompt Text';
    return 'Inner Format (use {{slot}} for resolved content)';
  }

  function handleTypeChange(newType: PromptItemType) {
    const partial: Partial<PromptItem> = { type: newType };
    if (newType === 'lorebook' && !item.lorebookPosition) {
      partial.lorebookPosition = 'before_char';
    }
    update(partial);
  }
</script>

<div class="flex flex-col gap-3 p-3 bg-mantle rounded-lg border border-surface0">
  <!-- Header row: type badge, name input, enabled toggle, remove -->
  <div class="flex items-center gap-2">
    <button
      type="button"
      onclick={() => expanded = !expanded}
      class="text-xs text-overlay0 transition-transform shrink-0 {expanded ? 'rotate-90' : ''}"
      aria-label="Toggle expand"
    >
      &#9654;
    </button>
    <span class="text-xs px-1.5 py-0.5 rounded font-medium shrink-0 {typeBadgeColors[item.type]}">
      {item.type}
    </span>
    <input
      type="text"
      value={item.name}
      oninput={(e) => update({ name: e.currentTarget.value })}
      placeholder="Item name"
      class="flex-1 bg-surface0 text-text px-2 py-1 rounded-md text-sm border border-surface1
             focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0 min-w-0"
    />
    <label class="flex items-center gap-1 text-xs text-subtext0 cursor-pointer select-none shrink-0">
      <input
        type="checkbox"
        checked={item.enabled}
        onchange={(e) => update({ enabled: e.currentTarget.checked })}
        class="accent-mauve"
      />
      ON
    </label>
    <button
      type="button"
      onclick={onremove}
      class="px-2 py-1 rounded-md text-sm text-red hover:bg-surface0 transition-colors shrink-0"
      title="Remove item"
    >
      &times;
    </button>
  </div>

  <!-- Collapsible body -->
  {#if expanded}
    <div class="flex flex-col gap-3 pl-2">
      <!-- Type + Role row -->
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-subtext0">Type</span>
          <select
            value={item.type}
            onchange={(e) => handleTypeChange(e.currentTarget.value as PromptItemType)}
            class="bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                   focus:border-mauve focus:outline-none transition-colors"
          >
            {#each typeOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-subtext0">Role</span>
          <select
            value={item.role}
            onchange={(e) => update({ role: e.currentTarget.value as PromptItemRole })}
            class="bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                   focus:border-mauve focus:outline-none transition-colors"
          >
            {#each roleOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      </div>

      <!-- Lorebook Position (only for lorebook type) -->
      {#if item.type === 'lorebook'}
        <label class="flex flex-col gap-1">
          <span class="text-xs text-subtext0">Lorebook Position</span>
          <select
            value={item.lorebookPosition ?? 'before_char'}
            onchange={(e) => update({ lorebookPosition: e.currentTarget.value as LorebookPosition })}
            class="bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                   focus:border-mauve focus:outline-none transition-colors"
          >
            {#each lorebookPositionOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </label>
      {/if}

      <!-- Content textarea (hidden for auto-resolved types) -->
      {#if !hiddenContentTypes.has(item.type)}
        <label class="flex flex-col gap-1">
          <span class="text-xs text-subtext0">{getContentLabel()}</span>
          <textarea
            value={item.content}
            oninput={(e) => update({ content: e.currentTarget.value })}
            rows={5}
            placeholder="Enter content..."
            class="w-full bg-surface0 text-text px-2.5 py-1.5 rounded-md text-sm border border-surface1
                   focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0
                   font-mono resize-y"
          ></textarea>
        </label>
      {/if}

      <!-- Template Variables help text -->
      <p class="text-xs text-overlay0">
        Available variables:
        {#each templateVars as v, i}
          <code class="text-mauve">{v}</code>{i < templateVars.length - 1 ? ', ' : ''}
        {/each}
      </p>
    </div>
  {/if}
</div>
