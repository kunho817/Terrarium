import { describe, it, expect } from 'vitest';
import type { AgentOutputs, AgentResult } from '$lib/types/agent';

describe('AgentOutputs type', () => {
  it('accepts all agent output fields', () => {
    const outputs: AgentOutputs = {
      memory: '[Memory]\n- fact (trait)',
      director: '[Director]\nScene Mandate: test',
      sceneState: '[Scene]\nLocation: test',
      characterState: '[Character States]\nElara: alert',
    };
    expect(outputs.memory).toBeDefined();
    expect(outputs.director).toBeDefined();
    expect(outputs.sceneState).toBeDefined();
    expect(outputs.characterState).toBeDefined();
  });

  it('accepts partial outputs', () => {
    const outputs: AgentOutputs = {
      memory: '[Memory]\n- fact',
    };
    expect(outputs.director).toBeUndefined();
  });
});

describe('AgentResult with agentOutputs', () => {
  it('accepts agentOutputs field', () => {
    const result: AgentResult = {
      agentOutputs: {
        memory: '[Memory]\n- fact',
      },
    };
    expect(result.agentOutputs?.memory).toBe('[Memory]\n- fact');
  });
});
