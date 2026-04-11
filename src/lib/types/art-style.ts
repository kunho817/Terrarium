export interface ArtStylePreset {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
}

export const DEFAULT_ART_PRESETS: ArtStylePreset[] = [
  {
    id: 'anime',
    name: 'Anime',
    positivePrompt: 'masterpiece, best quality, anime style, detailed',
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, normal quality, jpeg artifacts',
  },
  {
    id: 'realistic',
    name: 'Realistic',
    positivePrompt: 'photorealistic, detailed, high quality, 8k, sharp focus',
    negativePrompt: 'anime, cartoon, illustration, painting, drawing, art, sketch, lowres, bad anatomy, text',
  },
  {
    id: 'custom',
    name: 'Custom',
    positivePrompt: '',
    negativePrompt: '',
  },
];
