/**
 * RisuAI card format plugin — lossless roundtrip import/export.
 * Spec reference: Section 9 — RisuAI Card Compatibility
 */

import type { CardFormatPlugin } from '$lib/types/plugin';
import type {
  CharacterCard,
  LorebookEntry,
  LorebookSettings,
  LorebookMode,
  RegexScript,
  RegexStage,
  Trigger,
} from '$lib/types';

// === Raw format interfaces (internal) ===

interface RisuLoreEntry {
  key: string;
  secondkey?: string;
  insertorder: number;
  comment: string;
  content: string;
  mode: LorebookMode;
  alwaysActive: boolean;
  selective: boolean;
  activationPercent?: number;
  extententions?: Record<string, unknown>;
  useRegex?: boolean;
  folder?: string;
  [key: string]: unknown;
}

interface RisuRegexScript {
  scriptName: string;
  findRegex: string;
  replaceString: string;
  placeHolder: string;
  trimString: boolean;
  onlyFirst: boolean;
  [key: string]: unknown;
}

interface RisuTrigger {
  name?: string;
  conditions?: Array<{ type: string; value: string }>;
  script?: string;
  [key: string]: unknown;
}

const RISU_STAGE_MAP: Record<string, RegexStage> = {
  sl000: 'modify_input',
  sl001: 'modify_output',
  sl002: 'modify_request',
  sl003: 'modify_display',
};

const STAGE_TO_RISU: Record<RegexStage, string> = {
  modify_input: 'sl000',
  modify_output: 'sl001',
  modify_request: 'sl002',
  modify_display: 'sl003',
};

const DEFAULT_LORE_SETTINGS: LorebookSettings = {
  tokenBudget: 2048,
  scanDepth: 5,
  recursiveScanning: false,
  fullWordMatching: false,
};

// === Lorebook mapping ===

function parseRisuLore(entries: RisuLoreEntry[], defaultScanDepth: number): LorebookEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: crypto.randomUUID(),
    name: entry.comment || '',
    keywords: typeof entry.key === 'string' ? entry.key.split(',').map((k) => k.trim()).filter(Boolean) : [],
    secondaryKeywords: entry.secondkey
      ? entry.secondkey.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined,
    caseSensitive: (entry.extententions as Record<string, unknown>)?.risu_case_sensitive === true,
    content: entry.content || '',
    position: 'before_char' as const,
    priority: entry.insertorder ?? 0,
    enabled: true,
    scanDepth: defaultScanDepth,
    scope: 'global' as const,
    activationPercent: entry.activationPercent,
    mode: entry.mode || 'normal',
    constant: !!entry.alwaysActive,
    folderName: entry.folder || undefined,
  }));
}

function exportRisuLore(entries: LorebookEntry[], rawEntries: RisuLoreEntry[]): RisuLoreEntry[] {
  return entries.map((entry, i) => {
    // Workaround: extract raw entry to local to avoid V8 JIT property resolution issue (Node 24)
    const rawEntry = rawEntries?.[i];
    const rawExt = rawEntry ? (rawEntry.extententions as Record<string, unknown> | undefined) : undefined;
    const extentions: Record<string, unknown> = {
      ...(rawExt || {}),
      ...(entry.caseSensitive ? { risu_case_sensitive: true } : {}),
    };
    const result: RisuLoreEntry = {
      key: entry.keywords.join(', '),
      secondkey: entry.secondaryKeywords?.join(', ') || '',
      insertorder: entry.priority,
      comment: entry.name,
      content: entry.content,
      mode: entry.mode,
      alwaysActive: entry.constant,
      selective: entry.mode === 'selective',
      activationPercent: entry.activationPercent,
      extentions,
      folder: entry.folderName || '',
    };
    return result;
  });
}

// === Regex script mapping ===

function parseRisuScripts(scripts: RisuRegexScript[]): RegexScript[] {
  if (!Array.isArray(scripts)) return [];
  return scripts.map((s) => ({
    id: crypto.randomUUID(),
    name: s.scriptName || '',
    pattern: s.findRegex || '',
    replacement: s.replaceString || '',
    stage: RISU_STAGE_MAP[s.placeHolder] || 'modify_input',
    enabled: true,
    flag: s.onlyFirst ? '' : 'g',
  }));
}

function exportRisuScripts(scripts: RegexScript[], rawScripts: RisuRegexScript[]): RisuRegexScript[] {
  return scripts.map((s, i) => {
    const raw = rawScripts?.[i] || {};
    return {
      ...raw,
      scriptName: s.name,
      findRegex: s.pattern,
      replaceString: s.replacement,
      placeHolder: STAGE_TO_RISU[s.stage] || 'sl000',
      trimString: (raw as RisuRegexScript).trimString ?? false,
      onlyFirst: s.flag !== 'g',
    };
  });
}

// === Trigger mapping ===

function parseRisuTriggers(triggers: RisuTrigger[]): Trigger[] {
  if (!Array.isArray(triggers)) return [];
  return triggers.map((t) => ({
    id: crypto.randomUUID(),
    name: t.name || '',
    enabled: true,
    event: 'on_manual' as const,
    script: t.script || '',
  }));
}

function exportRisuTriggers(triggers: Trigger[], rawTriggers: RisuTrigger[]): RisuTrigger[] {
  return triggers.map((t, i) => {
    const raw = rawTriggers?.[i] || {};
    return {
      ...raw,
      name: t.name,
      script: t.script,
    };
  });
}

// === Plugin ===

export const risuaiFormat: CardFormatPlugin = {
  id: 'risuai',
  name: 'RisuAI',
  supportedExtensions: ['.json'],

  validate(data: ArrayBuffer): boolean {
    try {
      const text = new TextDecoder().decode(data);
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return false;
      if (parsed.spec === 'chara_card_v2') return false;
      return 'name' in parsed && 'desc' in parsed;
    } catch {
      return false;
    }
  },

  parse(data: ArrayBuffer): CharacterCard {
    const text = new TextDecoder().decode(data);
    const raw = JSON.parse(text) as Record<string, unknown>;

    const knownKeys = new Set([
      'name', 'desc', 'personality', 'scenario', 'firstMessage',
      'alternateGreetings', 'exampleMessage', 'systemPrompt',
      'postHistoryInstructions', 'creatorNotes', 'tags', 'creator',
      'characterVersion', 'backgroundHTML', 'backgroundCSS',
      'virtualscript', 'scriptstate', 'emotionImages',
      'additionalAssets', 'bias', 'depth_prompt', 'globalLore',
      'customscript', 'triggerscript', 'sdData', 'newGenData',
      'extentions',
    ]);

    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!knownKeys.has(key)) {
        metadata[key] = value;
      }
    }

    if (raw.bias !== undefined) metadata.bias = raw.bias;
    if (raw.sdData !== undefined) metadata.sdData = raw.sdData;
    if (raw.newGenData !== undefined) metadata.newGenData = raw.newGenData;
    if (raw.extentions !== undefined) metadata.risuExtensions = raw.extentions;

    metadata._risuRawLore = raw.globalLore || [];
    metadata._risuRawScripts = raw.customscript || [];
    metadata._risuRawTriggers = raw.triggerscript || [];

    const scanDepth = DEFAULT_LORE_SETTINGS.scanDepth;

    return {
      name: (raw.name as string) || '',
      description: (raw.desc as string) || '',
      personality: (raw.personality as string) || '',
      scenario: (raw.scenario as string) || '',
      firstMessage: (raw.firstMessage as string) || '',
      alternateGreetings: Array.isArray(raw.alternateGreetings)
        ? raw.alternateGreetings as string[]
        : [],
      exampleMessages: (raw.exampleMessage as string) || '',
      systemPrompt: (raw.systemPrompt as string) || '',
      postHistoryInstructions: (raw.postHistoryInstructions as string) || '',
      depthPrompt: raw.depth_prompt as { depth: number; prompt: string } | undefined,
      creator: (raw.creator as string) || '',
      characterVersion: (raw.characterVersion as string) || '1.0',
      tags: Array.isArray(raw.tags) ? raw.tags as string[] : [],
      creatorNotes: (raw.creatorNotes as string) || '',
      backgroundHTML: raw.backgroundHTML as string | undefined,
      backgroundCSS: raw.backgroundCSS as string | undefined,
      virtualScript: raw.virtualscript as string | undefined,
      scriptState: (raw.scriptstate as Record<string, string | number | boolean>) || {},
      emotionImages: Array.isArray(raw.emotionImages) ? raw.emotionImages as [string, string][] : [],
      additionalAssets: Array.isArray(raw.additionalAssets) ? raw.additionalAssets as [string, string, string][] : [],
      lorebook: parseRisuLore(raw.globalLore as RisuLoreEntry[], scanDepth),
      loreSettings: DEFAULT_LORE_SETTINGS,
      regexScripts: parseRisuScripts(raw.customscript as RisuRegexScript[]),
      triggers: parseRisuTriggers(raw.triggerscript as RisuTrigger[]),
      metadata,
    };
  },

  export(card: CharacterCard): ArrayBuffer {
    const rawLore = (card.metadata._risuRawLore as RisuLoreEntry[]) || [];
    const rawScripts = (card.metadata._risuRawScripts as RisuRegexScript[]) || [];
    const rawTriggers = (card.metadata._risuRawTriggers as RisuTrigger[]) || [];

    const result: Record<string, unknown> = {};

    const internalKeys = new Set([
      'bias', 'sdData', 'newGenData', 'risuExtensions',
      '_risuRawLore', '_risuRawScripts', '_risuRawTriggers',
    ]);
    for (const [key, value] of Object.entries(card.metadata)) {
      if (!internalKeys.has(key)) {
        result[key] = value;
      }
    }

    result.name = card.name;
    result.desc = card.description;
    result.personality = card.personality;
    result.scenario = card.scenario;
    result.firstMessage = card.firstMessage;
    result.alternateGreetings = card.alternateGreetings;
    result.exampleMessage = card.exampleMessages;
    result.systemPrompt = card.systemPrompt;
    result.postHistoryInstructions = card.postHistoryInstructions;
    result.creatorNotes = card.creatorNotes;
    result.tags = card.tags;
    result.creator = card.creator;
    result.characterVersion = card.characterVersion;
    result.backgroundHTML = card.backgroundHTML || '';
    result.backgroundCSS = card.backgroundCSS || '';
    result.virtualscript = card.virtualScript || '';
    result.scriptstate = card.scriptState;
    result.emotionImages = card.emotionImages;
    result.additionalAssets = card.additionalAssets;
    result.depth_prompt = card.depthPrompt || { depth: 4, prompt: '' };

    result.globalLore = card.lorebook.length > 0
      ? exportRisuLore(card.lorebook, rawLore)
      : rawLore;

    result.customscript = card.regexScripts.length > 0
      ? exportRisuScripts(card.regexScripts, rawScripts)
      : rawScripts;

    result.triggerscript = card.triggers.length > 0
      ? exportRisuTriggers(card.triggers, rawTriggers)
      : rawTriggers;

    if (card.metadata.bias !== undefined) result.bias = card.metadata.bias;
    if (card.metadata.sdData !== undefined) result.sdData = card.metadata.sdData;
    if (card.metadata.newGenData !== undefined) result.newGenData = card.metadata.newGenData;
    if (card.metadata.risuExtensions !== undefined) result.extentions = card.metadata.risuExtensions;

    const json = JSON.stringify(result, null, 2);
    return new TextEncoder().encode(json).buffer;
  },
};
