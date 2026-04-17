import type { LorebookPosition } from './lorebook';

export type PromptItemType =
  | 'system' | 'description' | 'persona' | 'personality' | 'scenario'
  | 'exampleMessages' | 'chatHistory' | 'lorebook' | 'authornote'
  | 'postHistoryInstructions' | 'depthPrompt' | 'jailbreak' | 'prefill' | 'plain'
  | 'memory' | 'director' | 'sceneState' | 'characterState';

export type PromptItemRole = 'system' | 'user' | 'assistant';

export interface PromptItem {
  id: string;
  type: PromptItemType;
  name: string;
  enabled: boolean;
  role: PromptItemRole;
  content: string;          // For plain/system/jailbreak/prefill: literal text. For others: innerFormat template wrapping resolved content
  lorebookPosition?: LorebookPosition;  // Only for type === 'lorebook'
}

export interface PromptPreset {
  id: string;
  name: string;
  items: PromptItem[];
  assistantPrefill: string;  // Convenience top-level prefill text
}

export interface PromptPresetSettings {
  presets: PromptPreset[];
  activePresetId: string;
}
