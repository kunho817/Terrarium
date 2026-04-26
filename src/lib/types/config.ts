/**
 * Configuration types for AI providers and app settings.
 * Spec reference: Section 3 — Plugin System
 */

import type { BlockGraph } from './blocks';
import type { PromptBlockToggle } from './prompt-preset';

export type ConfigFieldType = 'text' | 'password' | 'number' | 'select' | 'boolean';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

export interface UserConfig {
  providerId: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelSlotDefinition {
  id: string;
  label: string;
  description: string;
}

export const MODEL_SLOT_DEFINITIONS: ModelSlotDefinition[] = [
  {
    id: 'chat',
    label: 'Chat',
    description: 'Primary response generation.',
  },
  {
    id: 'memory',
    label: 'Memory Shared',
    description: 'Fallback for extraction, summaries, and memory-side helper calls.',
  },
  {
    id: 'extraction',
    label: 'Extraction',
    description: 'Post-generation fact extraction and memory routing.',
  },
  {
    id: 'summary',
    label: 'Summary',
    description: 'Long-form session summaries.',
  },
  {
    id: 'storyAuthor',
    label: 'Story Author',
    description: 'Narrative planning and next-beat selection.',
  },
  {
    id: 'director',
    label: 'Director',
    description: 'Scene control and directorial guidance.',
  },
  {
    id: 'sectionWorld',
    label: 'Section World',
    description: 'World-scoped injection and local rule composition.',
  },
  {
    id: 'illustration',
    label: 'Illustration',
    description: 'Illustration planning and image-tag generation.',
  },
];

export interface ModelSlot {
  profileId?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  customExtractionPrompt?: string;
  customSummaryPrompt?: string;
  customPlanningPrompt?: string;
}

export interface GraphPromptTemplate {
  graph: BlockGraph;
  toggles?: PromptBlockToggle[];
  compiledText?: string;
}

export interface AgentPromptOverrideSettings {
  extractionSystem: string;
  extractionWorldSystem: string;
  extractionFallbackSystem: string;
  extractionRepairSystem: string;
  storyAuthorSystem: string;
  directorSystem: string;
  turnMaintenanceSystem: string;
  sectionWorldSystem: string;
  summarySystem: string;
}

export interface AgentPromptPrefillSettings {
  extraction: string;
  extractionFallback: string;
  extractionRepair: string;
  storyAuthor: string;
  director: string;
  turnMaintenance: string;
  sectionWorld: string;
  summary: string;
}

export type AgentPromptGraphKey =
  | keyof AgentPromptOverrideSettings
  | keyof AgentPromptPrefillSettings
  | 'jailbreak';

export type AgentPromptGraphSettings = Partial<Record<AgentPromptGraphKey, GraphPromptTemplate>>;

export interface MemorySettings {
  extractionBatchSize: number;
  tokenBudget: number;
  topK: number;
  summaryThreshold: number;
  embeddingProvider: string;
  embeddingApiKey: string;
  embeddingModel: string;
}

export interface AgentSettings {
  enabled: boolean;
  jailbreak: string;
  turnMaintenance: {
    enabled: boolean;
    contextMessages: number;
    tokenBudget: number;
    timeoutMs: number;
  };
  extraction: {
    enabled: boolean;
    tokenBudget: number;
    repairAttempts: number;
  };
  director: {
    mode: 'light' | 'strong' | 'absolute';
  };
  worldMode?: {
    extractEntities: boolean;
    extractRelations: boolean;
    sectionWorldInjection: boolean;
  };
  promptOverrides?: AgentPromptOverrideSettings;
  prefills?: AgentPromptPrefillSettings;
  promptGraphs?: AgentPromptGraphSettings;
  promptBoard?: GraphPromptTemplate;
}

export type { ResponseLengthTierId } from './chat-settings';
