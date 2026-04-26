import type { LorebookPosition } from './lorebook';
import type { BlockGraph } from './blocks';
import type { GraphPromptTemplate } from './config';

export type PromptItemType =
  | 'system' | 'description' | 'persona' | 'personality' | 'scenario'
  | 'exampleMessages' | 'chatHistory' | 'lorebook' | 'authornote'
  | 'postHistoryInstructions' | 'depthPrompt' | 'jailbreak' | 'prefill' | 'plain'
  | 'memory' | 'director' | 'sceneState' | 'characterState' | 'worldDescription'
  | 'narrativeGuidance' | 'sectionWorld' | 'worldRelations';

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

export interface PromptBlockToggle {
  id: string;
  name: string;
  value: boolean;
}

export type PromptScriptTargetKey =
  | 'main.prompt'
  | 'main.prefill'
  | `agent.${string}`
  | `image.${string}`;

export type PromptScriptComposeMode = 'replace' | 'augment';

export interface PromptScriptTextBlock {
  id: string;
  type: 'text';
  label: string;
  role: PromptItemRole;
  enabled: boolean;
  collapsed?: boolean;
  content: string;
}

export interface PromptScriptPromptItemBlock {
  id: string;
  type: 'promptItem';
  collapsed?: boolean;
  item: PromptItem;
}

export interface PromptScriptMergeBlock {
  id: string;
  type: 'merge';
  label: string;
  enabled: boolean;
  collapsed?: boolean;
  separator: string;
  blocks: PromptScriptBlock[];
}

export interface PromptScriptIfBlock {
  id: string;
  type: 'if';
  label: string;
  enabled: boolean;
  collapsed?: boolean;
  conditionLabel: string;
  conditionEnabled: boolean;
  thenBlocks: PromptScriptBlock[];
  elseBlocks: PromptScriptBlock[];
}

export type PromptScriptBlock =
  | PromptScriptTextBlock
  | PromptScriptPromptItemBlock
  | PromptScriptMergeBlock
  | PromptScriptIfBlock;

export interface PromptScriptTarget {
  id: string;
  key: PromptScriptTargetKey;
  label: string;
  role: PromptItemRole;
  composeMode: PromptScriptComposeMode;
  collapsed?: boolean;
  blocks: PromptScriptBlock[];
}

export interface PromptScriptStage {
  id: string;
  key: string;
  label: string;
  description: string;
  collapsed?: boolean;
  targets: PromptScriptTarget[];
}

export interface PromptScript {
  version: '1.0';
  stages: PromptScriptStage[];
}

export interface PromptPreset {
  id: string;
  name: string;
  items: PromptItem[];
  assistantPrefill: string;  // Convenience top-level prefill text
  promptScript?: PromptScript;
  blockGraph?: BlockGraph;
  blockToggles?: PromptBlockToggle[];
  promptBoard?: GraphPromptTemplate;
  agentPromptOverrides?: Record<string, string>;
  agentPrefills?: Record<string, string>;
  agentPromptGraphs?: Record<string, GraphPromptTemplate>;
  agentJailbreak?: string;
  imagePrompts?: Record<string, string>;
  imagePromptGraphs?: Record<string, GraphPromptTemplate>;
  imageJailbreak?: string;
}

export interface PromptPresetSettings {
  presets: PromptPreset[];
  activePresetId: string;
}
