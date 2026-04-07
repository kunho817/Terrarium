/**
 * Lorebook types — keyword/regex-triggered knowledge injection.
 * Spec reference: Section 7.1 — Lorebook (World Knowledge Base)
 */

export type LorebookPosition =
  | 'before_char'
  | 'after_char'
  | 'before_scenario'
  | 'after_messages'
  | 'author_note';

export type LorebookMode = 'normal' | 'constant' | 'selective' | 'folder';

export type LorebookScope = 'global' | 'character' | 'scenario';

export interface LorebookEntry {
  id: string;
  name: string;

  keywords: string[];
  secondaryKeywords?: string[];
  regex?: string;
  caseSensitive: boolean;

  content: string;

  position: LorebookPosition;
  priority: number;
  tokenLimit?: number;

  enabled: boolean;
  scanDepth: number;
  scope: LorebookScope;
  characterIds?: string[];
  activationPercent?: number;

  mode: LorebookMode;
  constant: boolean;

  parentId?: string;
  folderName?: string;

  useEmbedding?: boolean;
  embeddingThreshold?: number;

  loreCache?: { key: string; data: string[] };
}

export interface LorebookSettings {
  tokenBudget: number;
  scanDepth: number;
  recursiveScanning: boolean;
  fullWordMatching: boolean;
}

export interface Lorebook {
  entries: LorebookEntry[];
  settings: LorebookSettings;
}
