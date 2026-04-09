/**
 * Generic JSON card format — direct serialization of CharacterCard.
 * Uses .tcjson extension to avoid conflicts with other JSON formats.
 */

import type { CardFormatPlugin } from '$lib/types/plugin';
import type { CharacterCard } from '$lib/types';

const REQUIRED_FIELDS: (keyof CharacterCard)[] = [
  'name',
  'description',
  'personality',
  'scenario',
  'firstMessage',
];

const DEFAULTS: Partial<CharacterCard> = {
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: '',
  characterVersion: '1.0',
  tags: [],
  creatorNotes: '',
  lorebook: [],
  loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
  regexScripts: [],
  triggers: [],
  scriptState: {},
  emotionImages: [],
  additionalAssets: [],
  metadata: {},
};

export const genericJsonFormat: CardFormatPlugin = {
  id: 'generic-json',
  name: 'Generic JSON',
  supportedExtensions: ['.tcjson'],

  validate(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return false;
      return REQUIRED_FIELDS.every((field) => field in parsed);
    } catch {
      return false;
    }
  },

  parse(data: ArrayBuffer): CharacterCard {
    const text = new TextDecoder().decode(data);
    const raw = JSON.parse(text) as Partial<CharacterCard>;
    return { ...DEFAULTS, ...raw } as CharacterCard;
  },

  export(card: CharacterCard): ArrayBuffer {
    const json = JSON.stringify(card, null, 2);
    return new TextEncoder().encode(json).buffer;
  },
};
