<script lang="ts">
  import type { BlockInstance } from '$lib/types';
  import type { PromptItemRole, PromptItemType } from '$lib/types/prompt-preset';
  import type { LorebookPosition } from '$lib/types/lorebook';
  import { getMergeInputCount } from '$lib/blocks/ports';

  interface Props {
    block: BlockInstance;
    onChange: (config: Record<string, unknown>) => void;
  }

  let { block, onChange }: Props = $props();

  const textItemTypes: PromptItemType[] = [
    'plain',
    'system',
    'postHistoryInstructions',
    'jailbreak',
    'prefill',
  ];

  const fieldItemTypes: PromptItemType[] = [
    'description',
    'worldDescription',
    'persona',
    'personality',
    'scenario',
    'exampleMessages',
    'chatHistory',
    'depthPrompt',
    'director',
    'sceneState',
    'characterState',
    'narrativeGuidance',
    'sectionWorld',
    'worldRelations',
  ];

  const roleOptions: PromptItemRole[] = ['system', 'user', 'assistant'];
  const lorebookPositions: LorebookPosition[] = [
    'before_char',
    'before_scenario',
    'after_char',
    'after_messages',
    'author_note',
  ];

  function update(partial: Record<string, unknown>) {
    onChange({
      ...block.config,
      ...partial,
    });
  }

  function toggleEnabled(enabled: boolean) {
    update({ enabled });
  }

  function serializeCases(cases: unknown): string {
    if (!Array.isArray(cases)) {
      return '';
    }

    return cases
      .map((entry) => {
        const value = String((entry as { value?: string }).value || '');
        const text = String((entry as { text?: string }).text || '');
        return `${value} => ${text}`;
      })
      .join('\n');
  }

  function parseCases(raw: string) {
    const cases = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [value, ...rest] = line.split('=>');
        return {
          value: value.trim(),
          text: rest.join('=>').trim(),
        };
      });

    update({ cases });
  }
</script>

<div class="space-y-4 text-sm">
  {#if block.type === 'TextBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Name</span>
      <input
        type="text"
        value={String(block.config.itemName || '')}
        oninput={(event) => update({ itemName: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Item Type</span>
        <select
          value={String(block.config.itemType || 'plain')}
          onchange={(event) => update({ itemType: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          {#each textItemTypes as itemType}
            <option value={itemType}>{itemType}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Role</span>
        <select
          value={String(block.config.role || 'system')}
          onchange={(event) => update({ role: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          {#each roleOptions as role}
            <option value={role}>{role}</option>
          {/each}
        </select>
      </label>
    </div>

    <label class="flex items-center gap-2 text-subtext0">
      <input
        type="checkbox"
        checked={(block.config.enabled as boolean) ?? true}
        onchange={(event) => toggleEnabled(event.currentTarget.checked)}
        class="accent-mauve"
      />
      Enabled
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Content</span>
      <textarea
        rows={10}
        value={String(block.config.content || '')}
        oninput={(event) => update({ content: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
      ></textarea>
    </label>
  {:else if block.type === 'FieldBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Name</span>
      <input
        type="text"
        value={String(block.config.itemName || '')}
        oninput={(event) => update({ itemName: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Field Type</span>
        <select
          value={String(block.config.fieldType || 'description')}
          onchange={(event) => update({ fieldType: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          {#each fieldItemTypes as itemType}
            <option value={itemType}>{itemType}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Role</span>
        <select
          value={String(block.config.role || 'system')}
          onchange={(event) => update({ role: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          {#each roleOptions as role}
            <option value={role}>{role}</option>
          {/each}
        </select>
      </label>
    </div>

    <label class="flex items-center gap-2 text-subtext0">
      <input
        type="checkbox"
        checked={(block.config.enabled as boolean) ?? true}
        onchange={(event) => toggleEnabled(event.currentTarget.checked)}
        class="accent-mauve"
      />
      Enabled
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Template</span>
      <textarea
        rows={8}
        value={String(block.config.template || '')}
        oninput={(event) => update({ template: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
        placeholder={'Use {{slot}} to wrap the resolved section.'}
      ></textarea>
    </label>
  {:else if block.type === 'MemoryBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Name</span>
      <input
        type="text"
        value={String(block.config.itemName || '')}
        oninput={(event) => update({ itemName: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <div class="grid grid-cols-3 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Count</span>
        <input
          type="number"
          min="1"
          max="10"
          value={Number(block.config.count ?? 3)}
          oninput={(event) => update({ count: Number(event.currentTarget.value) })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Threshold</span>
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={Number(block.config.threshold ?? 0.7)}
          oninput={(event) => update({ threshold: Number(event.currentTarget.value) })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Format</span>
        <select
          value={String(block.config.format || 'bullet')}
          onchange={(event) => update({ format: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          <option value="bullet">bullet</option>
          <option value="numbered">numbered</option>
          <option value="paragraph">paragraph</option>
        </select>
      </label>
    </div>

    <label class="flex items-center gap-2 text-subtext0">
      <input
        type="checkbox"
        checked={(block.config.enabled as boolean) ?? true}
        onchange={(event) => toggleEnabled(event.currentTarget.checked)}
        class="accent-mauve"
      />
      Enabled
    </label>
  {:else if block.type === 'LorebookBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Name</span>
      <input
        type="text"
        value={String(block.config.itemName || '')}
        oninput={(event) => update({ itemName: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Position</span>
        <select
          value={String(block.config.lorebookPosition || 'before_char')}
          onchange={(event) => update({ lorebookPosition: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          {#each lorebookPositions as position}
            <option value={position}>{position}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Activation</span>
        <select
          value={String(block.config.activationMode || 'keyword')}
          onchange={(event) => update({ activationMode: event.currentTarget.value })}
          class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
        >
          <option value="keyword">keyword</option>
          <option value="always">always</option>
        </select>
      </label>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Template</span>
      <textarea
        rows={6}
        value={String(block.config.template || '')}
        oninput={(event) => update({ template: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
        placeholder={'Use {{slot}} to wrap the injected lorebook text.'}
      ></textarea>
    </label>
  {:else if block.type === 'ToggleBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Toggle ID</span>
      <input
        type="text"
        value={String(block.config.toggleId || '')}
        oninput={(event) => update({ toggleId: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Label</span>
      <input
        type="text"
        value={String(block.config.toggleName || '')}
        oninput={(event) => update({ toggleName: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <label class="flex items-center gap-2 text-subtext0">
      <input
        type="checkbox"
        checked={Boolean(block.config.defaultValue ?? false)}
        onchange={(event) => update({ defaultValue: event.currentTarget.checked })}
        class="accent-mauve"
      />
      Default enabled
    </label>
  {:else if block.type === 'MergeBlock'}
    <div class="rounded border border-surface2 bg-surface0/70 p-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-xs text-subtext0">Inputs</div>
          <div class="text-sm text-text">{getMergeInputCount(block)} lanes</div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-surface2 px-2 py-1 text-xs text-text transition-colors hover:border-mauve disabled:cursor-not-allowed disabled:opacity-40"
            disabled={getMergeInputCount(block) <= 2}
            onclick={() => update({ inputCount: getMergeInputCount(block) - 1 })}
          >
            - Input
          </button>
          <button
            type="button"
            class="rounded border border-surface2 px-2 py-1 text-xs text-text transition-colors hover:border-mauve disabled:cursor-not-allowed disabled:opacity-40"
            disabled={getMergeInputCount(block) >= 12}
            onclick={() => update({ inputCount: getMergeInputCount(block) + 1 })}
          >
            + Input
          </button>
        </div>
      </div>
      <p class="mt-2 text-xs text-subtext0">
        Expand one merge node instead of stacking multiple merges just to gather more prompt branches.
      </p>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Separator</span>
      <textarea
        rows={3}
        value={String(block.config.separator || '\n\n')}
        oninput={(event) => update({ separator: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
      ></textarea>
    </label>

    <label class="flex items-center gap-2 text-subtext0">
      <input
        type="checkbox"
        checked={(block.config.filterEmpty as boolean) ?? true}
        onchange={(event) => update({ filterEmpty: event.currentTarget.checked })}
        class="accent-mauve"
      />
      Skip empty inputs
    </label>
  {:else if block.type === 'SwitchBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Cases</span>
      <textarea
        rows={8}
        value={serializeCases(block.config.cases)}
        oninput={(event) => parseCases(event.currentTarget.value)}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
        placeholder="value => output text"
      ></textarea>
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Default Case</span>
      <textarea
        rows={4}
        value={String(block.config.defaultCase || '')}
        oninput={(event) => update({ defaultCase: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 font-mono text-text focus:border-mauve focus:outline-none"
      ></textarea>
    </label>
  {:else if block.type === 'StageBlock'}
    <div class="rounded border border-surface2 bg-surface0/70 p-3 text-xs text-subtext0">
      Open the stage editor to work on this stage in its own canvas. The main board stays cleaner, and the stage keeps its own prompt structure.
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Stage</span>
      <input
        type="text"
        value={String(block.config.stageLabel || '')}
        readonly
        class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 text-text/70 outline-none"
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Group</span>
        <input
          type="text"
          value={String(block.config.stageGroup || '')}
          readonly
          class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 text-text/70 outline-none"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Mode</span>
        <input
          type="text"
          value={String(block.config.composeMode || 'augment')}
          readonly
          class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 text-text/70 outline-none"
        />
      </label>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">System Targets</span>
      <textarea
        rows={5}
        value={Array.isArray(block.config.systemTargetKeys) ? block.config.systemTargetKeys.join('\n') : ''}
        readonly
        class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 font-mono text-text/70 outline-none"
      ></textarea>
    </label>

    {#if Array.isArray(block.config.prefillTargetKeys) && block.config.prefillTargetKeys.length > 0}
      <label class="flex flex-col gap-1">
        <span class="text-xs text-subtext0">Prefill Targets</span>
        <textarea
          rows={4}
          value={block.config.prefillTargetKeys.join('\n')}
          readonly
          class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 font-mono text-text/70 outline-none"
        ></textarea>
      </label>
    {/if}

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Stage Notes</span>
      <textarea
        rows={4}
        value={String(block.config.description || '')}
        readonly
        class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 text-text/70 outline-none"
      ></textarea>
    </label>
  {:else if block.type === 'OutputBlock'}
    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Output Key</span>
      <input
        type="text"
        value={String(block.config.outputKey || '')}
        readonly
        class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 font-mono text-text/70 outline-none"
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Label</span>
      <input
        type="text"
        value={String(block.config.outputLabel || '')}
        oninput={(event) => update({ outputLabel: event.currentTarget.value })}
        class="rounded border border-surface2 bg-surface0 px-2.5 py-1.5 text-text focus:border-mauve focus:outline-none"
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-subtext0">Group</span>
      <input
        type="text"
        value={String(block.config.group || '')}
        readonly
        class="rounded border border-surface2 bg-surface0/60 px-2.5 py-1.5 text-text/70 outline-none"
      />
    </label>
  {:else}
    <p class="text-sm text-subtext0">
      This block has no editable fields yet.
    </p>
  {/if}
</div>
