<script lang="ts">
  import type {
    LorebookPosition,
    PromptItemRole,
    PromptItemType,
    PromptScriptBlock,
  } from '$lib/types';
  import { cloneSerializable } from '$lib/utils/clone-serializable';
  import { showConfirmDialog } from '$lib/utils/app-dialog';
  import PromptScriptBlockList from './PromptScriptBlockList.svelte';

  interface Props {
    blocks: PromptScriptBlock[];
    onChange: (blocks: PromptScriptBlock[]) => void;
    depth?: number;
  }

  let { blocks, onChange, depth = 0 }: Props = $props();

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
    'memory',
    'director',
    'sceneState',
    'characterState',
    'narrativeGuidance',
    'sectionWorld',
    'worldRelations',
    'lorebook',
  ];
  const roles: PromptItemRole[] = ['system', 'assistant', 'user'];
  const lorebookPositions: LorebookPosition[] = [
    'before_char',
    'before_scenario',
    'after_char',
    'after_messages',
    'author_note',
  ];

  function uid(): string {
    return crypto.randomUUID();
  }

  function emit(nextBlocks: PromptScriptBlock[]) {
    onChange(nextBlocks);
  }

  function createBlock(type: 'text' | 'promptItem' | 'merge' | 'if'): PromptScriptBlock {
    if (type === 'text') {
      return {
        id: uid(),
        type: 'text',
        label: 'Text',
        role: 'system',
        enabled: true,
        collapsed: false,
        content: '',
      };
    }

    if (type === 'promptItem') {
      return {
        id: uid(),
        type: 'promptItem',
        collapsed: false,
        item: {
          id: uid(),
          type: 'plain',
          name: 'Prompt',
          enabled: true,
          role: 'system',
          content: '',
        },
      };
    }

    if (type === 'merge') {
      return {
        id: uid(),
        type: 'merge',
        label: 'Merge',
        enabled: true,
        collapsed: false,
        separator: '\n\n',
        blocks: [],
      };
    }

    return {
      id: uid(),
      type: 'if',
      label: 'If',
      enabled: true,
      collapsed: false,
      conditionLabel: 'Condition',
      conditionEnabled: true,
      thenBlocks: [],
      elseBlocks: [],
    };
  }

  function addBlock(type: 'text' | 'promptItem' | 'merge' | 'if') {
    emit([...blocks, createBlock(type)]);
  }

  function updateBlock(index: number, patch: Partial<PromptScriptBlock>) {
    emit(blocks.map((block, blockIndex) =>
      blockIndex === index ? ({ ...block, ...patch } as PromptScriptBlock) : block,
    ));
  }

  function updatePromptItem(index: number, patch: Record<string, unknown>) {
    const block = blocks[index];
    if (!block || block.type !== 'promptItem') {
      return;
    }
    updateBlock(index, {
      item: {
        ...block.item,
        ...patch,
      },
    } as Partial<PromptScriptBlock>);
  }

  function moveBlock(index: number, delta: -1 | 1) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= blocks.length) {
      return;
    }
    const next = [...blocks];
    const [entry] = next.splice(index, 1);
    next.splice(nextIndex, 0, entry);
    emit(next);
  }

  function duplicateBlock(index: number) {
    const duplicate = cloneSerializable(blocks[index]);
    duplicate.id = uid();
    if (duplicate.type === 'promptItem') {
      duplicate.item.id = uid();
      duplicate.item.name = `${duplicate.item.name} Copy`;
    } else {
      duplicate.label = `${duplicate.label} Copy`;
    }
    emit([
      ...blocks.slice(0, index + 1),
      duplicate,
      ...blocks.slice(index + 1),
    ]);
  }

  function countNestedBlocks(block: PromptScriptBlock): number {
    if (block.type === 'merge') {
      return block.blocks.reduce((sum, child) => sum + 1 + countNestedBlocks(child), 0);
    }

    if (block.type === 'if') {
      const thenCount = block.thenBlocks.reduce((sum, child) => sum + 1 + countNestedBlocks(child), 0);
      const elseCount = block.elseBlocks.reduce((sum, child) => sum + 1 + countNestedBlocks(child), 0);
      return thenCount + elseCount;
    }

    return 0;
  }

  async function deleteBlock(index: number) {
    const block = blocks[index];
    if (!block) {
      return;
    }

    if (block.type === 'merge') {
      const childCount = countNestedBlocks(block);
      const confirmed = await showConfirmDialog(
        childCount > 0
          ? `Delete merger "${block.label}" and its ${childCount} nested block${childCount === 1 ? '' : 's'}?`
          : `Delete merger "${block.label}"?`,
      );
      if (!confirmed) {
        return;
      }
    }

    emit(blocks.filter((_, blockIndex) => blockIndex !== index));
  }

  function toggleBlockCollapsed(index: number) {
    const block = blocks[index];
    if (!block) {
      return;
    }
    updateBlock(index, { collapsed: !block.collapsed } as Partial<PromptScriptBlock>);
  }
</script>

<div class="block-list space-y-2" class:nested={depth > 0}>
  {#each blocks as block, index (block.id)}
    <section class="prompt-script-block rounded-md border border-surface2 bg-surface0/80">
      <header class="block-card-header flex items-center justify-between gap-2 border-b border-surface2 px-3 py-2">
        <button
          type="button"
          class="block-header-toggle"
          aria-expanded={!block.collapsed}
          onclick={() => toggleBlockCollapsed(index)}
          title={block.collapsed ? 'Expand block' : 'Collapse block'}
        >
          <span class={`block-collapse-icon ${block.collapsed ? 'collapsed' : ''}`}>v</span>
          <span class={`rounded px-2 py-0.5 text-[11px] uppercase ${
              block.type === 'promptItem'
                ? 'bg-blue/15 text-blue'
                : block.type === 'merge'
                  ? 'bg-teal/15 text-teal'
                  : block.type === 'if'
                    ? 'bg-red/15 text-red'
                    : 'bg-mauve/15 text-mauve'
            }`}>
              {block.type === 'promptItem' ? 'Prompt' : block.type}
          </span>
          <span class="truncate text-sm font-medium text-text">
              {block.type === 'promptItem' ? block.item.name : block.label}
            </span>
        </button>

        <div class="block-tools flex shrink-0 items-center gap-1">
          <button class="tool-btn" disabled={index === 0} onclick={() => moveBlock(index, -1)} title="Move up">Up</button>
          <button class="tool-btn" disabled={index === blocks.length - 1} onclick={() => moveBlock(index, 1)} title="Move down">Down</button>
          <button class="tool-btn" onclick={() => duplicateBlock(index)} title="Duplicate">Copy</button>
          <button class="tool-btn danger" onclick={() => void deleteBlock(index)} title="Delete">Delete</button>
        </div>
      </header>

      {#if !block.collapsed}
        <div class="space-y-3 p-3">
          {#if block.type === 'promptItem'}
            <div class="field-grid prompt-item-grid">
              <label class="field">
                <span>Name</span>
                <input
                  type="text"
                  value={block.item.name}
                  oninput={(event) => updatePromptItem(index, { name: event.currentTarget.value })}
                />
              </label>
              <label class="field">
                <span>Type</span>
                <select
                  value={block.item.type}
                  onchange={(event) => updatePromptItem(index, { type: event.currentTarget.value })}
                >
                  {#each [...textItemTypes, ...fieldItemTypes.filter((itemType) => !textItemTypes.includes(itemType))] as itemType}
                    <option value={itemType}>{itemType}</option>
                  {/each}
                </select>
              </label>
              <label class="field">
                <span>Role</span>
                <select
                  value={block.item.role}
                  onchange={(event) => updatePromptItem(index, { role: event.currentTarget.value })}
                >
                  {#each roles as role}
                    <option value={role}>{role}</option>
                  {/each}
                </select>
              </label>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <label class="inline-flex items-center gap-2 text-xs text-subtext0">
                <input
                  type="checkbox"
                  checked={block.item.enabled}
                  onchange={(event) => updatePromptItem(index, { enabled: event.currentTarget.checked })}
                  class="accent-mauve"
                />
                Enabled
              </label>

              {#if block.item.type === 'lorebook'}
                <label class="field max-w-56">
                  <span>Lorebook Position</span>
                  <select
                    value={block.item.lorebookPosition ?? 'before_char'}
                    onchange={(event) => updatePromptItem(index, { lorebookPosition: event.currentTarget.value })}
                  >
                    {#each lorebookPositions as position}
                      <option value={position}>{position}</option>
                    {/each}
                  </select>
                </label>
              {/if}
            </div>

            <label class="field">
              <span>Content</span>
              <textarea
                rows={6}
                value={block.item.content}
                oninput={(event) => updatePromptItem(index, { content: event.currentTarget.value })}
              ></textarea>
            </label>
          {:else if block.type === 'text'}
            <div class="field-grid compact-grid">
              <label class="field">
                <span>Label</span>
                <input
                  type="text"
                  value={block.label}
                  oninput={(event) => updateBlock(index, { label: event.currentTarget.value } as Partial<PromptScriptBlock>)}
                />
              </label>
              <label class="field">
                <span>Role</span>
                <select
                  value={block.role}
                  onchange={(event) => updateBlock(index, { role: event.currentTarget.value as PromptItemRole } as Partial<PromptScriptBlock>)}
                >
                  {#each roles as role}
                    <option value={role}>{role}</option>
                  {/each}
                </select>
              </label>
            </div>

            <label class="inline-flex items-center gap-2 text-xs text-subtext0">
              <input
                type="checkbox"
                checked={block.enabled}
                onchange={(event) => updateBlock(index, { enabled: event.currentTarget.checked } as Partial<PromptScriptBlock>)}
                class="accent-mauve"
              />
              Enabled
            </label>

            <label class="field">
              <span>Content</span>
              <textarea
                rows={6}
                value={block.content}
                oninput={(event) => updateBlock(index, { content: event.currentTarget.value } as Partial<PromptScriptBlock>)}
              ></textarea>
            </label>
          {:else if block.type === 'merge'}
            <div class="field-grid compact-grid">
              <label class="field">
                <span>Label</span>
                <input
                  type="text"
                  value={block.label}
                  oninput={(event) => updateBlock(index, { label: event.currentTarget.value } as Partial<PromptScriptBlock>)}
                />
              </label>
              <label class="field">
                <span>Separator</span>
                <input
                  type="text"
                  value={block.separator}
                  oninput={(event) => updateBlock(index, { separator: event.currentTarget.value } as Partial<PromptScriptBlock>)}
                />
              </label>
            </div>

            <label class="inline-flex items-center gap-2 text-xs text-subtext0">
              <input
                type="checkbox"
                checked={block.enabled}
                onchange={(event) => updateBlock(index, { enabled: event.currentTarget.checked } as Partial<PromptScriptBlock>)}
                class="accent-mauve"
              />
              Enabled
            </label>

            <div class="nested-block-container rounded border border-surface2 bg-base/50 p-2">
              <PromptScriptBlockList
                blocks={block.blocks}
                depth={depth + 1}
                onChange={(nextBlocks) => updateBlock(index, { blocks: nextBlocks } as Partial<PromptScriptBlock>)}
              />
            </div>
          {:else if block.type === 'if'}
            <div class="field-grid compact-grid">
              <label class="field">
                <span>Label</span>
                <input
                  type="text"
                  value={block.label}
                  oninput={(event) => updateBlock(index, { label: event.currentTarget.value } as Partial<PromptScriptBlock>)}
                />
              </label>
              <label class="field">
                <span>Condition</span>
                <input
                  type="text"
                  value={block.conditionLabel}
                  oninput={(event) => updateBlock(index, { conditionLabel: event.currentTarget.value } as Partial<PromptScriptBlock>)}
                />
              </label>
            </div>

            <div class="flex flex-wrap items-center gap-3 text-xs text-subtext0">
              <label class="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={block.enabled}
                  onchange={(event) => updateBlock(index, { enabled: event.currentTarget.checked } as Partial<PromptScriptBlock>)}
                  class="accent-mauve"
                />
                Enabled
              </label>
              <label class="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={block.conditionEnabled}
                  onchange={(event) => updateBlock(index, { conditionEnabled: event.currentTarget.checked } as Partial<PromptScriptBlock>)}
                  class="accent-mauve"
                />
                True branch active
              </label>
            </div>

            <div class="branch-grid">
              <div class="branch-panel rounded border border-green/30 bg-green/5 p-2">
                <div class="mb-2 text-xs font-medium text-green">Then</div>
                <PromptScriptBlockList
                  blocks={block.thenBlocks}
                  depth={depth + 1}
                  onChange={(nextBlocks) => updateBlock(index, { thenBlocks: nextBlocks } as Partial<PromptScriptBlock>)}
                />
              </div>
              <div class="branch-panel rounded border border-red/30 bg-red/5 p-2">
                <div class="mb-2 text-xs font-medium text-red">Else</div>
                <PromptScriptBlockList
                  blocks={block.elseBlocks}
                  depth={depth + 1}
                  onChange={(nextBlocks) => updateBlock(index, { elseBlocks: nextBlocks } as Partial<PromptScriptBlock>)}
                />
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  {/each}

  <div class="flex flex-wrap gap-2 rounded-md border border-dashed border-surface2 bg-surface0/35 p-2">
    <button class="add-btn" onclick={() => addBlock('promptItem')}>+ Prompt</button>
    <button class="add-btn" onclick={() => addBlock('text')}>+ Text</button>
    <button class="add-btn" onclick={() => addBlock('merge')}>+ Merge</button>
    <button class="add-btn" onclick={() => addBlock('if')}>+ If</button>
  </div>
</div>

<style>
  .block-list {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
  }

  .block-list.nested {
    border-left: 1px solid color-mix(in srgb, var(--surface2) 72%, transparent);
    padding-left: 8px;
  }

  .prompt-script-block,
  .nested-block-container,
  .branch-panel {
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    width: 100%;
  }

  .block-card-header {
    min-width: 0;
  }

  .block-tools {
    flex-wrap: wrap;
    justify-content: flex-end;
    min-width: 0;
  }

  .tool-btn {
    border: 1px solid var(--surface2);
    border-radius: 6px;
    color: var(--subtext0);
    font-size: 11px;
    padding: 3px 7px;
    transition: border-color 120ms ease, color 120ms ease, opacity 120ms ease;
  }

  .tool-btn:hover:not(:disabled) {
    border-color: var(--mauve);
    color: var(--text);
  }

  .tool-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .tool-btn.danger:hover {
    border-color: var(--red);
    color: var(--red);
  }

  .block-header-toggle {
    align-items: center;
    border-radius: 6px;
    display: flex;
    flex: 1 1 12rem;
    gap: 8px;
    min-width: 0;
    padding: 2px 4px 2px 0;
    text-align: left;
  }

  .block-header-toggle:hover .text-text {
    color: var(--lavender);
  }

  .block-collapse-icon {
    color: var(--subtext0);
    display: inline-flex;
    font-size: 12px;
    justify-content: center;
    line-height: 1;
    transition: transform 120ms ease, color 120ms ease;
    width: 12px;
  }

  .block-collapse-icon.collapsed {
    transform: rotate(-90deg);
  }

  .block-header-toggle:hover .block-collapse-icon {
    color: var(--text);
  }

  .add-btn {
    border: 1px solid var(--surface2);
    border-radius: 6px;
    color: var(--text);
    font-size: 12px;
    padding: 5px 9px;
  }

  .add-btn:hover {
    border-color: var(--mauve);
  }

  .field-grid {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    min-width: 0;
    width: 100%;
  }

  .prompt-item-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  }

  .compact-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  }

  .branch-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    min-width: 0;
    width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .field span {
    color: var(--subtext0);
    font-size: 11px;
  }

  .field input,
  .field select,
  .field textarea {
    background: var(--crust);
    border: 1px solid var(--overlay0);
    border-radius: 6px;
    color: var(--text);
    color-scheme: dark;
    font-size: 13px;
    min-width: 0;
    padding: 7px 9px;
    width: 100%;
  }

  .field select option {
    background: #f8fafc;
    color: #111827;
  }

  .field select {
    background: #f8fafc;
    color: #111827;
    color-scheme: light;
  }

  .field textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    resize: vertical;
  }

  @media (max-width: 640px) {
    .block-card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .block-tools {
      justify-content: flex-start;
      width: 100%;
    }
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--mauve);
    outline: none;
  }
</style>
