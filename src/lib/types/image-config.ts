export interface ImageGenerationConfig {
  provider: 'novelai' | 'comfyui' | 'none';
  autoGenerate: boolean;
  artStylePresetId: string;
  imagePromptInstructions: string;
  novelai: {
    apiKey: string;
    model: string;
    width: number;
    height: number;
    steps: number;
    scale: number;
    sampler: string;
    noiseSchedule: string;
  };
  comfyui: {
    url: string;
    workflow: string;
    timeout: number;
  };
}

export const DEFAULT_IMAGE_CONFIG: ImageGenerationConfig = {
  provider: 'none',
  autoGenerate: false,
  artStylePresetId: 'anime',
  imagePromptInstructions: `You are an image prompt generator for a roleplay scene. Based on the conversation context, generate a detailed image prompt describing the current scene. Focus on:
- Character appearance and pose
- Environment and atmosphere
- Lighting and mood
- Composition and camera angle

Output ONLY the image prompt text, nothing else. Keep it under 200 tokens. Use comma-separated tags and descriptive phrases. Do not include any explanations or meta-text.`,
  novelai: {
    apiKey: '',
    model: 'nai-diffusion-4-5-full',
    width: 832,
    height: 1216,
    steps: 23,
    scale: 6,
    sampler: 'k_euler_ancestral',
    noiseSchedule: 'karras',
  },
  comfyui: {
    url: 'http://localhost:8188',
    workflow: '',
    timeout: 60,
  },
};
