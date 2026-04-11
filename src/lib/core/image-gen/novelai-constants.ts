export interface NovelAIModel {
  value: string;
  label: string;
  group: string;
}

export interface NovelAISampler {
  value: string;
  label: string;
}

export interface NovelAINoiseSchedule {
  value: string;
  label: string;
}

export const NOVELAI_MODELS: NovelAIModel[] = [
  // V4.5 (Latest)
  { value: 'nai-diffusion-4-5-full', label: 'NAI Diffusion 4.5 Full', group: 'V4.5 (Latest)' },
  { value: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion 4.5 Curated', group: 'V4.5 (Latest)' },
  // V4
  { value: 'nai-diffusion-4-full', label: 'NAI Diffusion 4 Full', group: 'V4' },
  { value: 'nai-diffusion-4-curated-preview', label: 'NAI Diffusion 4 Curated', group: 'V4' },
  // V3
  { value: 'nai-diffusion-3', label: 'NAI Diffusion 3', group: 'V3' },
  { value: 'nai-diffusion-furry-3', label: 'NAI Diffusion Furry 3', group: 'V3' },
  // V2
  { value: 'nai-diffusion-2', label: 'NAI Diffusion 2', group: 'V2' },
  // V1
  { value: 'nai-diffusion', label: 'NAI Diffusion', group: 'V1' },
  { value: 'safe-diffusion', label: 'Safe Diffusion', group: 'V1' },
  { value: 'nai-diffusion-furry', label: 'NAI Diffusion Furry', group: 'V1' },
  // Special
  { value: 'custom', label: 'Custom', group: 'Special' },
  { value: 'stable-diffusion', label: 'Stable Diffusion', group: 'Special' },
];

export const NOVELAI_SAMPLERS: NovelAISampler[] = [
  { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
  { value: 'k_euler', label: 'Euler' },
  { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
  { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
  { value: 'k_dpmpp_sde', label: 'DPM++ SDE' },
  { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
  { value: 'k_dpmpp_3m_sde', label: 'DPM++ 3M SDE' },
  { value: 'ddim', label: 'DDIM' },
  { value: 'k_lms', label: 'LMS' },
  { value: 'k_heun', label: 'Heun' },
  { value: 'k_dpm_2', label: 'DPM2' },
  { value: 'k_dpm_2_ancestral', label: 'DPM2 Ancestral' },
  { value: 'k_dpm_adaptive', label: 'DPM Adaptive' },
  { value: 'k_dpm_fast', label: 'DPM Fast' },
  { value: 'ddim_v3', label: 'DDIM v3' },
  { value: 'plms', label: 'PLMS' },
  { value: 'nai_smea', label: 'SMEA' },
  { value: 'nai_smea_dyn', label: 'SMEA DYN' },
];

export const NOVELAI_NOISE_SCHEDULES: NovelAINoiseSchedule[] = [
  { value: 'native', label: 'Native' },
  { value: 'karras', label: 'Karras' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'polyexponential', label: 'Polyexponential' },
];

export type ModelGroup = 'v4_5' | 'v4' | 'v3' | 'v2' | 'v1' | 'special';

export function getModelGroup(model: string): ModelGroup {
  if (model.startsWith('nai-diffusion-4-5')) return 'v4_5';
  if (model.startsWith('nai-diffusion-4')) return 'v4';
  if (model.includes('diffusion-3') || model.includes('furry-3')) return 'v3';
  if (model.startsWith('nai-diffusion-2')) return 'v2';
  if (model === 'nai-diffusion' || model === 'safe-diffusion' || model === 'nai-diffusion-furry') return 'v1';
  if (model === 'custom' || model === 'stable-diffusion') return 'special';
  return 'v4_5';
}

const NATIVE_EXCLUDED_GROUPS: ModelGroup[] = ['v4_5', 'v4', 'v3'];
const DPM2_SAMPLERS = ['k_dpm_2', 'k_dpm_2_ancestral'];

export function getCompatibleNoiseSchedules(model: string, sampler: string): NovelAINoiseSchedule[] {
  if (DPM2_SAMPLERS.includes(sampler)) {
    return NOVELAI_NOISE_SCHEDULES.filter(s =>
      s.value === 'exponential' || s.value === 'polyexponential'
    );
  }
  const group = getModelGroup(model);
  if (NATIVE_EXCLUDED_GROUPS.includes(group)) {
    return NOVELAI_NOISE_SCHEDULES.filter(s => s.value !== 'native');
  }
  return [...NOVELAI_NOISE_SCHEDULES];
}
