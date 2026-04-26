import { writable } from 'svelte/store';

export type ImageGenerationRunMode = 'manual' | 'auto' | 'test';
export type ImageGenerationRunStatus = 'running' | 'completed' | 'failed';
export type ImageGenerationLogLevel = 'info' | 'success' | 'error';

export interface ImageGenerationLogEntry {
  id: string;
  message: string;
  level: ImageGenerationLogLevel;
  timestamp: number;
}

export interface ImageGenerationResultEntry {
  id: string;
  dataUrl: string;
  prompt: string;
  createdAt: number;
}

export interface ImageGenerationRun {
  id: string;
  mode: ImageGenerationRunMode;
  title: string;
  status: ImageGenerationRunStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  logs: ImageGenerationLogEntry[];
  results: ImageGenerationResultEntry[];
}

function createImageGenerationPanelStore() {
  const { subscribe, set, update } = writable<ImageGenerationRun[]>([]);

  function mutateRun(
    runId: string,
    updater: (run: ImageGenerationRun) => ImageGenerationRun,
  ) {
    update((runs) => runs.map((run) => (run.id === runId ? updater(run) : run)));
  }

  return {
    subscribe,
    clear() {
      set([]);
    },
    startRun(mode: ImageGenerationRunMode, title: string): string {
      const id = crypto.randomUUID();
      const now = Date.now();
      const run: ImageGenerationRun = {
        id,
        mode,
        title,
        status: 'running',
        startedAt: now,
        logs: [
          {
            id: crypto.randomUUID(),
            message: 'Run started.',
            level: 'info',
            timestamp: now,
          },
        ],
        results: [],
      };
      update((runs) => [run, ...runs].slice(0, 20));
      return id;
    },
    log(runId: string, message: string, level: ImageGenerationLogLevel = 'info') {
      mutateRun(runId, (run) => ({
        ...run,
        logs: [
          ...run.logs,
          {
            id: crypto.randomUUID(),
            message,
            level,
            timestamp: Date.now(),
          },
        ],
      }));
    },
    addResult(runId: string, result: { dataUrl: string; prompt: string }) {
      mutateRun(runId, (run) => ({
        ...run,
        results: [
          {
            id: crypto.randomUUID(),
            dataUrl: result.dataUrl,
            prompt: result.prompt,
            createdAt: Date.now(),
          },
          ...run.results,
        ],
      }));
    },
    complete(runId: string, message = 'Run completed.') {
      mutateRun(runId, (run) => ({
        ...run,
        status: 'completed',
        finishedAt: Date.now(),
        logs: [
          ...run.logs,
          {
            id: crypto.randomUUID(),
            message,
            level: 'success',
            timestamp: Date.now(),
          },
        ],
      }));
    },
    fail(runId: string, error: string) {
      mutateRun(runId, (run) => ({
        ...run,
        status: 'failed',
        finishedAt: Date.now(),
        error,
        logs: [
          ...run.logs,
          {
            id: crypto.randomUUID(),
            message: error,
            level: 'error',
            timestamp: Date.now(),
          },
        ],
      }));
    },
  };
}

export const imageGenerationPanelStore = createImageGenerationPanelStore();
