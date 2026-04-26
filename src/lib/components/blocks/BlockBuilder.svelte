<script lang="ts">
  import type { BlockGraph, BlockInstance, GraphPromptTemplate, PromptBlockToggle } from '$lib/types';
  import { tick } from 'svelte';
  import { blockRegistry, registerAllBlocks } from '$lib/blocks/registry';
  import { normalizePromptBlockToggles } from '$lib/blocks/preset-migration';
  import { arrangePromptBoard, extractUpstreamInputSubgraph } from '$lib/blocks/board-runtime';
  import { createTextGraphTemplate } from '$lib/blocks/template-runtime';
  import { getMergeInputCount } from '$lib/blocks/ports';
  import { cloneSerializable } from '$lib/utils/clone-serializable';
  import { viewportStore } from '$lib/stores/viewport';
  import BlockBuilder from './BlockBuilder.svelte';
  import Toolbar from './Toolbar.svelte';
  import BlockPalette from './BlockPalette.svelte';
  import BlockCanvas from './BlockCanvas.svelte';
  import RightPanel from './RightPanel.svelte';

  interface Props {
    graph: BlockGraph;
    toggles: PromptBlockToggle[];
    selectedBlockId?: string | null;
    onGraphChange?: (graph: BlockGraph) => void;
    onToggleChange?: (toggles: PromptBlockToggle[]) => void;
    onBlockSelect?: (blockId: string | null) => void;
    onCanvasInteract?: () => void;
  }

  let {
    graph,
    toggles,
    selectedBlockId = null,
    onGraphChange,
    onToggleChange,
    onBlockSelect,
    onCanvasInteract,
  }: Props = $props();

  registerAllBlocks();

  let viewport = $state($viewportStore);
  let previewCollapsed = $state(true);
  let paletteCollapsed = $state(true);
  let canvasContainer: HTMLElement | undefined = $state();
  let editorBlockId = $state<string | null>(null);
  let stageEditor = $state<{ blockId: string; channel: 'system' | 'prefill' } | null>(null);

  $effect(() => {
    viewport = $viewportStore;
  });

  const selectedBlock = $derived(
    graph.blocks.find((block) => block.id === editorBlockId) ?? null,
  );

  const stageEditorBlock = $derived(
    (() => {
      const current = stageEditor;
      return current ? graph.blocks.find((block) => block.id === current.blockId) ?? null : null;
    })(),
  );

  const stageEditorHasPrefill = $derived(
    Array.isArray(stageEditorBlock?.config.prefillTargetKeys) &&
    stageEditorBlock.config.prefillTargetKeys.length > 0,
  );

  const stageEditorUsesBoard = $derived(
    Boolean(stageEditorBlock?.config.stageBoardTemplate),
  );

  const activeStageTemplate = $derived.by<GraphPromptTemplate | null>(() => {
    if (!stageEditor || !stageEditorBlock || stageEditorBlock.type !== 'StageBlock') {
      return null;
    }

    const boardTemplate = stageEditorBlock.config.stageBoardTemplate;
    if (boardTemplate && typeof boardTemplate === 'object' && 'graph' in (boardTemplate as Record<string, unknown>)) {
      const cloned = cloneSerializable(boardTemplate as GraphPromptTemplate);
      cloned.toggles = normalizePromptBlockToggles(cloned.toggles, cloned.graph);
      return cloned;
    }

    const templateKey =
      stageEditor.channel === 'prefill' ? 'stagePrefillTemplate' : 'stageSystemTemplate';
    const itemName =
      stageEditor.channel === 'prefill'
        ? `${String(stageEditorBlock.config.stageLabel || 'Stage')} Prefill`
        : `${String(stageEditorBlock.config.stageLabel || 'Stage')} Prompt`;
    const role = stageEditor.channel === 'prefill' ? 'assistant' : 'system';
    const raw = stageEditorBlock.config[templateKey];

    if (raw && typeof raw === 'object' && 'graph' in (raw as Record<string, unknown>)) {
      const cloned = cloneSerializable(raw as GraphPromptTemplate);
      cloned.toggles = normalizePromptBlockToggles(cloned.toggles, cloned.graph);
      return cloned;
    }

    const inputPortIds =
      stageEditor.channel === 'prefill' ? ['prefill'] : ['base', 'augment', 'augment1', 'augment2'];
    const extractedGraph = extractUpstreamInputSubgraph(
      graph,
      stageEditorBlock.id,
      inputPortIds,
      false,
    );
    if (extractedGraph.blocks.length > 0) {
      return {
        graph: extractedGraph,
        toggles: normalizePromptBlockToggles(toggles, extractedGraph),
        compiledText: '',
      };
    }

    return createTextGraphTemplate('', itemName, role);
  });

  function syncGraph(nextGraph: BlockGraph) {
    onGraphChange?.(nextGraph);
    onToggleChange?.(normalizePromptBlockToggles(toggles, nextGraph));
  }

  function createBlock(blockType: string, position?: { x: number; y: number }): BlockInstance | null {
    const definition = blockRegistry.get(blockType as BlockInstance['type']);
    if (!definition) {
      return null;
    }

    const blockId = crypto.randomUUID();
    const config = {
      ...definition.defaultConfig,
    };

    if (blockType === 'ToggleBlock') {
      config.toggleId = config.toggleId || blockId;
      config.toggleName = config.toggleName || `Toggle ${toggles.length + 1}`;
    }

    return {
      id: blockId,
      type: definition.type,
      position: position ?? { x: 140, y: 140 + graph.blocks.length * 120 },
      config,
    };
  }

  function handleBlockAdd(blockType: string, position?: { x: number; y: number }) {
    const block = createBlock(blockType, position);
    if (!block) {
      return;
    }

    syncGraph({
      ...graph,
      blocks: [...graph.blocks, block],
    });
    onBlockSelect?.(block.id);
  }

  function handleBlockMove(blockId: string, position: { x: number; y: number }) {
    syncGraph({
      ...graph,
      blocks: graph.blocks.map((block) =>
        block.id === blockId ? { ...block, position } : block,
      ),
    });
  }

  function handleBlockConfigChange(blockId: string, config: Record<string, unknown>) {
    let nextGraph = {
      ...graph,
      blocks: graph.blocks.map((block) =>
        block.id === blockId ? { ...block, config: { ...block.config, ...config } } : block,
      ),
    };

    const nextBlock = nextGraph.blocks.find((block) => block.id === blockId);
    if (nextBlock?.type === 'MergeBlock') {
      const allowedPorts = new Set(
        Array.from({ length: getMergeInputCount(nextBlock) }, (_, index) => `input${index + 1}`),
      );
      nextGraph = {
        ...nextGraph,
        connections: nextGraph.connections.filter(
          (connection) =>
            connection.to.blockId !== blockId || allowedPorts.has(connection.to.portId),
        ),
      };
    }

    syncGraph(nextGraph);
  }

  function handleConnectionAdd(connection: BlockGraph['connections'][number]) {
    const filteredConnections = graph.connections.filter(
      (entry) =>
        !(
          entry.to.blockId === connection.to.blockId &&
          entry.to.portId === connection.to.portId
        ),
    );
    syncGraph({
      ...graph,
      connections: [...filteredConnections, connection],
    });
  }

  function handleBlockDelete(blockId: string) {
    syncGraph({
      ...graph,
      blocks: graph.blocks.filter((block) => block.id !== blockId),
      connections: graph.connections.filter(
        (connection) =>
          connection.from.blockId !== blockId && connection.to.blockId !== blockId,
      ),
    });
    if (selectedBlockId === blockId) {
      onBlockSelect?.(null);
    }
    if (editorBlockId === blockId) {
      editorBlockId = null;
    }
    if (stageEditor?.blockId === blockId) {
      stageEditor = null;
    }
  }

  function handleBlockDuplicate(blockId: string) {
    const block = graph.blocks.find((entry) => entry.id === blockId);
    if (!block) {
      return;
    }

    const duplicate: BlockInstance = {
      ...block,
      id: crypto.randomUUID(),
      position: {
        x: block.position.x + 40,
        y: block.position.y + 40,
      },
      config: { ...block.config },
    };
    if (duplicate.type === 'ToggleBlock') {
      duplicate.config.toggleId = duplicate.id;
      duplicate.config.toggleName = `${String(block.config.toggleName || 'Toggle')} Copy`;
    }

    syncGraph({
      ...graph,
      blocks: [...graph.blocks, duplicate],
    });
    onBlockSelect?.(duplicate.id);
  }

  function handleBlockCollapse(blockId: string, collapsed: boolean) {
    syncGraph({
      ...graph,
      blocks: graph.blocks.map((block) =>
        block.id === blockId ? { ...block, collapsed } : block,
      ),
    });
  }

  function handleClearCanvas() {
    syncGraph({
      version: '1.0',
      blocks: [],
      connections: [],
    });
    onBlockSelect?.(null);
    editorBlockId = null;
  }

  function handleToggleValue(toggleId: string, value: boolean) {
    onToggleChange?.(
      toggles.map((toggle) =>
        toggle.id === toggleId ? { ...toggle, value } : toggle,
      ),
    );
  }

  function handleZoomIn() {
    viewportStore.setScale(viewport.scale + 0.1);
  }

  function handleZoomOut() {
    viewportStore.setScale(viewport.scale - 0.1);
  }

  function handleFitView() {
    if (!canvasContainer || graph.blocks.length === 0) {
      return;
    }

    const rect = canvasContainer.getBoundingClientRect();
    viewportStore.fitToContent(
      graph.blocks,
      rect.width - (previewCollapsed ? 40 : 360) - (paletteCollapsed ? 44 : 220),
      rect.height,
      120,
    );
  }

  function handleResetView() {
    viewportStore.reset();
  }

  function handleArrangeLayout() {
    const arranged = arrangePromptBoard(graph);
    syncGraph(arranged);
  }

  function handleSelect(blockId: string | null) {
    onBlockSelect?.(blockId);
    if (blockId === null) {
      editorBlockId = null;
    }
  }

  function canOpenStageCanvas(blockId: string): boolean {
    const block = graph.blocks.find((entry) => entry.id === blockId);
    return block?.type === 'StageBlock';
  }

  function handleBlockEdit(blockId: string) {
    if (canOpenStageCanvas(blockId)) {
      handleSelect(blockId);
      stageEditor = { blockId, channel: 'system' };
      return;
    }

    handleSelect(blockId);
    editorBlockId = blockId;
    previewCollapsed = false;
  }

  function handleCanvasInteract() {
    paletteCollapsed = true;
    previewCollapsed = true;
    editorBlockId = null;
    stageEditor = null;
    onCanvasInteract?.();
  }

  function handleStageTemplateUpdate(
    blockId: string,
    channel: 'system' | 'prefill',
    nextTemplate: GraphPromptTemplate,
  ) {
    const block = graph.blocks.find((entry) => entry.id === blockId);
    const configKey = block?.config.stageBoardTemplate
      ? 'stageBoardTemplate'
      : channel === 'prefill'
        ? 'stagePrefillTemplate'
        : 'stageSystemTemplate';
    handleBlockConfigChange(blockId, {
      [configKey]: {
        ...nextTemplate,
        toggles: normalizePromptBlockToggles(nextTemplate.toggles, nextTemplate.graph),
      },
    });
  }

  async function handleAddAtViewportCenter(blockType: string) {
    await tick();
    const rect = canvasContainer?.getBoundingClientRect();
    if (!rect) {
      handleBlockAdd(blockType);
      return;
    }

    const center = viewportStore.screenToCanvas(rect.width / 2, rect.height / 2);
    handleBlockAdd(blockType, {
      x: center.x - 100,
      y: center.y - 30,
    });
  }
</script>

  <div class="flex h-full min-h-0 flex-col bg-mantle">
  <Toolbar
    {viewport}
    onZoomIn={handleZoomIn}
    onZoomOut={handleZoomOut}
    onFitView={handleFitView}
    onResetView={handleResetView}
    onArrange={handleArrangeLayout}
  />

  <div class="flex flex-1 min-h-0">
    <div
      class="flex shrink-0 border-r border-surface2 bg-surface1/40 transition-all duration-200"
      style="width: {paletteCollapsed ? '44px' : '220px'};"
    >
      {#if paletteCollapsed}
        <button
          class="flex h-full w-full items-center justify-center bg-surface1 text-xs text-subtext0 transition-colors hover:bg-surface2 hover:text-text"
          onclick={() => { paletteCollapsed = false; }}
          title="Open node palette"
        >
          <span class="writing-vertical">Nodes</span>
        </button>
      {:else}
        <div class="flex h-full w-full flex-col overflow-hidden">
          <div class="flex items-center justify-between border-b border-surface2 px-3 py-2">
            <span class="text-xs font-medium uppercase tracking-wide text-subtext0">Node Library</span>
            <button
              class="rounded border border-surface2 px-2 py-1 text-[11px] text-subtext0 transition-colors hover:border-mauve hover:text-text"
              onclick={() => { paletteCollapsed = true; }}
            >
              Collapse
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <BlockPalette onBlockClick={handleAddAtViewportCenter} />
          </div>
        </div>
      {/if}
    </div>

    <div class="relative min-w-0 flex-1 overflow-hidden" bind:this={canvasContainer}>
      <BlockCanvas
        {graph}
        {selectedBlockId}
        onBlockSelect={handleSelect}
        onBlockMove={handleBlockMove}
        onBlockDoubleClick={handleBlockEdit}
        onBlockEdit={handleBlockEdit}
        onConnectionAdd={handleConnectionAdd}
        onBlockDelete={handleBlockDelete}
        onBlockDuplicate={handleBlockDuplicate}
        onBlockCollapse={handleBlockCollapse}
        onClearCanvas={handleClearCanvas}
        onAddBlock={handleBlockAdd}
        onCanvasInteract={handleCanvasInteract}
      />

      {#if stageEditorBlock && activeStageTemplate}
        <div class="absolute inset-4 z-30 overflow-hidden rounded-lg border border-surface2 bg-mantle shadow-2xl">
          <div class="flex h-full flex-col">
            <header class="flex items-center justify-between border-b border-surface2 px-4 py-3">
              <div class="min-w-0">
                <div class="text-xs uppercase tracking-wide text-subtext0">Stage Canvas</div>
                <h2 class="truncate text-sm font-semibold text-text">
                  {String(stageEditorBlock.config.stageLabel || stageEditorBlock.config.stageKey || 'Stage')}
                </h2>
                <p class="text-xs text-subtext0">
                  Work on this stage in isolation. Keep branch logic and prompt composition here, not on the main board.
                </p>
              </div>

              <div class="flex items-center gap-2">
                {#if !stageEditorUsesBoard}
                  <button
                    type="button"
                    class={`rounded border px-3 py-1 text-xs transition-colors ${
                      stageEditor?.channel === 'system'
                        ? 'border-mauve bg-mauve/10 text-text'
                        : 'border-surface2 text-subtext0 hover:border-mauve hover:text-text'
                    }`}
                    onclick={() => {
                      stageEditor = { blockId: stageEditorBlock.id, channel: 'system' };
                    }}
                  >
                    System
                  </button>
                {/if}
                {#if !stageEditorUsesBoard && stageEditorHasPrefill}
                  <button
                    type="button"
                    class={`rounded border px-3 py-1 text-xs transition-colors ${
                      stageEditor?.channel === 'prefill'
                        ? 'border-mauve bg-mauve/10 text-text'
                        : 'border-surface2 text-subtext0 hover:border-mauve hover:text-text'
                    }`}
                    onclick={() => {
                      stageEditor = { blockId: stageEditorBlock.id, channel: 'prefill' };
                    }}
                  >
                    Prefill
                  </button>
                {/if}
                <button
                  type="button"
                  class="rounded border border-surface2 px-3 py-1 text-xs text-subtext0 transition-colors hover:border-mauve hover:text-text"
                  onclick={() => {
                    stageEditor = null;
                  }}
                >
                  Close
                </button>
              </div>
            </header>

            <div class="min-h-0 flex-1">
              <BlockBuilder
                graph={activeStageTemplate.graph}
                toggles={activeStageTemplate.toggles ?? []}
                selectedBlockId={null}
                onGraphChange={(nextGraph: BlockGraph) => {
                  const template = activeStageTemplate;
                  if (!template || !stageEditor) return;
                  handleStageTemplateUpdate(stageEditorBlock.id, stageEditor.channel, {
                    ...template,
                    graph: nextGraph,
                  });
                }}
                onToggleChange={(nextToggles: PromptBlockToggle[]) => {
                  const template = activeStageTemplate;
                  if (!template || !stageEditor) return;
                  handleStageTemplateUpdate(stageEditorBlock.id, stageEditor.channel, {
                    ...template,
                    toggles: nextToggles,
                  });
                }}
                onBlockSelect={() => {}}
                onCanvasInteract={() => {}}
              />
            </div>
          </div>
        </div>
      {/if}

      <div
        class="absolute right-0 top-0 bottom-0 flex border-l border-surface2 bg-surface1/95 transition-all duration-200"
        style="width: {previewCollapsed ? '40px' : '360px'};"
      >
        {#if previewCollapsed}
          <button
            class="flex h-full w-full items-center justify-center bg-surface1 text-xs text-subtext0 transition-colors hover:bg-surface2 hover:text-text"
            onclick={() => {
              previewCollapsed = false;
            }}
            title="Expand preview"
          >
            <span class="writing-vertical">Preview</span>
          </button>
        {:else}
          <div class="flex h-full w-full flex-col overflow-hidden">
            <header class="flex items-center justify-between border-b border-surface2 px-4 py-2">
              <div>
                <h2 class="text-sm font-semibold text-text">Inspector</h2>
                <p class="text-xs text-subtext0">
                {selectedBlock ? 'Block editor' : 'Live preview and toggle testing'}
                </p>
              </div>
              <button
                class="rounded border border-surface2 px-2 py-1 text-xs text-subtext0 transition-colors hover:border-mauve hover:text-text"
                onclick={() => {
                  previewCollapsed = true;
                }}
              >
                Collapse
              </button>
            </header>

            <div class="min-h-0 flex-1 overflow-hidden">
              <RightPanel
                {graph}
                toggles={toggles}
                selectedBlock={selectedBlock}
                onBlockChange={handleBlockConfigChange}
                onCloseEditor={() => {
                  editorBlockId = null;
                }}
                onToggleChange={handleToggleValue}
              />
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .writing-vertical {
    writing-mode: vertical-rl;
    text-orientation: mixed;
  }
</style>
