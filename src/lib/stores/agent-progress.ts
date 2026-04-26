import { get, writable } from 'svelte/store';
import type {
  PipelineSnapshot,
  PipelineStepSnapshot,
  PipelineStepStatus,
  StepDiagnostic,
} from '$lib/types/diagnostics';

export interface PipelineStep {
  agentId: string;
  label: string;
  status: PipelineStepStatus;
  diagnostic: StepDiagnostic;
}

export interface PipelineState {
  active: boolean;
  steps: PipelineStep[];
  startedAt: number;
}

const EMPTY_DIAGNOSTIC: StepDiagnostic = {
	inputChars: 0,
	outputChars: 0,
	resultPreview: '',
	resultFull: '',
	error: null,
	startedAt: null,
	finishedAt: null,
	temperature: null,
	providerId: null,
	model: null,
	maxTokens: null,
	timeoutMs: null,
	inputTokens: null,
	outputTokens: null,
	subTasks: [],
};

const INITIAL: PipelineState = { active: false, steps: [], startedAt: 0 };

export const agentProgress = writable<PipelineState>(INITIAL);

export function startPipeline(agents: { id: string; label: string }[]): void {
  agentProgress.set({
    active: true,
    steps: agents.map((a) => ({ agentId: a.id, label: a.label, status: 'pending' as PipelineStepStatus, diagnostic: { ...EMPTY_DIAGNOSTIC } })),
    startedAt: Date.now(),
  });
}

export function updateStep(agentId: string, status: PipelineStepStatus): void {
  agentProgress.update((state) => ({
    ...state,
    steps: state.steps.map((s) =>
      s.agentId === agentId ? {
				...s,
				status,
				diagnostic: {
					...s.diagnostic,
					startedAt: s.diagnostic.startedAt ?? (status === 'running' ? Date.now() : s.diagnostic.startedAt),
					finishedAt: status !== 'running' && status !== 'pending' ? Date.now() : s.diagnostic.finishedAt,
				},
			} : s
    ),
  }));
}

export function updateStepDiagnostic(agentId: string, patch: Partial<StepDiagnostic>): void {
	agentProgress.update((state) => ({
		...state,
		steps: state.steps.map((s) =>
			s.agentId === agentId ? { ...s, diagnostic: { ...s.diagnostic, ...patch } } : s
		),
	}));
}

export function resetPipeline(): void {
  agentProgress.set(INITIAL);
}

function cloneDiagnostic(diagnostic: StepDiagnostic): StepDiagnostic {
  return {
    ...diagnostic,
    subTasks: diagnostic.subTasks.map((subTask) => ({ ...subTask })),
  };
}

export function snapshotPipeline(): PipelineSnapshot | null {
  const state = get(agentProgress);
  if (state.steps.length === 0) {
    return null;
  }

  const finishedAt = Date.now();
  const steps: PipelineStepSnapshot[] = state.steps.map((step) => ({
    ...step,
    diagnostic: cloneDiagnostic(step.diagnostic),
  }));

  return {
    startedAt: state.startedAt,
    finishedAt,
    totalDurationMs: Math.max(0, finishedAt - state.startedAt),
    steps,
  };
}
