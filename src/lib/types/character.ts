/**
 * Character card types — the core data model for AI characters.
 * Spec reference: Section 8 — Shared Types > CharacterCard
 */

import type { LorebookEntry, LorebookSettings } from './lorebook';
import type { Trigger } from './trigger';
import type { RegexScript, VariableStore } from './script';
import type { AlternateGreeting } from './world';

export interface DepthPrompt {
  depth: number;
  prompt: string;
}

export interface CharacterCard {
  // Basic info
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: AlternateGreeting[];
  exampleMessages: string;
  avatar?: ArrayBuffer;

  // Prompt fields (user-editable)
  systemPrompt: string;
  postHistoryInstructions: string;
  depthPrompt?: DepthPrompt;
  defaultPersonaId?: string;

  // Creator metadata
  creator: string;
  characterVersion: string;
  tags: string[];
  creatorNotes: string;
  license?: string;

  // Lorebook
  lorebook: LorebookEntry[];
  loreSettings: LorebookSettings;

  // Custom scripts
  regexScripts: RegexScript[];
  triggers: Trigger[];

  // UI customization
  backgroundHTML?: string;
  backgroundCSS?: string;
  customTheme?: string;

  // Virtual script (sandboxed scripting)
  virtualScript?: string;

  // Variable state
  scriptState: VariableStore;

  // Additional assets
  emotionImages: [string, string][];
  additionalAssets: [string, string, string][];

  // Format extension data (preserved during import/export for lossless roundtrip)
  metadata: Record<string, unknown>;
}
