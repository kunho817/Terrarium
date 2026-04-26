import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { imageGenerationPanelStore } from '$lib/stores/image-generation-panel';

describe('imageGenerationPanelStore', () => {
  beforeEach(() => {
    imageGenerationPanelStore.clear();
  });

  it('starts a run with initial metadata', () => {
    const runId = imageGenerationPanelStore.startRun('manual', 'Current scene');
    const runs = get(imageGenerationPanelStore);

    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe(runId);
    expect(runs[0].status).toBe('running');
    expect(runs[0].title).toBe('Current scene');
    expect(runs[0].logs[0].message).toBe('Run started.');
  });

  it('records results and completes a run', () => {
    const runId = imageGenerationPanelStore.startRun('auto', 'Auto illustrations');

    imageGenerationPanelStore.log(runId, 'Planner returned 2 illustration prompt(s).');
    imageGenerationPanelStore.addResult(runId, {
      dataUrl: 'data:image/png;base64,abc',
      prompt: '1girl, lantern, rain',
    });
    imageGenerationPanelStore.complete(runId, 'Inserted 1 illustration.');

    const run = get(imageGenerationPanelStore)[0];
    expect(run.status).toBe('completed');
    expect(run.results).toHaveLength(1);
    expect(run.results[0].prompt).toBe('1girl, lantern, rain');
    expect(run.logs.at(-1)?.message).toBe('Inserted 1 illustration.');
  });

  it('marks a run as failed', () => {
    const runId = imageGenerationPanelStore.startRun('test', 'Test image');

    imageGenerationPanelStore.fail(runId, 'ComfyUI image generation timed out');

    const run = get(imageGenerationPanelStore)[0];
    expect(run.status).toBe('failed');
    expect(run.error).toBe('ComfyUI image generation timed out');
    expect(run.logs.at(-1)?.level).toBe('error');
  });
});
