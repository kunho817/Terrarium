import { describe, it, expect } from 'vitest';
import { createDefaultPreset } from '$lib/core/presets/defaults';

describe('Default preset agent items', () => {
  const preset = createDefaultPreset();

  it('includes memory item', () => {
    const item = preset.items.find(i => i.type === 'memory');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('includes director item', () => {
    const item = preset.items.find(i => i.type === 'director');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('includes sceneState item', () => {
    const item = preset.items.find(i => i.type === 'sceneState');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('includes characterState item', () => {
    const item = preset.items.find(i => i.type === 'characterState');
    expect(item).toBeDefined();
    expect(item?.enabled).toBe(true);
  });

  it('positions agent items between scenario and exampleMessages', () => {
    const types = preset.items.map(i => i.type);
    const scenarioIdx = types.lastIndexOf('scenario');
    const memoryIdx = types.indexOf('memory');
    const directorIdx = types.indexOf('director');
    const sceneIdx = types.indexOf('sceneState');
    const charIdx = types.indexOf('characterState');
    const exampleIdx = types.indexOf('exampleMessages');

    expect(memoryIdx).toBeGreaterThan(scenarioIdx);
    expect(directorIdx).toBeGreaterThan(memoryIdx);
    expect(sceneIdx).toBeGreaterThan(directorIdx);
    expect(charIdx).toBeGreaterThan(sceneIdx);
    expect(exampleIdx).toBeGreaterThan(charIdx);
  });
});
