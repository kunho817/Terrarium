/**
 * Barrel export for all shared types.
 * Usage: import type { Message, CharacterCard } from '$lib/types';
 */

// Message
export type {
  MessageRole,
  MessageType,
  GenerationInfo,
  Message,
} from './message';

// Config
export type {
  ConfigFieldType,
  ConfigField,
  UserConfig,
  ModelInfo,
} from './config';

// Script
export type {
  RegexStage,
  RegexScript,
  VariableValue,
  VariableStore,
} from './script';

// Trigger
export type {
  TriggerEvent,
  TriggerMatchOn,
  Trigger,
} from './trigger';

// Lorebook
export type {
  LorebookPosition,
  LorebookMode,
  LorebookScope,
  LorebookEntry,
  LorebookSettings,
  Lorebook,
} from './lorebook';

// Scene
export type { SceneState } from './scene';

// Session
export type { ChatSession } from './session';

// Prompt Preset
export type {
  PromptItemType,
  PromptItemRole,
  PromptItem,
  PromptPreset,
  PromptPresetSettings,
} from './prompt-preset';

// Character
export type { DepthPrompt, CharacterCard } from './character';

// Plugin & ChatContext
export type {
  ProviderPlugin,
  CardFormatPlugin,
  ChatContext,
  AgentPlugin,
  ImageProviderPlugin,
  PromptBuilderPlugin,
} from './plugin';
