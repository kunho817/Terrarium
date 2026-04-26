export type ResponseLengthTierId = 'quick' | 'standard' | 'detailed' | 'expansive' | 'novel';

export interface ResponseLengthTier {
  id: ResponseLengthTierId;
  label: string;
  paragraphLabel: string;
  paragraphMin: number;
  paragraphMax: number;
  maxImages: number;
  description: string;
  instruction: string;
}

export const DEFAULT_RESPONSE_LENGTH_TIER: ResponseLengthTierId = 'standard';
export const DEFAULT_TARGET_IMAGE_COUNT = 2;

export const RESPONSE_LENGTH_TIERS: ResponseLengthTier[] = [
  {
    id: 'quick',
    label: 'Quick',
    paragraphLabel: '3 paragraphs',
    paragraphMin: 3,
    paragraphMax: 3,
    maxImages: 2,
    description: 'A brisk exchange that lands one clear beat without sprawling.',
    instruction: 'Write the reply in 3 paragraphs. Keep the pacing brisk, but still land one complete dramatic beat with concrete sensory detail.',
  },
  {
    id: 'standard',
    label: 'Standard',
    paragraphLabel: '4-6 paragraphs',
    paragraphMin: 4,
    paragraphMax: 6,
    maxImages: 4,
    description: 'A full scene response with room for dialogue, action, and atmosphere.',
    instruction: 'Write the reply in 4 to 6 paragraphs. Build a full scene with dialogue, action, and atmosphere without dragging past the selected range.',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    paragraphLabel: '7-9 paragraphs',
    paragraphMin: 7,
    paragraphMax: 9,
    maxImages: 6,
    description: 'An extended scene with more texture, pacing, and internal reaction.',
    instruction: 'Write the reply in 7 to 9 paragraphs. Develop the scene with richer sensory detail, emotional reaction, and incremental movement.',
  },
  {
    id: 'expansive',
    label: 'Expansive',
    paragraphLabel: '10-12 paragraphs',
    paragraphMin: 10,
    paragraphMax: 12,
    maxImages: 9,
    description: 'A long-form scene that can sustain multiple visual beats.',
    instruction: 'Write the reply in 10 to 12 paragraphs. Let the scene breathe across multiple beats while keeping the momentum coherent and continuous.',
  },
  {
    id: 'novel',
    label: 'Novel',
    paragraphLabel: '13-20 paragraphs',
    paragraphMin: 13,
    paragraphMax: 20,
    maxImages: 12,
    description: 'A novelistic response for major scenes, reveals, or set pieces.',
    instruction: 'Write the reply in 13 to 20 paragraphs. Treat it like a novelistic scene with sustained atmosphere, layered reactions, and multiple clearly separated beats.',
  },
];

export const OUTPUT_LANGUAGE_OPTIONS = [
  { label: 'Auto', value: '' },
  { label: 'English', value: 'English' },
  { label: 'Korean', value: 'Korean' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Chinese (Simplified)', value: 'Chinese (Simplified)' },
  { label: 'Chinese (Traditional)', value: 'Chinese (Traditional)' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
  { label: 'German', value: 'German' },
  { label: 'Portuguese', value: 'Portuguese' },
  { label: 'Russian', value: 'Russian' },
  { label: 'Italian', value: 'Italian' },
  { label: 'Thai', value: 'Thai' },
  { label: 'Vietnamese', value: 'Vietnamese' },
  { label: 'Indonesian', value: 'Indonesian' },
  { label: 'Arabic', value: 'Arabic' },
  { label: 'Turkish', value: 'Turkish' },
  { label: 'Dutch', value: 'Dutch' },
  { label: 'Polish', value: 'Polish' },
] as const;

export function getResponseLengthTier(tierId?: string): ResponseLengthTier {
  return RESPONSE_LENGTH_TIERS.find((tier) => tier.id === tierId) ?? RESPONSE_LENGTH_TIERS[1];
}

export function buildResponseLengthInstruction(tierId?: string): string {
  const tier = getResponseLengthTier(tierId);
  return `Final response-length requirement: ${tier.instruction} Treat the selected paragraph range as the active target for this turn.`;
}

export function clampTargetImageCount(targetImageCount: number | undefined, tierId?: string): number {
  const tier = getResponseLengthTier(tierId);
  const fallback = Math.min(DEFAULT_TARGET_IMAGE_COUNT, tier.maxImages);
  if (typeof targetImageCount !== 'number' || !Number.isFinite(targetImageCount)) {
    return fallback;
  }
  return Math.min(tier.maxImages, Math.max(1, Math.round(targetImageCount)));
}
