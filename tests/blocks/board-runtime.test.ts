import { describe, expect, it } from 'vitest';
import { arrangePromptBoard, buildPromptBoard, compilePromptBoard } from '$lib/blocks/board-runtime';

describe('board-runtime', () => {
  it('builds a single board with output nodes for all targets', () => {
    const board = buildPromptBoard([
      {
        key: 'storyAuthorSystem',
        label: 'Story Author',
        role: 'system',
        group: 'agent',
        fallbackText: 'Story author instructions',
      },
      {
        key: 'director',
        label: 'Director Prefill',
        role: 'assistant',
        group: 'agent',
        fallbackText: 'Director prefill',
      },
    ]);

    const outputBlocks = board.graph.blocks.filter((block) => block.type === 'OutputBlock');
    expect(outputBlocks).toHaveLength(2);
    expect(outputBlocks.every((block) => block.config.outputGroup === 'agent')).toBe(true);
  });

  it('compiles per-output text from a shared board graph', async () => {
    const board = buildPromptBoard([
      {
        key: 'planningSystemPrompt',
        label: 'Illustration Planning',
        role: 'system',
        group: 'image',
        fallbackText: 'Plan image placement',
      },
      {
        key: 'promptPrefill',
        label: 'Image Prompt Prefill',
        role: 'assistant',
        group: 'image',
        fallbackText: 'prefill,image',
      },
    ]);

    const compiled = await compilePromptBoard(board.graph, board.toggles);
    const byKey = new Map(compiled.map((entry) => [entry.key, entry.compiledText]));

    expect(byKey.get('planningSystemPrompt')).toContain('Plan image placement');
    expect(byKey.get('promptPrefill')).toContain('prefill,image');
  });

  it('arranges grouped outputs into stable vertical lanes', () => {
    const board = buildPromptBoard([
      {
        key: 'main.prompt',
        label: 'Main Prompt',
        role: 'system',
        group: 'main',
        fallbackText: 'Main prompt body',
      },
      {
        key: 'agent.directorSystem',
        label: 'Director',
        role: 'system',
        group: 'agent',
        fallbackText: 'Director instructions',
      },
      {
        key: 'image.planningSystemPrompt',
        label: 'Image Planning',
        role: 'system',
        group: 'image',
        fallbackText: 'Image planning',
      },
    ]);

    const arranged = arrangePromptBoard(board.graph);
    const outputs = arranged.blocks.filter((block) => block.type === 'OutputBlock');
    const outputByGroup = new Map(outputs.map((block) => [String(block.config.outputGroup), block]));

    expect(outputByGroup.get('main')?.position.y ?? 0).toBeLessThan(outputByGroup.get('agent')?.position.y ?? 0);
    expect(outputByGroup.get('agent')?.position.y ?? 0).toBeLessThan(outputByGroup.get('image')?.position.y ?? 0);
  });

  it('builds and compiles a stage spine with system and prefill targets', async () => {
    const board = buildPromptBoard([
      {
        key: 'stage.mainPrompt',
        label: 'Main Prompt',
        group: 'main',
        composeMode: 'replace',
        systemTargets: ['main.prompt'],
        prefillTargets: ['main.prefill'],
        template: {
          graph: {
            version: '1.0',
            blocks: [
              {
                id: 'main-text',
                type: 'TextBlock',
                position: { x: 0, y: 0 },
                config: {
                  itemType: 'system',
                  itemName: 'System',
                  role: 'system',
                  content: 'Main prompt body',
                  enabled: true,
                },
              },
            ],
            connections: [],
          },
          toggles: [],
        },
        prefillTemplate: {
          graph: {
            version: '1.0',
            blocks: [
              {
                id: 'prefill-text',
                type: 'TextBlock',
                position: { x: 0, y: 0 },
                config: {
                  itemType: 'prefill',
                  itemName: 'Prefill',
                  role: 'assistant',
                  content: 'Prefill body',
                  enabled: true,
                },
              },
            ],
            connections: [],
          },
          toggles: [],
        },
      },
      {
        key: 'stage.agentPlanning',
        label: 'Planning',
        group: 'agent',
        composeMode: 'augment',
        systemTargets: ['agent.storyAuthorSystem', 'agent.directorSystem'],
        prefillTargets: ['agent.storyAuthor'],
      },
    ]);

    const stageBlocks = board.graph.blocks.filter((block) => block.type === 'StageBlock');
    expect(stageBlocks).toHaveLength(2);
    expect(board.graph.blocks.every((block) => block.type === 'StageBlock')).toBe(true);

    const compiled = await compilePromptBoard(board.graph, board.toggles);
    const byKey = new Map(compiled.map((entry) => [entry.key, entry]));

    expect(byKey.get('main.prompt')?.compiledText).toContain('Main prompt body');
    expect(byKey.get('main.prefill')?.compiledText).toContain('Prefill body');
    expect(byKey.get('agent.storyAuthorSystem')?.composeMode).toBe('augment');
    expect(byKey.get('agent.directorSystem')?.composeMode).toBe('augment');
  });

  it('lets a high-level stage own a nested target board', async () => {
    const board = buildPromptBoard([
      {
        key: 'stage.planning',
        label: 'Planning',
        group: 'agent',
        composeMode: 'replace',
        internalTargets: [
          {
            key: 'agent.storyAuthorSystem',
            label: 'Story Author',
            role: 'system',
            group: 'agent',
            composeMode: 'replace',
            fallbackText: 'Story author base',
          },
          {
            key: 'agent.directorSystem',
            label: 'Director',
            role: 'system',
            group: 'agent',
            composeMode: 'replace',
            fallbackText: 'Director base',
          },
        ],
      },
    ]);

    const stageBlock = board.graph.blocks.find((block) => block.type === 'StageBlock');
    expect(stageBlock?.config.stageBoardTemplate).toBeTruthy();
    expect(board.graph.blocks).toHaveLength(1);

    const compiled = await compilePromptBoard(board.graph, board.toggles);
    const byKey = new Map(compiled.map((entry) => [entry.key, entry]));

    expect(byKey.get('agent.storyAuthorSystem')?.compiledText).toContain('Story author base');
    expect(byKey.get('agent.directorSystem')?.compiledText).toContain('Director base');
    expect(byKey.get('agent.storyAuthorSystem')?.composeMode).toBe('replace');
  });
});
