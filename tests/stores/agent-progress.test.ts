import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
  agentProgress,
  startPipeline,
  updateStep,
  resetPipeline,
  updateStepDiagnostic,
} from '$lib/stores/agent-progress';

describe('agent-progress store', () => {
  it('starts with inactive empty state', () => {
    const state = get(agentProgress);
    expect(state.active).toBe(false);
    expect(state.steps).toEqual([]);
  });

  it('startPipeline initializes steps as pending', () => {
    startPipeline([
      { id: 'memory', label: 'Memory' },
      { id: 'director', label: 'Director' },
      { id: 'llm-generation', label: 'Generating' },
    ]);
    const state = get(agentProgress);
    expect(state.active).toBe(true);
    expect(state.steps).toEqual([
      { agentId: 'memory', label: 'Memory', status: 'pending', diagnostic: expect.any(Object) },
      { agentId: 'director', label: 'Director', status: 'pending', diagnostic: expect.any(Object) },
      { agentId: 'llm-generation', label: 'Generating', status: 'pending', diagnostic: expect.any(Object) },
    ]);
    expect(state.startedAt).toBeGreaterThan(0);
    resetPipeline();
  });

  it('updateStep changes a single step status', () => {
    startPipeline([
      { id: 'memory', label: 'Memory' },
      { id: 'director', label: 'Director' },
    ]);
    updateStep('memory', 'running');
    const state = get(agentProgress);
    expect(state.steps[0].status).toBe('running');
    expect(state.steps[1].status).toBe('pending');
    resetPipeline();
  });

  it('updateStep does nothing for unknown agentId', () => {
    startPipeline([{ id: 'memory', label: 'Memory' }]);
    updateStep('nonexistent', 'running');
    const state = get(agentProgress);
    expect(state.steps[0].status).toBe('pending');
    resetPipeline();
  });

  it('resetPipeline clears state', () => {
    startPipeline([{ id: 'memory', label: 'Memory' }]);
    updateStep('memory', 'done');
    resetPipeline();
    const state = get(agentProgress);
    expect(state.active).toBe(false);
    expect(state.steps).toEqual([]);
    expect(state.startedAt).toBe(0);
  });

  it('multiple updates work in sequence', () => {
    startPipeline([
      { id: 'memory', label: 'Memory' },
      { id: 'director', label: 'Director' },
    ]);
    updateStep('memory', 'running');
    updateStep('memory', 'done');
    updateStep('director', 'running');
    updateStep('director', 'failed');
    const state = get(agentProgress);
    expect(state.steps[0].status).toBe('done');
    expect(state.steps[1].status).toBe('failed');
    resetPipeline();
  });
});
