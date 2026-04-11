import { describe, it, expect } from 'vitest';
import {
  NOVELAI_MODELS,
  NOVELAI_SAMPLERS,
  NOVELAI_NOISE_SCHEDULES,
  getModelGroup,
  getCompatibleNoiseSchedules,
} from '$lib/core/image-gen/novelai-constants';

describe('NOVELAI_MODELS', () => {
  it('has at least 10 models', () => {
    expect(NOVELAI_MODELS.length).toBeGreaterThanOrEqual(10);
  });
  it('each model has value, label, and group', () => {
    for (const m of NOVELAI_MODELS) {
      expect(m.value).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.group).toBeTruthy();
    }
  });
  it('includes nai-diffusion-4-5-full', () => {
    expect(NOVELAI_MODELS.some(m => m.value === 'nai-diffusion-4-5-full')).toBe(true);
  });
});

describe('NOVELAI_SAMPLERS', () => {
  it('has 18 samplers', () => {
    expect(NOVELAI_SAMPLERS).toHaveLength(18);
  });
  it('each sampler has value and label', () => {
    for (const s of NOVELAI_SAMPLERS) {
      expect(s.value).toBeTruthy();
      expect(s.label).toBeTruthy();
    }
  });
  it('includes k_euler_ancestral', () => {
    expect(NOVELAI_SAMPLERS.some(s => s.value === 'k_euler_ancestral')).toBe(true);
  });
});

describe('NOVELAI_NOISE_SCHEDULES', () => {
  it('has 4 schedules', () => {
    expect(NOVELAI_NOISE_SCHEDULES).toHaveLength(4);
  });
  it('includes karras', () => {
    expect(NOVELAI_NOISE_SCHEDULES.some(s => s.value === 'karras')).toBe(true);
  });
});

describe('getModelGroup', () => {
  it('returns v4_5 for nai-diffusion-4-5-full', () => {
    expect(getModelGroup('nai-diffusion-4-5-full')).toBe('v4_5');
  });
  it('returns v4 for nai-diffusion-4-full', () => {
    expect(getModelGroup('nai-diffusion-4-full')).toBe('v4');
  });
  it('returns v3 for nai-diffusion-3', () => {
    expect(getModelGroup('nai-diffusion-3')).toBe('v3');
  });
  it('returns v2 for nai-diffusion-2', () => {
    expect(getModelGroup('nai-diffusion-2')).toBe('v2');
  });
  it('returns v1 for nai-diffusion', () => {
    expect(getModelGroup('nai-diffusion')).toBe('v1');
  });
  it('returns v4_5 as default for unknown', () => {
    expect(getModelGroup('unknown-model')).toBe('v4_5');
  });
});

describe('getCompatibleNoiseSchedules', () => {
  it('excludes native for v4_5 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-4-5-full', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(false);
  });
  it('excludes native for v3 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-3', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(false);
  });
  it('includes native for v2 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-2', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(true);
  });
  it('includes native for v1 models', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion', 'k_euler_ancestral');
    expect(schedules.some(s => s.value === 'native')).toBe(true);
  });
  it('limits to exponential/polyexponential for k_dpm_2 sampler', () => {
    const schedules = getCompatibleNoiseSchedules('nai-diffusion-4-5-full', 'k_dpm_2');
    expect(schedules).toHaveLength(2);
    expect(schedules.every(s => ['exponential', 'polyexponential'].includes(s.value))).toBe(true);
  });
});
