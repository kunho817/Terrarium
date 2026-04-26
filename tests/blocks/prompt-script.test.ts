import { describe, expect, it } from 'vitest';
import {
  applyPromptScriptToPreset,
  compilePromptScript,
  createPromptScriptFromPreset,
} from '$lib/blocks/prompt-script';
import { createDefaultPreset } from '$lib/core/presets/defaults';
import type { PromptScriptBlock } from '$lib/types';

function text(content: string): PromptScriptBlock {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    label: 'Test Text',
    role: 'system',
    enabled: true,
    content,
  };
}

describe('prompt-script', () => {
  it('creates a readable seven-stage script from a preset', () => {
    const preset = createDefaultPreset();
    const script = createPromptScriptFromPreset(preset);

    expect(script.stages.map((stage) => stage.key)).toEqual([
      'stage.context',
      'stage.memory',
      'stage.planning',
      'stage.generation',
      'stage.extraction',
      'stage.memoryUpdate',
      'stage.illustration',
    ]);

    const generation = script.stages.find((stage) => stage.key === 'stage.generation');
    const mainTarget = generation?.targets.find((target) => target.key === 'main.prompt');
    expect(mainTarget?.blocks).toHaveLength(preset.items.length);
  });

  it('compiles target blocks in script order', () => {
    const preset = createDefaultPreset();
    const script = createPromptScriptFromPreset(preset);
    const contextStage = script.stages.find((stage) => stage.key === 'stage.context');
    const contextTarget = contextStage?.targets.find((target) => target.key === 'main.prompt');
    if (!contextTarget) {
      throw new Error('Expected context target');
    }

    contextTarget.blocks = [
      text('First'),
      {
        id: crypto.randomUUID(),
        type: 'merge',
        label: 'Merge',
        enabled: true,
        separator: ' / ',
        blocks: [text('Second'), text('Third')],
      },
    ];

    const compiled = compilePromptScript(script);
    const contextOutput = compiled.find((output) =>
      output.key === 'main.prompt' && output.composeMode === 'augment'
    );

    expect(contextOutput?.compiledText).toBe('First\n\nSecond / Third');
  });

  it('applies script outputs back to preset runtime fields', () => {
    const preset = createDefaultPreset();
    const script = createPromptScriptFromPreset(preset);
    const planning = script.stages.find((stage) => stage.key === 'stage.planning');
    const storyAuthor = planning?.targets.find((target) => target.key === 'agent.storyAuthorSystem');
    const illustration = script.stages.find((stage) => stage.key === 'stage.illustration');
    const imagePrompt = illustration?.targets.find((target) => target.key === 'image.imagePromptInstructions');
    if (!storyAuthor || !imagePrompt) {
      throw new Error('Expected script targets');
    }

    storyAuthor.blocks = [text('Custom story author')];
    imagePrompt.blocks = [text('Custom image prompt')];

    const nextPreset = applyPromptScriptToPreset(preset, script);

    expect(nextPreset.agentPromptOverrides?.storyAuthorSystem).toBe('Custom story author');
    expect(nextPreset.imagePrompts?.imagePromptInstructions).toBe('Custom image prompt');
    expect(nextPreset.promptScript).toEqual(script);
  });
});
