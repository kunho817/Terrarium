export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PipelineSubTaskDiagnostic {
  id: string;
  label: string;
  status: PipelineStepStatus;
  startedAt: number | null;
  finishedAt: number | null;
  providerId?: string | null;
  model?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  timeoutMs?: number | null;
  inputChars?: number;
  outputChars?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  result?: string;
  error?: string | null;
}

export interface StepDiagnostic {
  inputChars: number;
  outputChars: number;
  resultPreview: string;
  resultFull: string;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  temperature: number | null;
  providerId: string | null;
  model: string | null;
  maxTokens: number | null;
  timeoutMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  subTasks: PipelineSubTaskDiagnostic[];
}

export interface PipelineStepSnapshot {
  agentId: string;
  label: string;
  status: PipelineStepStatus;
  diagnostic: StepDiagnostic;
}

export interface PipelineSnapshot {
  startedAt: number;
  finishedAt: number;
  totalDurationMs: number;
  steps: PipelineStepSnapshot[];
}
