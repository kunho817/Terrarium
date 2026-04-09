/**
 * SillyTavern V2 card format plugin.
 * Handles the chara_card_v2 spec JSON format.
 */

import type { CardFormatPlugin } from '$lib/types/plugin';
import type {
  CharacterCard,
  LorebookEntry,
  LorebookSettings,
  LorebookPosition,
} from '$lib/types';

// === Raw format interfaces (internal) ===

interface STLoreEntry {
  keys: string[];
  secondary_keys?: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  insertion_order: number;
  enabled: boolean;
  position: string;
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

interface STCharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions?: Record<string, unknown>;
  entries: STLoreEntry[];
}

interface STRawCard {
  spec?: string;
  spec_version?: string;
  data: {
    name: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, unknown>;
    character_book?: STCharacterBook;
    [key: string]: unknown;
  };
}

// === Lorebook mapping ===

function parseSTLore(entries: STLoreEntry[], defaultScanDepth: number): LorebookEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: crypto.randomUUID(),
    name: entry.comment || '',
    keywords: Array.isArray(entry.keys) ? entry.keys : [],
    secondaryKeywords: Array.isArray(entry.secondary_keys) && entry.secondary_keys.length > 0
      ? entry.secondary_keys
      : undefined,
    caseSensitive: false,
    content: entry.content || '',
    position: (entry.position || 'before_char') as LorebookPosition,
    priority: entry.insertion_order ?? 0,
    enabled: entry.enabled !== false,
    scanDepth: defaultScanDepth,
    scope: 'global' as const,
    mode: entry.constant ? 'constant' : entry.selective ? 'selective' : 'normal',
    constant: !!entry.constant,
  }));
}

function exportSTLore(entries: LorebookEntry[], rawEntries: STLoreEntry[]): STLoreEntry[] {
  return entries.map((entry, i) => {
    const raw = rawEntries?.[i] || {};
    return {
      ...raw,
      keys: entry.keywords,
      secondary_keys: entry.secondaryKeywords || [],
      comment: entry.name,
      content: entry.content,
      constant: entry.constant,
      selective: entry.mode === 'selective',
      insertion_order: entry.priority,
      enabled: entry.enabled,
      position: entry.position,
    };
  });
}

// === Plugin ===

const DEFAULT_LORE_SETTINGS: LorebookSettings = {
  tokenBudget: 2048,
  scanDepth: 5,
  recursiveScanning: false,
  fullWordMatching: false,
};

export const sillytavernFormat: CardFormatPlugin = {
  id: 'sillytavern',
  name: 'SillyTavern',
  supportedExtensions: [],

  validate(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return false;
      return parsed.spec === 'chara_card_v2' || parsed.spec_version === '2.0';
    } catch {
      return false;
    }
  },

  parse(data: ArrayBuffer): CharacterCard {
    const text = new TextDecoder().decode(data);
    const raw = JSON.parse(text) as STRawCard;
    const d = raw.data;

    const book = d.character_book;
    const loreSettings: LorebookSettings = {
      tokenBudget: book?.token_budget ?? DEFAULT_LORE_SETTINGS.tokenBudget,
      scanDepth: book?.scan_depth ?? DEFAULT_LORE_SETTINGS.scanDepth,
      recursiveScanning: book?.recursive_scanning ?? DEFAULT_LORE_SETTINGS.recursiveScanning,
      fullWordMatching: DEFAULT_LORE_SETTINGS.fullWordMatching,
    };

    const metadata: Record<string, unknown> = {
      _stRawCard: JSON.parse(JSON.stringify(raw)),
    };
    if (d.extensions) metadata.stExtensions = d.extensions;

    return {
      name: d.name || '',
      description: d.description || '',
      personality: d.personality || '',
      scenario: d.scenario || '',
      firstMessage: d.first_mes || '',
      alternateGreetings: d.alternate_greetings || [],
      exampleMessages: d.mes_example || '',
      systemPrompt: d.system_prompt || '',
      postHistoryInstructions: d.post_history_instructions || '',
      creator: d.creator || '',
      characterVersion: d.character_version || '1.0',
      tags: d.tags || [],
      creatorNotes: d.creator_notes || '',
      lorebook: parseSTLore(book?.entries || [], loreSettings.scanDepth),
      loreSettings,
      regexScripts: [],
      triggers: [],
      scriptState: {},
      emotionImages: [],
      additionalAssets: [],
      metadata,
    };
  },

  export(card: CharacterCard): ArrayBuffer {
    const rawCard = (card.metadata._stRawCard as STRawCard) || null;
    const rawEntries = rawCard?.data?.character_book?.entries || [];

    const result: STRawCard = rawCard
      ? JSON.parse(JSON.stringify(rawCard))
      : { spec: 'chara_card_v2', spec_version: '2.0', data: {} as STRawCard['data'] };

    result.spec = 'chara_card_v2';
    result.spec_version = '2.0';

    const data = result.data;
    data.name = card.name;
    data.description = card.description;
    data.personality = card.personality;
    data.scenario = card.scenario;
    data.first_mes = card.firstMessage;
    data.mes_example = card.exampleMessages;
    data.creator_notes = card.creatorNotes;
    data.system_prompt = card.systemPrompt;
    data.post_history_instructions = card.postHistoryInstructions;
    data.alternate_greetings = card.alternateGreetings;
    data.tags = card.tags;
    data.creator = card.creator;
    data.character_version = card.characterVersion;
    data.extensions = (card.metadata.stExtensions as Record<string, unknown>) || {};

    // Character book
    if (card.lorebook.length > 0 || card.loreSettings.tokenBudget !== 2048 || card.loreSettings.scanDepth !== 5) {
      data.character_book = {
        name: rawCard?.data?.character_book?.name || '',
        description: rawCard?.data?.character_book?.description || '',
        scan_depth: card.loreSettings.scanDepth,
        token_budget: card.loreSettings.tokenBudget,
        recursive_scanning: card.loreSettings.recursiveScanning,
        extensions: rawCard?.data?.character_book?.extensions || {},
        entries: exportSTLore(card.lorebook, rawEntries),
      };
    }

    const json = JSON.stringify(result, null, 2);
    return new TextEncoder().encode(json).buffer;
  },
};
