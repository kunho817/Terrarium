import { writable } from 'svelte/store';

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PipelineStep {
  agentId: string;
  label: string;
  status: PipelineStepStatus;
}

export interface PipelineState {
  active: boolean;
  steps: PipelineStep[];
  startedAt: number;
}

const INITIAL: PipelineState = { active: false, steps: [], startedAt: 0 };

export const agentProgress = writable<PipelineState>(INITIAL);

export function startPipeline(agents: { id: string; label: string }[]): void {
  agentProgress.set({
    active: true,
    steps: agents.map((a) => ({ agentId: a.id, label: a.label, status: 'pending' as PipelineStepStatus })),
    startedAt: Date.now(),
  });
}

export function updateStep(agentId: string, status: PipelineStepStatus): void {
  agentProgress.update((state) => ({
    ...state,
    steps: state.steps.map((s) =>
      s.agentId === agentId ? { ...s, status } : s
    ),
  }));
}

export function resetPipeline(): void {
  agentProgress.set(INITIAL);
}
