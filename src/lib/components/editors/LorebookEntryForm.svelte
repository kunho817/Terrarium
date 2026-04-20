<script lang="ts">
  import type { LorebookEntry } from '$lib/types/lorebook';

  let { entry, onchange, onremove } = $props<{
    entry: LorebookEntry;
    onchange: (entry: LorebookEntry) => void;
    onremove: () => void;
  }>();

  let keywordsText = $state('');
  let secondaryKeywordsText = $state('');

  $effect(() => {
    keywordsText = entry.keywords.join(', ');
    secondaryKeywordsText = (entry.secondaryKeywords ?? []).join(', ');
  });

  function update(partial: Partial<LorebookEntry>) {
    onchange({ ...entry, ...partial });
  }

  function handleKeywordsInput(value: string) {
    keywordsText = value;
    const arr = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    update({ keywords: arr });
  }

  function handleSecondaryKeywordsInput(value: string) {
    secondaryKeywordsText = value;
    const arr = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    update({ secondaryKeywords: arr });
  }

  const positionOptions: { value: LorebookEntry['position']; label: string }[] = [
    { value: 'before_char', label: 'Before Character' },
    { value: 'after_char', label: 'After Character' },
    { value: 'before_scenario', label: 'Before Scenario' },
    { value: 'after_messages', label: 'After Messages' },
    { value: 'author_note', label: 'Author Note' },
  ];

  const modeOptions: { value: LorebookEntry['mode']; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'constant', label: 'Constant' },
    { value: 'selective', label: 'Selective' },
    { value: 'folder', label: 'Folder' },
  ];

  const scopeOptions: { value: LorebookEntry['scope']; label: string }[] = [
    { value: 'global', label: 'Global' },
    { value: 'character', label: 'Character' },
    { value: 'scenario', label: 'Scenario' },
  ];
</script>

<div class="flex flex-col gap-3">
  <!-- Row: Name -->
  <label class="flex flex-col gap-1">
    <span class="text-xs text-subtext0">Name</span>
    <input
      type="text"
      value={entry.name}
      oninput={(e) => update({ name: e.currentTarget.value })}
      class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
             focus:border-mauve focus:outline-none transition-colors"
    />
  </label>

  <!-- Row: Keywords + Secondary Keywords -->
  <div class="grid grid-cols-2 gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Keywords</span>
      <input
        type="text"
        value={keywordsText}
        oninput={(e) => handleKeywordsInput(e.currentTarget.value)}
        placeholder="keyword1, keyword2"
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Secondary Keywords</span>
      <input
        type="text"
        value={secondaryKeywordsText}
        oninput={(e) => handleSecondaryKeywordsInput(e.currentTarget.value)}
        placeholder="keyword1, keyword2"
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0"
      />
    </label>
  </div>

  <!-- Row: Regex -->
  <label class="flex flex-col gap-1">
    <span class="text-xs text-subtext0">Regex Pattern</span>
    <input
      type="text"
      value={entry.regex ?? ''}
      oninput={(e) => update({ regex: e.currentTarget.value })}
      placeholder="optional regex pattern"
      class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
             focus:border-mauve focus:outline-none transition-colors font-mono placeholder:text-overlay0"
    />
  </label>

  <!-- Row: Content -->
  <label class="flex flex-col gap-1">
    <span class="text-xs text-subtext0">Content</span>
    <textarea
      value={entry.content}
      oninput={(e) => update({ content: e.currentTarget.value })}
      rows={5}
      class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
             focus:border-mauve focus:outline-none transition-colors resize-y placeholder:text-overlay0"
    ></textarea>
  </label>

  <!-- Row: Position + Mode + Scope -->
  <div class="grid grid-cols-3 gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Position</span>
      <select
        value={entry.position}
        onchange={(e) => update({ position: e.currentTarget.value as LorebookEntry['position'] })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      >
        {#each positionOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Mode</span>
      <select
        value={entry.mode}
        onchange={(e) => update({ mode: e.currentTarget.value as LorebookEntry['mode'] })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      >
        {#each modeOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Scope</span>
      <select
        value={entry.scope}
        onchange={(e) => update({ scope: e.currentTarget.value as LorebookEntry['scope'] })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      >
        {#each scopeOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <!-- Row: Priority + Scan Depth + Activation % -->
  <div class="grid grid-cols-3 gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Priority</span>
      <input
        type="number"
        value={entry.priority}
        oninput={(e) => update({ priority: Number(e.currentTarget.value) })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Scan Depth</span>
      <input
        type="number"
        value={entry.scanDepth}
        oninput={(e) => update({ scanDepth: Number(e.currentTarget.value) })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Activation %</span>
      <input
        type="number"
        min="0"
        max="100"
        value={entry.activationPercent ?? 100}
        oninput={(e) => update({ activationPercent: Number(e.currentTarget.value) })}
        class="rounded px-2 py-1 text-sm bg-surface0 text-text border border-surface1
               focus:border-mauve focus:outline-none transition-colors"
      />
    </label>
  </div>

  <!-- Row: Checkboxes -->
  <div class="flex items-center gap-4">
    <label class="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={entry.enabled}
        onchange={(e) => update({ enabled: e.currentTarget.checked })}
        class="accent-mauve"
      />
      <span class="text-xs text-subtext1">Enabled</span>
    </label>
    <label class="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={entry.caseSensitive}
        onchange={(e) => update({ caseSensitive: e.currentTarget.checked })}
        class="accent-mauve"
      />
      <span class="text-xs text-subtext1">Case Sensitive</span>
    </label>
    <label class="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={entry.constant}
        onchange={(e) => update({ constant: e.currentTarget.checked })}
        class="accent-mauve"
      />
      <span class="text-xs text-subtext1">Constant</span>
    </label>
  </div>

  <!-- Delete button -->
  <div class="flex justify-end">
    <button
      type="button"
      onclick={onremove}
      class="px-3 py-1 rounded text-xs text-red hover:bg-red/10 transition-colors"
    >
      Delete Entry
    </button>
  </div>
</div>
