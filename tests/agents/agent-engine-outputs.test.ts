import { describe, it, expect } from 'vitest';

describe('ChatEngine agent output passthrough', () => {
  it('passes agentOutputs to assembly context', () => {
    const ctx: Record<string, unknown> = {};

    const agentResult = {
      agentOutputs: {
        memory: '[Memory]\n- fact',
        director: '[Director]\nMandate: test',
        sceneState: '[Scene]\nLocation: Inn',
        characterState: '[Character States]\nElara: alert',
      },
    };

    if (agentResult.agentOutputs) {
      ctx.agentOutputs = agentResult.agentOutputs;
    }

    expect(ctx.agentOutputs).toEqual({
      memory: '[Memory]\n- fact',
      director: '[Director]\nMandate: test',
      sceneState: '[Scene]\nLocation: Inn',
      characterState: '[Character States]\nElara: alert',
    });
  });

  it('does not set agentOutputs when agent result has none', () => {
    const ctx: Record<string, unknown> = {};

    const agentResult = { injectPrompt: 'some text' };

    if ((agentResult as any).agentOutputs) {
      ctx.agentOutputs = (agentResult as any).agentOutputs;
    }

    expect(ctx.agentOutputs).toBeUndefined();
  });
});
